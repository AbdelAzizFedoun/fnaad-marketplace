import axios from "axios";

const normalizeApiBaseUrl = (raw?: string) => {
  // No hardcoded tunnel URL: the API base comes from
  // VITE_API_BASE_URL (see fnaad-admin/.env). An empty
  // value falls back to a relative "/api" so the panel
  // works when served from the same origin as the API.
  const trimmed = (raw || "").trim().replace(/\/+$/, "");
  return trimmed.endsWith("/api") ? trimmed : `${trimmed}/api`;
};

export const API_BASE_URL = normalizeApiBaseUrl(import.meta.env.VITE_API_BASE_URL);

if (!import.meta.env.VITE_API_BASE_URL) {
  console.warn(
    "[admin api] VITE_API_BASE_URL is not set — using relative /api. " +
      "Set it in fnaad-admin/.env."
  );
}

export const api = axios.create({
  baseURL: API_BASE_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("fnaad_admin_access");
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (config.headers) {
    config.headers["ngrok-skip-browser-warning"] = "true";
  }
  return config;
});

let isRefreshing = false;
let pendingQueue: (() => void)[] = [];

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (originalRequest.url?.includes("/token/")) {
        return Promise.reject(error);
      }

      originalRequest._retry = true;

      const refreshToken = localStorage.getItem("fnaad_admin_refresh");
      if (!refreshToken) {
        clearSession();
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve) => {
          pendingQueue.push(() => resolve(api(originalRequest)));
        });
      }

      isRefreshing = true;
      try {
      const res = await axios.post(`${API_BASE_URL}/token/refresh/`, {
        refresh: refreshToken,
      });
      const newAccess = res.data.access;
      localStorage.setItem("fnaad_admin_access", newAccess);
      // Rotation invalidates the old refresh token, so the
      // new one must be persisted or the next refresh fails
      // and the admin gets logged out.
      if (res.data.refresh) {
        localStorage.setItem("fnaad_admin_refresh", res.data.refresh);
      }
      pendingQueue.forEach((cb) => cb());
        pendingQueue = [];
        return api(originalRequest);
      } catch (refreshErr) {
        clearSession();
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

function clearSession() {
  const refreshToken = localStorage.getItem("fnaad_admin_refresh");
  if (refreshToken) {
    // Blacklist server-side so the token can no longer
    // mint access tokens (real logout, not just local).
    axios
      .post(`${API_BASE_URL}/token/blacklist/`, { refresh: refreshToken })
      .catch(() => {});
  }
  localStorage.removeItem("fnaad_admin_access");
  localStorage.removeItem("fnaad_admin_refresh");
  if (window.location.pathname !== "/login") {
    window.location.href = "/login";
  }
}

// ---- Auth ----
export const login = (email: string, password: string) =>
  axios.post(`${API_BASE_URL}/token/`, { email, password });

export const getMe = () => api.get("/accounts/me/");

// ---- Admin dashboard ----
export const getAdminDashboard = () => api.get("/catalog/admin/dashboard/");
export const getRegistrationStats = () => api.get("/catalog/admin/registrations/");

// ---- Moderation ----
export const getPendingProducts = () => api.get("/catalog/products/pending/");
export const approveProduct = (id: number, status: "approved" | "rejected") =>
  api.patch(`/catalog/products/${id}/approve/`, { status });

// ---- Site settings (approval toggle) ----
export const getSiteSettings = () => api.get("/catalog/admin/settings/");
export const updateSiteSettings = (data: { require_product_approval: boolean }) =>
  api.patch("/catalog/admin/settings/", data);

// ---- Artists ----
export const getAdminArtists = () => api.get("/catalog/admin/artists/");
export const verifyArtist = (id: number, isVerified: boolean) =>
  api.patch(`/catalog/admin/artists/${id}/verify/`, { is_verified: isVerified });
export const suspendArtist = (id: number, isSuspended: boolean, reason?: string) =>
  api.patch(`/catalog/admin/artists/${id}/suspend/`, { is_suspended: isSuspended, reason: reason || "" });

// ---- Subscriptions ----
export const getAdminSubscriptions = () => api.get("/billing/admin/subscriptions/");
export const activateSubscription = (id: number, days: number) =>
  api.patch(`/billing/admin/subscriptions/${id}/activate/`, { action: "activate", days });
export const cancelSubscription = (id: number) =>
  api.patch(`/billing/admin/subscriptions/${id}/activate/`, { action: "cancel" });

// ---- Reports ----
export const getReportedConversations = () => api.get("/catalog/admin/reported-conversations/");

export const resolveMediaUrl = (path?: string | null) => {
  if (!path) return null;
  const origin = API_BASE_URL.replace(/\/api\/?$/, "");
  try {
    const url = new URL(path, origin);
    return `${origin}${url.pathname}${url.search}`;
  } catch {
    return `${origin}/${path.replace(/^\/+/, "")}`;
  }
};

export const fetchMediaBlob = async (uri: string, signal: AbortSignal) => {
  const response = await fetch(uri, {
    headers: { "ngrok-skip-browser-warning": "true" },
    signal,
  });
  if (!response.ok) {
    throw new Error(`Image request failed with status ${response.status}`);
  }

  const blob = await response.blob();
  if (blob.type.startsWith("image/")) return blob;

  const extension = new URL(uri).pathname.split(".").pop()?.toLowerCase();
  const imageType =
    extension === "webp" ? "image/webp" :
    extension === "png" ? "image/png" :
    extension === "gif" ? "image/gif" :
    extension === "jpg" || extension === "jpeg" ? "image/jpeg" :
    null;
  if (!imageType) {
    throw new Error(`Image request returned an unexpected content type: ${blob.type || "unknown"}`);
  }

  return new Blob([blob], { type: imageType });
};
