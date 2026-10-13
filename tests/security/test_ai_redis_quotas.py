"""Real shared quotas against an owned, ephemeral loopback Redis server.

All users and SQLite files are synthetic. The provider is a deterministic fake;
neither Anthropic, SMTP nor an existing Redis service is contacted. These tests
exercise Redis Lua counters and Flask workers, not deployed Redis TLS or ACLs.
"""

from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
import multiprocessing
import os
from pathlib import Path
import shutil
import socket
import subprocess
import threading
import time

from flask_login import login_user
from limits import parse
import pytest
import redis

from ai.provider import LLMAIService
from extensions import db, limiter
from models import User
from services.aprendizagem import explain_again
from services.common import AppError
from test_ai_quotas import ConfiguredQuotaProvider, post, quota_factory, register


@dataclass
class OwnedRedis:
    process: subprocess.Popen
    client: redis.Redis
    address: tuple
    uri: str
    version: str

    def stop(self):
        if self.process.poll() is None:
            self.process.terminate()
            try:
                self.process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self.process.kill()
                self.process.wait(timeout=5)


@pytest.fixture
def local_redis(audit_app, tmp_path):
    """A missing mandatory runtime is a test failure, never a silent skip."""
    executable = os.environ.get("REDIS_SERVER_EXECUTABLE") or shutil.which(
        "redis-server"
    )
    if not executable:
        pytest.fail(
            "Install a trusted redis-server or set REDIS_SERVER_EXECUTABLE "
            "to run the mandatory shared-quota tests."
        )
    # Packaged Redis can be a multicall binary reached through redis-server ->
    # redis-check-rdb. Its argv[0] selects the mode, so resolving the symlink
    # would start the checker rather than the owned server.
    binary = Path(executable).absolute()
    if not binary.is_file():
        pytest.fail("The configured redis-server executable does not exist.")
    version = subprocess.check_output([str(binary), "--version"], text=True).strip()
    with socket.socket() as reservation:
        reservation.bind(("127.0.0.1", 0))
        address = reservation.getsockname()
    directory = tmp_path / "owned-redis"
    directory.mkdir(mode=0o700)
    # The audit boundary remains closed to every address except this new server.
    audit_app.extensions["audit_allowed_addresses"].add(address)
    with (directory / "server.log").open("wb") as log:
        process = subprocess.Popen(
            [
                str(binary),
                "--bind",
                "127.0.0.1",
                "--port",
                str(address[1]),
                "--protected-mode",
                "yes",
                "--save",
                "",
                "--appendonly",
                "no",
                "--dir",
                str(directory),
            ],
            stdout=log,
            stderr=subprocess.STDOUT,
            env={"PATH": os.defpath, "LANG": "C"},
        )
        client = redis.Redis(
            host=address[0],
            port=address[1],
            socket_connect_timeout=0.25,
            socket_timeout=0.25,
        )
        runtime = OwnedRedis(
            process, client, address, f"redis://127.0.0.1:{address[1]}/0", version
        )
        try:
            deadline = time.monotonic() + 10
            while True:
                if process.poll() is not None:
                    pytest.fail("The owned loopback Redis server exited at startup.")
                try:
                    if client.ping():
                        break
                except redis.ConnectionError:
                    if time.monotonic() >= deadline:
                        pytest.fail("The owned loopback Redis server did not start.")
                    time.sleep(0.025)
            yield runtime
        finally:
            runtime.stop()
            client.close()
            assert process.poll() is not None


def shared_app(quota_factory, local_redis, **overrides):
    return quota_factory(
        RATELIMIT_STORAGE_URI=local_redis.uri,
        RATELIMIT_KEY_PREFIX="synthetic-shared-quota",
        RATELIMIT_STORAGE_OPTIONS={
            "socket_connect_timeout": 0.25,
            "socket_timeout": 0.25,
        },
        **overrides,
    )


def copy_session(application, source_client):
    destination = application.test_client()
    cookie = source_client.get_cookie(application.config["SESSION_COOKIE_NAME"])
    destination.set_cookie(cookie.key, cookie.value)
    return destination


def counter_key(application, specification, account, scope):
    prefix = application.config["RATELIMIT_KEY_PREFIX"]
    with application.app_context():
        return limiter.storage.prefixed_key(
            parse(specification).key_for(prefix, account, scope)
        )


def test_distribution_multicall_alias_starts_an_owned_server(
    audit_app, tmp_path, monkeypatch, request
):
    """Exercise distro alias dispatch with the trusted installed Redis binary."""
    executable = os.environ.get("REDIS_SERVER_EXECUTABLE") or shutil.which(
        "redis-server"
    )
    if not executable:
        pytest.fail("A trusted redis-server is required for the alias regression.")
    bundled_binary = tmp_path / "redis-check-rdb"
    shutil.copy2(executable, bundled_binary)
    server_alias = tmp_path / "redis-server"
    server_alias.symlink_to(bundled_binary)
    monkeypatch.setenv("REDIS_SERVER_EXECUTABLE", str(server_alias))
    runtime = request.getfixturevalue("local_redis")
    assert runtime.client.ping() is True
    assert runtime.version.startswith("Redis server v=")


def test_redis_minute_budget_is_shared_across_factories_sessions_routes_and_ips(
    quota_factory,
    local_redis,
):
    first, provider_a = shared_app(
        quota_factory, local_redis, AI_MINUTE_REQUEST_LIMIT=3
    )
    client_a, _ = register(first)
    second, provider_b = shared_app(
        quota_factory,
        local_redis,
        AI_MINUTE_REQUEST_LIMIT=3,
        SQLALCHEMY_DATABASE_URI=first.config["SQLALCHEMY_DATABASE_URI"],
    )
    client_b = copy_session(second, client_a)
    conversation = post(client_a, "/api/conversations", {"topicId": "introductions"})
    assert conversation.status_code == 201
    assert (
        post(
            client_b,
            "/api/lessons/greetings/explain",
            environ_overrides={"REMOTE_ADDR": "192.0.2.11"},
        ).status_code
        == 200
    )
    assert (
        post(
            client_a,
            "/api/lessons/greetings/example",
            environ_overrides={"REMOTE_ADDR": "192.0.2.12"},
        ).status_code
        == 200
    )
    refused = post(
        client_b,
        f"/api/conversations/{conversation.get_json()['id']}/messages",
        {"text": "I enjoy practicing English."},
        environ_overrides={"REMOTE_ADDR": "192.0.2.13"},
    )
    assert refused.status_code == 429
    assert refused.get_json()["error"]["code"] == "RATE_LIMITED"
    assert refused.headers["X-RateLimit-Limit"] == "3"
    assert int(refused.headers["Retry-After"]) >= 1
    assert len(provider_a.calls) + len(provider_b.calls) == 3


def test_redis_minute_expiry_preserves_account_day_and_global_day(
    quota_factory,
    local_redis,
):
    application, provider = shared_app(
        quota_factory,
        local_redis,
        AI_MINUTE_REQUEST_LIMIT=2,
        AI_DAILY_REQUEST_LIMIT=3,
        AI_GLOBAL_DAILY_REQUEST_LIMIT=4,
    )
    client_a, owner = register(application, "a")
    client_b, _ = register(application, "b")
    minute = counter_key(
        application, "2 per minute", f"user:{owner}", "external-ai-minute-account"
    )
    day = counter_key(
        application, "3 per day", f"user:{owner}", "external-ai-daily-account"
    )
    global_day = counter_key(
        application, "4 per day", "all-accounts", "external-ai-daily-global"
    )
    for _ in range(2):
        assert post(client_a, "/api/lessons/greetings/explain").status_code == 200
    assert post(client_a, "/api/lessons/greetings/example").status_code == 429
    day_expiry = local_redis.client.ttl(day)
    global_expiry = local_redis.client.ttl(global_day)
    assert day_expiry > 3600 and global_expiry > 3600
    # Expire exactly one owned minute key; no sleep, FLUSHDB or day reset.
    assert local_redis.client.pexpire(minute, 1)
    deadline = time.monotonic() + 2
    while local_redis.client.exists(minute):
        assert time.monotonic() < deadline
        time.sleep(0.005)
    assert post(client_a, "/api/lessons/greetings/example").status_code == 200
    account_refusal = post(client_a, "/api/lessons/greetings/explain")
    assert account_refusal.status_code == 429
    assert account_refusal.headers["X-RateLimit-Limit"] == "3"
    assert int(account_refusal.headers["Retry-After"]) > 3600
    assert post(client_b, "/api/lessons/greetings/example").status_code == 200
    global_refusal = post(client_b, "/api/lessons/greetings/explain")
    assert global_refusal.status_code == 429
    assert global_refusal.headers["X-RateLimit-Limit"] == "4"
    assert len(provider.calls) == 4
    assert 3600 < local_redis.client.ttl(day) <= day_expiry
    assert 3600 < local_redis.client.ttl(global_day) <= global_expiry


def test_redis_global_budget_is_shared_by_distinct_accounts_and_factories(
    quota_factory,
    local_redis,
):
    first, provider_a = shared_app(
        quota_factory, local_redis, AI_GLOBAL_DAILY_REQUEST_LIMIT=2
    )
    client_a, owner_a = register(first, "a")
    second, provider_b = shared_app(
        quota_factory, local_redis, AI_GLOBAL_DAILY_REQUEST_LIMIT=2
    )
    client_b, owner_b = register(second, "b")
    assert owner_a != owner_b
    assert post(client_a, "/api/lessons/greetings/explain").status_code == 200
    assert post(client_b, "/api/lessons/greetings/example").status_code == 200
    for client in (client_a, client_b):
        refused = post(client, "/api/lessons/greetings/explain")
        assert refused.status_code == 429
        assert refused.headers["X-RateLimit-Limit"] == "2"
    assert len(provider_a.calls) + len(provider_b.calls) == 2


def test_redis_atomic_minute_reservation_bounds_concurrent_provider_calls(
    quota_factory,
    local_redis,
):
    first, provider_a = shared_app(
        quota_factory, local_redis, AI_MINUTE_REQUEST_LIMIT=4
    )
    client, _ = register(first)
    second, provider_b = shared_app(
        quota_factory,
        local_redis,
        AI_MINUTE_REQUEST_LIMIT=4,
        SQLALCHEMY_DATABASE_URI=first.config["SQLALCHEMY_DATABASE_URI"],
    )
    clients = [
        copy_session((first, second)[number % 2], client) for number in range(16)
    ]
    start = threading.Barrier(len(clients))

    def attempt(index):
        start.wait(timeout=10)
        return post(
            clients[index],
            "/api/lessons/greetings/explain",
            environ_overrides={"REMOTE_ADDR": f"192.0.2.{index + 1}"},
        ).status_code

    with ThreadPoolExecutor(max_workers=len(clients)) as workers:
        outcomes = list(workers.map(attempt, range(len(clients))))
    assert outcomes.count(200) == 4
    assert outcomes.count(429) == 12
    assert len(provider_a.calls) + len(provider_b.calls) == 4


def _process_worker(settings, cookie, address, barrier, results):
    """Spawn gives each worker a fresh extension/connection pool and fake SDK."""
    from functools import partial
    from flask import Flask
    import app as application_module

    original_connect = socket.socket.connect
    network_attempts = []

    def loopback_only(connection, destination):
        if destination != address:
            network_attempts.append(destination)
            raise AssertionError("A quota worker attempted forbidden network access.")
        return original_connect(connection, destination)

    socket.socket.connect = loopback_only
    # Never read .env or inherited service credentials in a spawned worker.
    application_module.load_config = lambda: settings.copy()
    database_file = Path(settings["SQLALCHEMY_DATABASE_URI"].removeprefix("sqlite:///"))
    application_module.Flask = partial(
        Flask, instance_path=str(database_file.parent / "synthetic-worker-instance")
    )
    application = None
    try:
        application = application_module.create_app(settings)
        provider = ConfiguredQuotaProvider()
        application.extensions["english_ai"] = LLMAIService(provider)
        client = application.test_client()
        client.set_cookie(*cookie)
        barrier.wait(timeout=15)
        outcomes = [
            post(client, "/api/lessons/greetings/explain").status_code for _ in range(5)
        ]
        results.put((outcomes, len(provider.calls), len(network_attempts), None))
    except Exception as error:
        results.put(([], 0, len(network_attempts), type(error).__name__))
    finally:
        if application is not None:
            with application.app_context():
                db.session.remove()
                db.engine.dispose()


def test_redis_budget_remains_atomic_between_real_worker_processes(
    quota_factory,
    local_redis,
    tmp_path,
):
    application, parent_provider = shared_app(
        quota_factory, local_redis, AI_MINUTE_REQUEST_LIMIT=5
    )
    client, _ = register(application)
    cookie = client.get_cookie(application.config["SESSION_COOKIE_NAME"])
    settings = dict(application.config)
    settings["AUTO_INIT_DB"] = False
    settings["RATELIMIT_KEY_PREFIX"] = "synthetic-process-quota"
    context = multiprocessing.get_context("spawn")
    results = context.Queue()
    barrier = context.Barrier(4)
    workers = [
        context.Process(
            target=_process_worker,
            args=(
                settings,
                (cookie.key, cookie.value),
                local_redis.address,
                barrier,
                results,
            ),
        )
        for _ in range(4)
    ]
    try:
        for worker in workers:
            worker.start()
        reports = [results.get(timeout=30) for _ in workers]
        for worker in workers:
            worker.join(timeout=5)
            assert worker.exitcode == 0
        assert all(error is None for _, _, _, error in reports), reports
        assert all(network_attempts == 0 for _, _, network_attempts, _ in reports)
        outcomes = [status for statuses, _, _, _ in reports for status in statuses]
        assert outcomes.count(200) == 5
        assert outcomes.count(429) == 15
        assert sum(calls for _, calls, _, _ in reports) == 5
        assert parent_provider.calls == []
        assert (
            Path(
                application.config["SQLALCHEMY_DATABASE_URI"].removeprefix("sqlite:///")
            )
            .resolve()
            .is_relative_to(tmp_path.resolve())
        )
    finally:
        for worker in workers:
            if worker.is_alive():
                worker.terminate()
                worker.join(timeout=5)
        results.close()
        results.join_thread()


def test_redis_outage_fails_closed_before_any_provider_call(
    quota_factory,
    local_redis,
):
    application, provider = shared_app(quota_factory, local_redis)
    client, owner = register(application)
    token = client.get("/api/csrf").get_json()["csrfToken"]
    local_redis.stop()
    response = client.post(
        "/api/lessons/greetings/explain",
        json={},
        headers={"X-CSRFToken": token},
    )
    # The normal HTTP limiter rejects before the endpoint on a store outage.
    # The paid quota helper additionally fails closed if reached independently.
    assert response.status_code == 500
    assert response.get_json()["error"]["code"] == "INTERNAL"
    assert response.headers["Cache-Control"] == "no-store"
    assert "redis" not in response.get_data(as_text=True).lower()
    assert "127.0.0.1" not in response.get_data(as_text=True)
    with application.test_request_context("/api/lessons/greetings/explain"):
        login_user(db.session.get(User, owner))
        with pytest.raises(AppError) as refusal:
            explain_again(owner, "greetings")
        assert refusal.value.status == 503
        assert refusal.value.code == "AI_UNAVAILABLE"
        assert "redis" not in refusal.value.message.lower()
    assert provider.calls == []
