# FNAAD Admin Dashboard

Web admin dashboard for FNAAD Marketplace. React + Vite + TypeScript + Tailwind, talking to the same Django REST Framework backend as the mobile app.

## Setup

```bash
cd fnaad-admin
npm install
npm run dev
```

Opens at http://localhost:5173.

## ⚠️ Before it works — check these against your actual backend

1. **`src/services/api.ts` → `API_BASE_URL`**
   Currently `http://192.168.1.163:8000/api`. Update if your DRF app doesn't sit at `/api`.

2. **Login endpoint** (`login()` in `api.ts`)
   Currently posts to `/token/` (simplejwt default). If your `urls.py` uses a different path (e.g. `/auth/login/`), update it there.

3. **Refresh endpoint** (in the response interceptor)
   Currently `/token/refresh/`. Same deal — match your actual `urls.py`.

4. **Admin data endpoints** (`getAdminDashboard`, `getPendingProducts`, `approveProduct`, `getAdminArtists`, `verifyArtist`, `suspendArtist`, `getReportedConversations`)
   These are guesses based on your mobile app's naming pattern (`/admin/dashboard/`, `/admin/products/pending/`, etc). Check against your actual `urls.py` and fix any mismatches — this is the main thing to verify before the dashboard/moderation/artists pages will show real data.

5. **CORS**: since this is now a separate web origin (`localhost:5173`) hitting your Django API, make sure `django-cors-headers` is installed and `CORS_ALLOWED_ORIGINS` includes `http://localhost:5173` (and your production domain later).

6. **Only superadmins should reach this app.** The JWT login will succeed for any user — add a check (either backend-side on the admin endpoints, or here in `AuthContext` by checking `role` from a `/me/` call after login) so a regular artist/customer account can't get in even if they somehow authenticate.

## What's built

- Login page (JWT auth, access token stored + auto-refresh on 401)
- Protected routing — redirects to `/login` if not authenticated
- Sidebar navigation: Dashboard / Modération / Artistes / Signalements
- Dark/gold brand styling matching the mobile app
- Placeholder pages for each section, ready to wire up to real data

## Next steps

- Wire `Dashboard.tsx` to `getAdminDashboard()` — same stat cards as the mobile version
- Wire `Moderation.tsx` to `getPendingProducts()` / `approveProduct()`
- Wire `Artists.tsx` to `getAdminArtists()` / `verifyArtist()` / `suspendArtist()`
- Wire `Reports.tsx` to `getReportedConversations()`
