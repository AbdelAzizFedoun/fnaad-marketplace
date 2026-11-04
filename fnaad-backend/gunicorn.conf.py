import os

# Automatically bind to Render's dynamic $PORT or default to 8000
port = os.getenv("PORT", "8000")
bind = f"0.0.0.0:{port}"
workers = int(os.getenv("WEB_CONCURRENCY", "2"))
threads = 4
timeout = 120
accesslog = "-"
errorlog = "-"


def on_starting(server):
    """Run database migrations when Gunicorn master process boots up."""
    server.log.info("Checking and running database migrations...")
    try:
        import django
        os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
        django.setup()
        from django.core.management import call_command
        call_command("migrate", interactive=False)
        server.log.info("Database migrations completed successfully.")
    except Exception as exc:
        server.log.error(f"Automatic migration failed during startup: {exc}")


