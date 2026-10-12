"""Single-host SQLite deployment, behind a trusted HTTPS reverse proxy."""

bind = "127.0.0.1:8000"
workers = 1
worker_class = "gthread"
threads = 4
timeout = 150
graceful_timeout = 150
keepalive = 5
preload_app = False

# ProxyFix has the configured trust boundary; avoid a second header interpreter.
forwarded_allow_ips = ""

# Reset tokens are embedded in URL paths. Never log raw request targets.
accesslog = None
errorlog = "-"
loglevel = "warning"
capture_output = False
