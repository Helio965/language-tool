"""Jornadas educacionais reais e regressões de pontuação, repetição e revisão."""

from datetime import datetime, timedelta, timezone
import pytest
from sqlalchemy import func, select
from content import catalog
from extensions import db
from models import (
    ExerciseAttempt,
    LearningProfile,
    Preferences,
    Progress,
    Review,
    UserVocabulary,
)
from services import aprendizagem, nivelamento, revisao
from services.exercicios import grade_closed_exercise, normalize_answer

PROFILE = {
    "goal": "conversation",
    "perceivedLevel": "unknown",
    "priorExperience": "school",
    "conversationInterest": True,
    "professionalInterest": False,
    "interestAreas": ["technology"],
}


def register(client, email="learner@example.com"):
    response = client.post(
        "/api/auth/register",
        json={
            "name": "Aluno Teste",
            "email": email,
            "password": "segura123",
            "passwordConfirmation": "segura123",
            "acceptedTerms": True,
        },
    )
    assert response.status_code == 201, response.get_json()
    assert client.put("/api/me/profile", json=PROFILE).status_code == 200
    return response.get_json()["user"]["id"]


def ready(client, email="learner@example.com"):
    identifier = register(client, email)
    assert client.post("/api/placement/skip", json={}).status_code == 200
    return identifier


def post_answer(client, lesson_id, exercise, answer=None, key=None):
    if answer is None:
        answer = (
            exercise["acceptedAnswers"][0]
            if exercise["type"] != "write"
            else written_answer(exercise)
        )
    headers = {"Idempotency-Key": key} if key else {}
    return client.post(
        f"/api/lessons/{lesson_id}/exercises/{exercise['id']}/answer",
        json={"answer": answer},
        headers=headers,
    )


def written_answer(exercise):
    examples = {
        "greetings-5": "Hello, my name is Ana.",
        "to-be-6": "I am happy today.",
        "present-5": "She works in a hospital.",
    }
    return examples.get(exercise["id"], "I work in a hospital every day.")


def finish_lesson(client, lesson_id="greetings", wrong=False):
    assert client.post(f"/api/lessons/{lesson_id}/start", json={}).status_code == 204
    for exercise in catalog.lesson(lesson_id)["exercises"]:
        answer = "unrelated incorrect answer" if wrong else None
        response = post_answer(client, lesson_id, exercise, answer)
        assert response.status_code == 200, response.get_json()
    response = client.post(
        f"/api/lessons/{lesson_id}/complete", json={"timeSpentSeconds": 300}
    )
    assert response.status_code == 200, response.get_json()
    return response.get_json()


def review_session(client, kind="lesson"):
    queue = client.get("/api/reviews").get_json()
    item = next(item for item in queue["due"] if item["kind"] == kind)
    response = client.post(f"/api/reviews/{item['id']}/session", json={})
    assert response.status_code == 200, response.get_json()
    return item, response.get_json()


def respond_review(client, item, session, wrong=False):
    for public in session["exercises"]:
        exercise = catalog.exercise(public["id"])["exercise"]
        answer = (
            next(
                option
                for option in exercise.get("options", [])
                if normalize_answer(option)
                != normalize_answer(exercise["acceptedAnswers"][0])
            )
            if wrong and exercise.get("options")
            else "wrong answer"
            if wrong
            else exercise["acceptedAnswers"][0]
        )
        response = client.post(
            f"/api/reviews/{item['id']}/answers",
            json={"exerciseId": exercise["id"], "answer": answer},
        )
        assert response.status_code == 200, response.get_json()


def test_authentication_required(client):
    for path in (
        "/api/home",
        "/api/progress",
        "/api/lessons",
        "/api/reviews",
        "/api/vocabulary",
    ):
        assert client.get(path).status_code == 401


def test_catalog_preserves_original_content():
    assert len(catalog.lessons()) == 12
    assert sum(len(item["exercises"]) for item in catalog.lessons()) == 65
    assert len(catalog.vocabulary()) == 67
    assert len(catalog.placement_questions()) == 12
    assert len(catalog.topics()) == 8
    for lesson in catalog.lessons():
        assert len(catalog.topic(f"lesson:{lesson['id']}")["questions"]) > 2
        assert all(
            catalog.vocabulary_entry(identifier)
            for identifier in lesson["vocabularyIds"]
        )
        for exercise in lesson["exercises"]:
            public = catalog.to_public_exercise(exercise)
            assert (
                not {"acceptedAnswers", "explanation", "requirements"} & public.keys()
            )


@pytest.mark.parametrize(
    "exercise_id,answer,status",
    [
        ("to-be-5", "he’s happy!", "correct"),
        ("greetings-4", "What is your name", "correct"),
        ("present-1", "go", "incorrect"),
        ("present-6", "She studies English everyday.", "almost"),
    ],
)
def test_deterministic_grading(exercise_id, answer, status):
    assert (
        grade_closed_exercise(catalog.exercise(exercise_id)["exercise"], answer)[
            "status"
        ]
        == status
    )


def test_new_user_journey_and_server_progress(client, app):
    user_id = register(client)
    step = client.post("/api/placement/start", json={}).get_json()
    assert step["stageNumber"] == 1
    assert all("answer" not in question for question in step["questions"])
    first_answers = {
        question["id"]: question["answer"]
        for question in catalog.placement_questions()
        if question["stage"] == "beginner"
    }
    step = client.post(
        "/api/placement/answers", json={"answers": first_answers}
    ).get_json()
    assert step["stageNumber"] == 2
    second_answers = {
        question["id"]: next(
            option for option in question["options"] if option != question["answer"]
        )
        for question in catalog.placement_questions()
        if question["stage"] == "basic"
    }
    response = client.post(
        "/api/placement/answers", json={"answers": {**first_answers, **second_answers}}
    )
    assert response.status_code == 200
    assert response.get_json()["result"]["level"] == "basic"
    assert "estimativa" in response.get_json()["result"]["notice"]
    assert (
        client.get("/api/home").get_json()["continueLesson"]["id"] == "simple-present"
    )
    finish_lesson(client, "simple-present", wrong=True)
    progress = client.get("/api/progress").get_json()
    assert progress["totals"]["lessonsCompleted"] == 1
    assert progress["totals"]["exercisesDone"] == 6
    assert progress["totals"]["accuracy"] == 0
    assert progress["totals"]["studyMinutes"] == 5
    assert {"errors", "low_score"}.issubset(
        {item["reason"] for item in progress["needsReview"]}
    )
    with app.app_context():
        assert db.session.get(Progress, (user_id, "simple-present")).score == 0


def test_placement_rejects_future_stage_malformed_and_retroactive_changes(client, app):
    register(client)
    client.post("/api/placement/start", json={})
    future = client.post("/api/placement/answers", json={"answers": {"p5": "goes"}})
    assert future.status_code == 400
    assert (
        client.post("/api/placement/answers", json={"answers": {"p1": ""}}).status_code
        == 400
    )
    assert (
        client.post(
            "/api/placement/answers", json={"answers": {"p1": "non-option"}}
        ).status_code
        == 400
    )
    first = {
        question["id"]: question["answer"]
        for question in catalog.placement_questions()
        if question["stage"] == "beginner"
    }
    assert (
        client.post("/api/placement/answers", json={"answers": first}).get_json()[
            "stageNumber"
        ]
        == 2
    )
    assert (
        client.post(
            "/api/placement/answers", json={"answers": {**first, "p1": "are"}}
        ).status_code
        == 409
    )


def test_placement_completion_retry_does_not_duplicate_attempts(client, app):
    user_id = register(client)
    client.post("/api/placement/start", json={})
    answers = {
        question["id"]: next(
            option for option in question["options"] if option != question["answer"]
        )
        for question in catalog.placement_questions()
        if question["stage"] == "beginner"
    }
    result = client.post("/api/placement/answers", json={"answers": answers}).get_json()
    assert result["status"] == "done"
    assert (
        client.post("/api/placement/answers", json={"answers": answers}).get_json()
        == result
    )
    with app.app_context():
        assert (
            db.session.scalar(
                select(func.count())
                .select_from(ExerciseAttempt)
                .where(ExerciseAttempt.user_id == user_id)
            )
            == 4
        )


def test_lesson_requires_placement_and_all_exercises(client, app):
    user_id = register(client)
    assert client.post("/api/lessons/greetings/start", json={}).status_code == 409
    client.post("/api/placement/skip", json={})
    assert client.post("/api/lessons/greetings/complete", json={}).status_code == 409
    client.post("/api/lessons/greetings/start", json={})
    assert client.post("/api/lessons/greetings/complete", json={}).status_code == 409
    assert (
        post_answer(
            client, "greetings", catalog.lesson("greetings")["exercises"][0]
        ).status_code
        == 200
    )
    assert client.post("/api/lessons/greetings/complete", json={}).status_code == 409
    with app.app_context():
        row = db.session.get(Progress, (user_id, "greetings"))
        assert row.status == "in_progress" and row.completed_at is None
        assert (
            db.session.scalar(
                select(func.count())
                .select_from(UserVocabulary)
                .where(UserVocabulary.user_id == user_id)
            )
            == 0
        )


def test_answer_retry_and_start_retry_preserve_first_attempt_and_resume(client, app):
    user_id = ready(client)
    lesson = catalog.lesson("greetings")
    client.post("/api/lessons/greetings/start", json={})
    wrong = post_answer(
        client, "greetings", lesson["exercises"][0], "incorrect", "unique-send"
    )
    assert wrong.status_code == 200
    assert (
        post_answer(
            client, "greetings", lesson["exercises"][0], "incorrect", "unique-send"
        ).get_json()
        == wrong.get_json()
    )
    assert (
        post_answer(
            client, "greetings", lesson["exercises"][0], "other", "unique-send"
        ).status_code
        == 409
    )
    assert client.post("/api/lessons/greetings/start", json={}).status_code == 204
    assert client.get("/api/lessons/greetings").get_json()["answeredExerciseIds"] == [
        lesson["exercises"][0]["id"]
    ]
    assert post_answer(client, "greetings", lesson["exercises"][0]).status_code == 200
    for exercise in lesson["exercises"][1:]:
        assert post_answer(client, "greetings", exercise).status_code == 200
    result = client.post(
        "/api/lessons/greetings/complete", json={"timeSpentSeconds": 60}
    ).get_json()
    assert result["correct"] <= len(lesson["exercises"]) - 1
    with app.app_context():
        assert (
            db.session.scalar(
                select(func.count())
                .select_from(ExerciseAttempt)
                .where(ExerciseAttempt.user_id == user_id)
            )
            == len(lesson["exercises"]) + 1
        )


def test_lesson_completion_idempotent_and_replay_explicit(client, app):
    user_id = ready(client)
    result = finish_lesson(client)
    assert (
        client.post(
            "/api/lessons/greetings/complete", json={"timeSpentSeconds": 600}
        ).get_json()
        == result
    )
    with app.app_context():
        assert (
            db.session.get(Progress, (user_id, "greetings")).time_spent_seconds == 300
        )
        before_words = db.session.scalar(
            select(func.count())
            .select_from(UserVocabulary)
            .where(UserVocabulary.user_id == user_id)
        )
    assert client.post("/api/lessons/greetings/start", json={}).status_code == 204
    assert client.get("/api/lessons/greetings").get_json()["answeredExerciseIds"] == []
    assert client.post("/api/lessons/greetings/complete", json={}).status_code == 409
    with app.app_context():
        row = db.session.get(Progress, (user_id, "greetings"))
        assert row.status == "completed"
        assert row.time_spent_seconds == 300
        assert (
            db.session.scalar(
                select(func.count())
                .select_from(UserVocabulary)
                .where(UserVocabulary.user_id == user_id)
            )
            == before_words
        )


def test_open_write_grammar_is_graded_even_with_light_preferences(client):
    ready(client)
    client.patch("/api/me/preferences", json={"correctionIntensity": "light"})
    client.post("/api/lessons/simple-present/start", json={})
    exercise = catalog.exercise("present-5")["exercise"]
    feedback = post_answer(
        client, "simple-present", exercise, "She go to school every day."
    ).get_json()
    assert feedback["status"] == "incorrect"
    assert feedback["correction"]["suggestion"] == "She goes to school every day."


def test_review_rejects_unrelated_exercise_empty_completion_and_forged_counts(
    client, app
):
    user_id = ready(client)
    finish_lesson(client, wrong=True)
    item, session = review_session(client)
    assert (
        client.post(
            f"/api/reviews/{item['id']}/complete", json={"correct": 100, "total": 100}
        ).status_code
        == 409
    )
    unrelated = next(
        exercise["id"]
        for lesson in catalog.lessons()
        for exercise in lesson["exercises"]
        if exercise["id"] not in {public["id"] for public in session["exercises"]}
    )
    assert (
        client.post(
            f"/api/reviews/{item['id']}/answers",
            json={"exerciseId": unrelated, "answer": "hello"},
        ).status_code
        == 404
    )
    respond_review(client, item, session, wrong=True)
    result = client.post(
        f"/api/reviews/{item['id']}/complete",
        json={"correct": 100, "total": 100, "timeSpentSeconds": 60},
    ).get_json()
    assert result["score"] == 0 and result["correct"] == 0
    assert result["total"] == len(session["exercises"])
    assert (
        client.post(
            f"/api/reviews/{item['id']}/complete",
            json={"correct": 100, "total": 100, "timeSpentSeconds": 600},
        ).get_json()
        == result
    )
    client.get("/api/reviews")
    client.get("/api/reviews")
    with app.app_context():
        row = db.session.get(Review, item["id"])
        assert row.times_reviewed == 1 and row.time_spent_seconds == 60
        assert (
            db.session.scalar(
                select(func.count())
                .select_from(Review)
                .where(
                    Review.user_id == user_id,
                    Review.kind == item["kind"],
                    Review.ref_id == row.ref_id,
                    Review.status == "pending",
                )
            )
            == 1
        )


def test_reviews_owned_by_account(client, app):
    ready(client)
    finish_lesson(client, wrong=True)
    item, _ = review_session(client)
    client.post("/api/auth/logout", json={})
    ready(client, "other@example.com")
    assert client.post(f"/api/reviews/{item['id']}/session", json={}).status_code == 404
    assert (
        client.post(
            f"/api/reviews/{item['id']}/answers",
            json={"exerciseId": "greetings-1", "answer": "Hello"},
        ).status_code
        == 404
    )
    assert (
        client.post(f"/api/reviews/{item['id']}/complete", json={}).status_code == 404
    )


def test_failed_word_reviews_never_become_learned_and_retry_is_once(client, app):
    user_id = ready(client)
    client.put("/api/vocabulary/red/status", json={"status": "learning"})
    with app.app_context():
        word = db.session.get(UserVocabulary, (user_id, "red"))
        word.next_review_at = "2020-01-01T00:00:00.000Z"
        word.times_reviewed = 5
        word.success_streak = 0
        db.session.commit()
    item, session = review_session(client, "vocabulary")
    first = session["exercises"][0]
    answer = next(option for option in first["options"] if option != "vermelho")
    payload = {"exerciseId": first["id"], "answer": answer}
    for _ in range(3):
        assert (
            client.post(f"/api/reviews/{item['id']}/answers", json=payload).status_code
            == 200
        )
    result = client.post(
        f"/api/reviews/{item['id']}/complete",
        json={"correct": 100, "total": 100, "timeSpentSeconds": 30},
    )
    assert result.status_code == 200
    with app.app_context():
        word = db.session.get(UserVocabulary, (user_id, "red"))
        assert word.status == "learning"
        assert word.times_reviewed == 6 and word.success_streak == 0
        assert word.next_review_at > "2020-01-01T00:00:00.000Z"
        assert (
            db.session.scalar(
                select(func.count())
                .select_from(ExerciseAttempt)
                .where(ExerciseAttempt.review_id == item["id"])
            )
            == 1
        )


def test_level_promotion_requires_all_lessons_and_threshold(client, app):
    user_id = ready(client)
    with app.app_context():
        beginner = [
            lesson for lesson in catalog.lessons() if lesson["level"] == "beginner"
        ]
        records = [
            Progress(
                user_id=user_id,
                lesson_id=lesson["id"],
                status="completed",
                correct_count=4,
                total_count=5,
                score=80,
                time_spent_seconds=0,
                started_at="2026-01-01T00:00:00.000Z",
                completed_at="2026-01-01T00:00:00.000Z",
                updated_at="2026-01-01T00:00:00.000Z",
            )
            for lesson in beginner
        ]
        assert (
            aprendizagem.should_level_up("beginner", catalog.lessons(), records)
            == "basic"
        )
        assert (
            aprendizagem.should_level_up("beginner", catalog.lessons(), records[:-1])
            is None
        )
        for record in records:
            record.score = 40
        assert (
            aprendizagem.should_level_up("beginner", catalog.lessons(), records) is None
        )


def test_progress_uses_configured_timezone_and_streak(client, app):
    user_id = ready(client)
    app.config["NOW"] = lambda: datetime(2026, 3, 3, 1, 0, tzinfo=timezone.utc)
    with app.app_context():
        db.session.add(
            ExerciseAttempt(
                id="timezone-attempt",
                user_id=user_id,
                exercise_id="greetings-1",
                lesson_id="greetings",
                skill_tag="greetings",
                context="lesson",
                answer="Hello",
                is_correct=True,
                created_at="2026-03-03T00:00:00.000Z",
            )
        )
        db.session.commit()
    progress = client.get("/api/progress").get_json()
    assert progress["week"][-1]["date"] == "2026-03-02"
    assert progress["week"][-1]["active"] is True
    assert progress["totals"]["streakDays"] == 1
    assert progress["totals"]["accuracy"] == 100


def test_lesson_completion_failure_rolls_back_progress_and_words(
    client, app, monkeypatch
):
    from sqlalchemy.exc import SQLAlchemyError

    user_id = ready(client)
    lesson = catalog.lesson("greetings")
    client.post("/api/lessons/greetings/start", json={})
    for exercise in lesson["exercises"]:
        assert post_answer(client, "greetings", exercise).status_code == 200

    def fail_commit():
        raise SQLAlchemyError("injected storage failure")

    with monkeypatch.context() as patch:
        patch.setattr(db.session, "commit", fail_commit)
        response = client.post(
            "/api/lessons/greetings/complete", json={"timeSpentSeconds": 300}
        )
        assert response.status_code == 500
    with app.app_context():
        row = db.session.get(Progress, (user_id, "greetings"))
        assert row.status == "in_progress"
        assert row.completion_result is None
        assert row.time_spent_seconds == 0
        assert (
            db.session.scalar(
                select(func.count())
                .select_from(UserVocabulary)
                .where(UserVocabulary.user_id == user_id)
            )
            == 0
        )
    assert (
        client.post(
            "/api/lessons/greetings/complete", json={"timeSpentSeconds": 300}
        ).status_code
        == 200
    )


def test_review_completion_failure_rolls_back_result_and_schedule(
    client, app, monkeypatch
):
    from sqlalchemy.exc import SQLAlchemyError

    user_id = ready(client)
    finish_lesson(client, wrong=True)
    item, session = review_session(client)
    respond_review(client, item, session)

    def fail_commit():
        raise SQLAlchemyError("injected storage failure")

    with monkeypatch.context() as patch:
        patch.setattr(db.session, "commit", fail_commit)
        response = client.post(
            f"/api/reviews/{item['id']}/complete", json={"timeSpentSeconds": 60}
        )
        assert response.status_code == 500
    with app.app_context():
        row = db.session.get(Review, item["id"])
        assert row.status == "pending" and row.times_reviewed == 0
        assert row.completion_result is None
        assert (
            db.session.scalar(
                select(func.count())
                .select_from(Review)
                .where(
                    Review.user_id == user_id,
                    Review.kind == row.kind,
                    Review.ref_id == row.ref_id,
                )
            )
            == 1
        )
    assert (
        client.post(
            f"/api/reviews/{item['id']}/complete", json={"timeSpentSeconds": 60}
        ).status_code
        == 200
    )


def test_parallel_lesson_answer_and_completion_are_idempotent(client, app):
    from concurrent.futures import ThreadPoolExecutor
    from threading import Barrier

    user_id = ready(client)
    lesson = catalog.lesson("greetings")
    client.post("/api/lessons/greetings/start", json={})
    cookie_name = app.config["SESSION_COOKIE_NAME"]
    cookie = client.get_cookie(cookie_name).value

    def parallel_post(path, payload, headers=None):
        barrier = Barrier(4)

        def send(_):
            with app.test_client() as parallel:
                parallel.set_cookie(cookie_name, cookie)
                barrier.wait(timeout=10)
                response = parallel.post(path, json=payload, headers=headers or {})
                return response.status_code, response.get_json()

        with ThreadPoolExecutor(max_workers=4) as pool:
            return list(pool.map(send, range(4)))

    first = lesson["exercises"][0]
    path = f"/api/lessons/greetings/exercises/{first['id']}/answer"
    responses = parallel_post(
        path,
        {"answer": first["acceptedAnswers"][0]},
        {"Idempotency-Key": "parallel-answer"},
    )
    assert all(code == 200 for code, _ in responses), responses
    assert all(result == responses[0][1] for _, result in responses)
    for exercise in lesson["exercises"][1:]:
        assert post_answer(client, "greetings", exercise).status_code == 200
    responses = parallel_post(
        "/api/lessons/greetings/complete", {"timeSpentSeconds": 300}
    )
    assert all(code == 200 for code, _ in responses), responses
    assert all(result == responses[0][1] for _, result in responses)
    with app.app_context():
        assert (
            db.session.get(Progress, (user_id, "greetings")).time_spent_seconds == 300
        )
        assert db.session.scalar(
            select(func.count())
            .select_from(ExerciseAttempt)
            .where(ExerciseAttempt.user_id == user_id)
        ) == len(lesson["exercises"])


def test_parallel_review_completions_create_one_schedule(client, app):
    from concurrent.futures import ThreadPoolExecutor
    from threading import Barrier

    user_id = ready(client)
    finish_lesson(client, wrong=True)
    item, session = review_session(client)
    respond_review(client, item, session)
    cookie_name = app.config["SESSION_COOKIE_NAME"]
    cookie = client.get_cookie(cookie_name).value
    barrier = Barrier(4)

    def send(_):
        with app.test_client() as parallel:
            parallel.set_cookie(cookie_name, cookie)
            barrier.wait(timeout=10)
            response = parallel.post(
                f"/api/reviews/{item['id']}/complete",
                json={"timeSpentSeconds": 60, "correct": 100, "total": 100},
            )
            return response.status_code, response.get_json()

    with ThreadPoolExecutor(max_workers=4) as pool:
        responses = list(pool.map(send, range(4)))
    assert all(code == 200 for code, _ in responses), responses
    assert all(result == responses[0][1] for _, result in responses)
    with app.app_context():
        row = db.session.get(Review, item["id"])
        assert row.times_reviewed == 1 and row.time_spent_seconds == 60
        assert (
            db.session.scalar(
                select(func.count())
                .select_from(Review)
                .where(
                    Review.user_id == user_id,
                    Review.kind == row.kind,
                    Review.ref_id == row.ref_id,
                    Review.status == "pending",
                )
            )
            == 1
        )


def test_vocabulary_requires_three_successful_sessions_after_a_failure(client, app):
    user_id = ready(client)
    fixed = [datetime(2026, 10, 10, 12, 0, tzinfo=timezone.utc)]
    app.config["NOW"] = lambda: fixed[0]
    client.put("/api/vocabulary/red/status", json={"status": "learning"})
    with app.app_context():
        word = db.session.get(UserVocabulary, (user_id, "red"))
        word.next_review_at = "2020-01-01T00:00:00.000Z"
        db.session.commit()
    for index in range(4):
        item, session = review_session(client, "vocabulary")
        respond_review(client, item, session, wrong=index == 0)
        response = client.post(
            f"/api/reviews/{item['id']}/complete", json={"timeSpentSeconds": 30}
        )
        assert response.status_code == 200, response.get_json()
        with app.app_context():
            word = db.session.get(UserVocabulary, (user_id, "red"))
            assert word.times_reviewed == index + 1
            assert word.success_streak == index
            assert word.status == ("learned" if index == 3 else "learning")
        fixed[0] += timedelta(days=31)


def test_parallel_placement_completion_deduplicates_persisted_attempts(client, app):
    from concurrent.futures import ThreadPoolExecutor
    from threading import Barrier

    user_id = register(client)
    client.post("/api/placement/start", json={})
    answers = {
        question["id"]: next(
            option for option in question["options"] if option != question["answer"]
        )
        for question in catalog.placement_questions()
        if question["stage"] == "beginner"
    }
    cookie_name = app.config["SESSION_COOKIE_NAME"]
    cookie = client.get_cookie(cookie_name).value
    barrier = Barrier(4)

    def send(_):
        with app.test_client() as parallel:
            parallel.set_cookie(cookie_name, cookie)
            barrier.wait(timeout=10)
            response = parallel.post(
                "/api/placement/answers", json={"answers": answers}
            )
            return response.status_code, response.get_json()

    with ThreadPoolExecutor(max_workers=4) as pool:
        responses = list(pool.map(send, range(4)))
    assert all(code == 200 for code, _ in responses), responses
    assert all(result == responses[0][1] for _, result in responses)
    with app.app_context():
        assert (
            db.session.scalar(
                select(func.count())
                .select_from(ExerciseAttempt)
                .where(ExerciseAttempt.user_id == user_id)
            )
            == 4
        )


def test_closed_exercises_never_need_external_ai(client, app, monkeypatch):
    ready(client)
    client.post("/api/lessons/greetings/start", json={})

    def forbid_call(_):
        raise AssertionError("closed exercise must not call AI")

    with monkeypatch.context() as patch:
        patch.setattr(app.extensions["english_ai"], "correct", forbid_call)
        response = post_answer(
            client, "greetings", catalog.lesson("greetings")["exercises"][0]
        )
    assert response.status_code == 200
    assert response.get_json()["status"] == "correct"


def test_open_answer_redacts_personal_data_before_assessment_and_storage(client, app):
    user_id = ready(client)
    client.post("/api/lessons/simple-present/start", json={})
    response = post_answer(
        client,
        "simple-present",
        catalog.exercise("present-5")["exercise"],
        "She works with private@example.com every day.",
    )
    assert response.status_code == 200
    feedback = response.get_json()
    assert "private@example.com" not in str(feedback)
    assert "[dado removido]" in feedback["userAnswer"]
    assert "privacidade" in feedback["notices"][0]
    with app.app_context():
        attempt = db.session.scalar(
            select(ExerciseAttempt).where(ExerciseAttempt.user_id == user_id)
        )
        assert "private@example.com" not in attempt.answer
        assert "private@example.com" not in str(attempt.feedback)


def test_open_assessment_provider_failure_has_no_false_saved_success(
    client, app, monkeypatch
):
    from services.common import AppError

    user_id = ready(client)
    client.post("/api/lessons/simple-present/start", json={})

    def unavailable(_):
        raise AppError(
            "AI_UNAVAILABLE", "O serviço está temporariamente indisponível.", 503
        )

    with monkeypatch.context() as patch:
        patch.setattr(app.extensions["english_ai"], "correct", unavailable)
        response = post_answer(
            client,
            "simple-present",
            catalog.exercise("present-5")["exercise"],
            "She works in a hospital every day.",
        )
    assert response.status_code == 503
    with app.app_context():
        assert (
            db.session.scalar(
                select(func.count())
                .select_from(ExerciseAttempt)
                .where(ExerciseAttempt.user_id == user_id)
            )
            == 0
        )
        assert db.session.get(LearningProfile, user_id).difficulties == []
    assert (
        post_answer(
            client,
            "simple-present",
            catalog.exercise("present-5")["exercise"],
            "She works in a hospital every day.",
        ).status_code
        == 200
    )
