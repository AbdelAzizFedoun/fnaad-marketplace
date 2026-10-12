# FNAAD — production deployment runbook

Target: a Linux server (Debian/Ubuntu) with a domain pointing at it.

## 1. Server prerequisites

```bash
sudo apt update
sudo apt install -y python3 python3-venv postgresql nginx certbot python3-certbot-nginx

# Dedicated user for the app
sudo adduser --system --group fnaad
sudo mkdir -p /opt/fnaad
sudo chown fnaad:fnaad /opt/fnaad
```

## 2. Code + virtualenv

```bash
# Copy the project to /opt/fnaad (fnaad-backend, fnaad-admin, fnaad-frontend)
cd /opt/fnaad/fnaad-backend
python3 -m venv venv
venv/bin/pip install --upgrade pip
venv/bin/pip install -r requirements.txt
```

## 3. PostgreSQL database

```bash
sudo -u postgres psql -c "CREATE DATABASE fnaad;"
sudo -u postgres psql -c "CREATE USER fnaad WITH PASSWORD 'change-me-strong';"
sudo -u postgres psql -c "ALTER ROLE fnaad SET client_encoding TO 'utf8';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE fnaad TO fnaad;"
```

## 4. Environment file

```bash
cd /opt/fnaad/fnaad-backend
cp .env.example .env
# Then edit .env — see the production values below
chmod 600 .env
```

Production values that MUST be set (generate a key with
`python -c "import secrets; print(secrets.token_urlsafe(50))"`):

```
DB_ENGINE=django.db.backends.postgresql
DB_NAME=fnaad
DB_USER=fnaad
DB_PASSWORD=change-me-strong
DB_HOST=localhost
DB_PORT=5432
DB_CONN_MAX_AGE=60

SECRET_KEY=<generated>
DEBUG=false
ALLOWED_HOSTS=api.your-domain.com
CORS_ALLOW_ALL_ORIGINS=false
CORS_ALLOWED_ORIGINS=https://admin.your-domain.com,https://www.your-domain.com
SITE_BASE_URL=https://www.your-domain.com

CAMPAY_BASE_URL=https://campay.net/api        # live endpoint
CAMPAY_USERNAME=<live username>
CAMPAY_PASSWORD=<live password>
CAMPAY_WEBHOOK_KEY=<live webhook key>

EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=true
EMAIL_HOST_USER=<email>
EMAIL_HOST_PASSWORD=<app password>
DEFAULT_FROM_EMAIL=<email>
```

## 5. Static files + migrations

```bash
venv/bin/python manage.py migrate
venv/bin/python manage.py collectstatic --noinput
```

## 6. gunicorn service

```bash
sudo cp deploy/fnaad-gunicorn.service /etc/systemd/system/fnaad.service
sudo systemctl daemon-reload
sudo systemctl enable --now fnaad
sudo systemctl status fnaad
```

## 7. nginx + HTTPS

```bash
sudo cp deploy/fnaad-nginx.conf /etc/nginx/sites-available/fnaad
sudo ln -s /etc/nginx/sites-available/fnaad /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t
sudo certbot --nginx -d api.your-domain.com -d admin.your-domain.com -d www.your-domain.com
sudo systemctl reload nginx
```

## 8. Frontend builds

```bash
# Admin panel — set fnaad-admin/.env first:
#   VITE_API_BASE_URL=https://api.your-domain.com/api
cd /opt/fnaad/fnaad-admin
npm ci
npm run build          # outputs dist/

# Expo web build — set fnaad-frontend/.env first:
#   EXPO_PUBLIC_API_BASE_URL=https://api.your-domain.com/api
#   EXPO_PUBLIC_API_ORIGIN=https://api.your-domain.com
cd /opt/fnaad/fnaad-frontend
npx expo export --platform web   # outputs dist/
```

For native apps (Play Store / App Store), the same two Expo env vars are
baked in at build time — rebuild with EAS (`eas build -p android --profile production`).

## 9. Post-deploy checklist

- [ ] `https://api.your-domain.com/api/` returns the API root JSON
- [ ] `https://api.your-domain.com/api/catalog/products/` returns paginated products
- [ ] `https://admin.your-domain.com` loads the login page
- [ ] Log in to the admin panel, open Registrations — data loads
- [ ] `DEBUG=false` confirmed (visit a missing route — no traceback page)
- [ ] Upload a photo from the app — `/media/...` loads in the app
- [ ] CamPay payment flow tested with the live endpoint
- [ ] `sudo systemctl status fnaad` — active, no restarts
- [ ] Postgres auto-starts on reboot: `sudo systemctl is-enabled postgresql`

## Notes

- Re-run `collectstatic --noinput` after every backend deploy (WhiteNoise uses manifest storage).
- Keep `fnaad-backend/.env` at `chmod 600`, owned by `root:fnaad` (systemd reads it as root).
- Back up the Postgres data dir (`/var/lib/postgresql/...`) and `fnaad-backend/media/`.
- The CamPay webhook endpoint must be publicly reachable: `https://api.your-domain.com/api/billing/campay/webhook/` (verify the exact path in `billing/urls.py`).
