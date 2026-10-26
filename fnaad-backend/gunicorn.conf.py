import os

# Automatically bind to Render's dynamic $PORT or default to 8000
port = os.getenv("PORT", "8000")
bind = f"0.0.0.0:{port}"
workers = int(os.getenv("WEB_CONCURRENCY", "2"))
threads = 4
timeout = 120
accesslog = "-"
errorlog = "-"

