import axios, { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from "axios";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

const normalizeApiBaseUrl = (raw?: string) => {
  // No hardcoded tunnel URL: the API base comes from
  // EXPO_PUBLIC_API_BASE_URL (see fnaad-frontend/.env). An
  // empty value falls back to a relative "/api" so web builds
  // still work from the same origin; native builds need the env.
  const trimmed = (raw || "").trim().replace(/\/+$/, "");
  return trimmed.endsWith("/api") ? trimmed : `${trimmed}/api`;
};

const BASE_URL = normalizeApiBaseUrl(process.env.EXPO_PUBLIC_API_BASE_URL);

if (!process.env.EXPO_PUBLIC_API_BASE_URL) {
  console.warn(
    "[api] EXPO_PUBLIC_API_BASE_URL is not set — using relative /api. " +
      "Set it in fnaad-frontend/.env for native builds."
  );
}
const API_ORIGIN = (
  process.env.EXPO_PUBLIC_API_ORIGIN || BASE_URL.replace(/\/api\/?$/, "")
).trim().replace(/\/+$/, "");

export const getPublicProductUrl = (slug: string) =>
  `${API_ORIGIN}/api/catalog/art/${encodeURIComponent(slug)}/`;

const ACCESS_KEY = "access_token";
const REFRESH_KEY = "refresh_token";

const storage = {
  getItem: (key: string): Promise<string | null> =>
    Platform.OS === "web" ? AsyncStorage.getItem(key) : SecureStore.getItemAsync(key),
  setItem: (key: string, value: string): Promise<void> =>
    Platform.OS === "web"
      ? AsyncStorage.setItem(key, value)
      : (SecureStore.setItemAsync(key, value) as unknown as Promise<void>),
  deleteItem: (key: string): Promise<void> =>
    Platform.OS === "web"
      ? AsyncStorage.removeItem(key)
      : (SecureStore.deleteItemAsync(key) as unknown as Promise<void>),
};

export const getAccessToken = () => storage.getItem(ACCESS_KEY);

// Paginated endpoints answer with {count, next, previous, results};
// plain arrays pass through unchanged, so callers can use one helper.
export const unwrapList = <T,>(data: T[] | { results: T[] }): T[] =>
  Array.isArray(data) ? data : data.results;

export const api = axios.create({
  baseURL: BASE_URL,
});

let isRefreshing = false;
let refreshQueue: ((token: string | null) => void)[] = [];
type AuthRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
  skipAuth?: boolean;
};

api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  // The public catalogue must remain a simple browser GET.  Sending either a
  // Bearer token or the ngrok header makes browsers send a CORS OPTIONS
  // preflight before the request.
  const skipAuth = (config as AuthRequestConfig).skipAuth;
  const token = skipAuth ? null : await storage.getItem(ACCESS_KEY);
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  if (API_ORIGIN.includes("ngrok")) {
    config.headers["ngrok-skip-browser-warning"] = "true";
  }
  return config;
});

api.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as AuthRequestConfig | undefined;

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;

      if (isRefreshing) {
        return new Promise((resolve) => {
          refreshQueue.push((newToken) => {
            if (newToken) {
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
              resolve(api(originalRequest));
            } else {
              resolve(Promise.reject(error));
            }
          });
        });
      }

      isRefreshing = true;

      try {
        const refreshToken = await storage.getItem(REFRESH_KEY);
        if (!refreshToken) throw new Error("No refresh token");

        const res = await axios.post(`${BASE_URL}/token/refresh/`, {
          refresh: refreshToken,
        });

        const newAccessToken = res.data.access;
        // Rotation hands out a new refresh token and blacklists
        // the old one, so it must be persisted — otherwise the
        // next refresh fails and the user gets logged out.
        if (res.data.refresh) {
          await storage.setItem(REFRESH_KEY, res.data.refresh);
        }
        await storage.setItem(ACCESS_KEY, newAccessToken);

        refreshQueue.forEach((cb) => cb(newAccessToken));
        refreshQueue = [];
        isRefreshing = false;

        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        refreshQueue.forEach((cb) => cb(null));
        refreshQueue = [];
        isRefreshing = false;

        await storage.deleteItem(ACCESS_KEY);
        await storage.deleteItem(REFRESH_KEY);

        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export const registerUser = (data: {
  username: string;
  email: string;
  phone_number: string;
  password: string;
  role: "customer" | "artist";
  region?: string;
  gender?: string;
  national_id_number?: string;
}) => api.post("/accounts/register/", data);

export const loginUser = async (email: string, password: string) => {
  const res = await api.post("/token/", { email, password });
  await storage.setItem(ACCESS_KEY, res.data.access);
  await storage.setItem(REFRESH_KEY, res.data.refresh);
  return res;
};

export const logoutUser = async () => {
  // Blacklist the refresh token server-side so it can no longer
  // mint new access tokens — a real logout, not just local cleanup.
  const refreshToken = await storage.getItem(REFRESH_KEY);
  if (refreshToken) {
    try {
      await axios.post(`${BASE_URL}/token/blacklist/`, { refresh: refreshToken });
    } catch {
      // Offline or already expired — local cleanup still applies.
    }
  }
  await storage.deleteItem(ACCESS_KEY);
  await storage.deleteItem(REFRESH_KEY);
};

export const getStoredToken = () => storage.getItem(ACCESS_KEY);

export const isLoggedIn = async (): Promise<boolean> => {
  const token = await storage.getItem(ACCESS_KEY);
  return !!token;
};

export const restoreSession = async (): Promise<boolean> => {
  const token = await storage.getItem(ACCESS_KEY);
  return !!token;
};

export const getMe = () => api.get("/accounts/me/");

export type AssistantChatHistory = { role: "user" | "assistant"; content: string }[];

export const assistantChat = (message: string, history: AssistantChatHistory) =>
  api.post("/catalog/assistant/chat/", { message, history });

export const getProductDetail = (id: number) => api.get(`/catalog/products/${id}/`);

export const createProduct = (data: {
  title: string;
  description: string;
  price_xaf: number;
  category: string;
}) => api.post("/catalog/products/create/", data);

export const uploadProductImage = async (
  productId: number,
  image: { uri: string; fileName?: string | null; mimeType?: string | null; file?: File | null },
  order: number = 0,
  isPrimary: boolean = false
) => {
  const formData = new FormData();
  const fileName = image.fileName || `artwork-${Date.now()}.jpg`;
  const mimeType = image.mimeType || "image/jpeg";
  formData.append("image", Platform.OS === "web" && image.file
    ? image.file
    : ({ uri: image.uri, name: fileName, type: mimeType } as any));
  formData.append("is_primary", isPrimary ? "true" : "false");
  formData.append("order", String(order));

  // Let Axios add the multipart boundary that Django requires to read the file.
  const token = await storage.getItem(ACCESS_KEY);
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  return api.post(`/catalog/products/${productId}/images/`, formData, {
    headers,
  });
};
export const sendInquiry = (productId: number) =>
  api.post("/orders/create/", { product: productId });

export const getMyOrders = () => api.get("/orders/mine/");

export const getPendingProducts = () => api.get("/catalog/products/pending/");

export const approveProduct = (id: number, status: "approved" | "rejected") =>
  api.patch(`/catalog/products/${id}/approve/`, { status });

export const resolveMediaUrl = (path?: string) => {
  if (!path) return null;

  // Django may return an absolute URL built from its internal request host.
  // Always serve media from the same public origin the app uses for the API,
  // so native builds do not try to load an unreachable LAN address.
  // With no configured origin (relative fallback), keep same-origin paths.
  if (!API_ORIGIN) {
    if (path.startsWith("http")) return path.replace(/^https?:\/\/[^/]+/, "");
    return path.startsWith("/") ? path : `/${path}`;
  }
  const url = new URL(path, API_ORIGIN);
  return `${API_ORIGIN}${url.pathname}${url.search}`;
};

export const isNgrokMediaUrl = (uri: string) => {
  if (!API_ORIGIN.includes("ngrok")) return false;

  try {
    return new URL(uri).origin === API_ORIGIN;
  } catch {
    return false;
  }
};

export const fetchNgrokMedia = async (uri: string, signal: AbortSignal): Promise<Blob | null> => {
  try {
    const response = await fetch(uri, {
      headers: { "ngrok-skip-browser-warning": "true" },
      signal,
    });
    if (!response.ok) {
      console.warn(`[MediaImage] Media fetch failed (${response.status}): ${uri}`);
      return null;
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.startsWith("image/")) {
      // ngrok returned an HTML error page — tunnel is down or URL changed
      console.warn(`[MediaImage] Expected image, got "${contentType}" for: ${uri}`);
      return null;
    }

    return response.blob();
  } catch (err: unknown) {
    // AbortError is expected on component unmount — don't warn for those
    if (err instanceof Error && err.name === "AbortError") throw err;
    console.warn(`[MediaImage] fetch error for ${uri}:`, err);
    return null;
  }
};



export const startConversation = (productId: number) =>
  api.post("/catalog/conversations/start/", { product: productId });

export const startCommissionConversation = (commissionResponseId: number) =>
  api.post("/catalog/conversations/start-commission/", { commission_response: commissionResponseId });

export const getMyConversations = () => api.get("/catalog/conversations/");
export const getUnreadMessageCount = () => api.get("/catalog/conversations/unread-count/");

export const getConversationDetail = (id: number) =>
  api.get(`/catalog/conversations/${id}/`);

export const deleteConversationMessages = (conversationId: number, messageIds?: number[]) =>
  api.delete(`/catalog/conversations/${conversationId}/messages/`, {
    data: messageIds ? { message_ids: messageIds } : {},
  });

export const sendMessage = (conversationId: number, text: string, replyToId?: number) =>
  api.post("/catalog/messages/send/", {
    conversation: conversationId,
    text,
    ...(replyToId ? { reply_to_id: replyToId } : {}),
  });

export const toggleMessageReaction = (messageId: number, emoji: string) =>
  api.post(`/catalog/messages/${messageId}/reaction/`, { emoji });

export const editMessage = (messageId: number, text: string) =>
  api.patch(`/catalog/messages/${messageId}/`, { text });

export const forwardMessage = (messageId: number, conversationId: number) =>
  api.post(`/catalog/messages/${messageId}/forward/`, { conversation_id: conversationId });

export const setConversationTyping = (conversationId: number, isTyping: boolean) =>
  api.post(`/catalog/conversations/${conversationId}/typing/`, { is_typing: isTyping });

export const blockConversation = (conversationId: number) =>
  api.post(`/catalog/conversations/${conversationId}/block/`);

export const getBlockedConversations = () => api.get("/catalog/conversations/blocked/");

export const unblockConversation = (conversationId: number) =>
  api.post(`/catalog/conversations/${conversationId}/unblock/`);

export const updateConversationStatus = (
  conversationId: number,
  status: "confirmed" | "cancelled" | "delivered"
) => api.patch(`/catalog/conversations/${conversationId}/status/`, { status });

export const sendLocationMessage = (conversationId: number, latitude: number, longitude: number, replyToId?: number) =>
  api.post("/catalog/messages/send/", {
    conversation: conversationId,
    message_type: "location",
    latitude,
    longitude,
    ...(replyToId ? { reply_to_id: replyToId } : {}),
  });

export const sendImageMessage = async (
  conversationId: number,
  image: { uri: string; fileName?: string | null; mimeType?: string | null; file?: File | null },
  replyToId?: number,
) => {
  const formData = new FormData();
  const fileName = image.fileName || `message-image-${Date.now()}.jpg`;
  const mimeType = image.mimeType || "image/jpeg";
  formData.append("image", Platform.OS === "web" && image.file
    ? image.file
    : ({ uri: image.uri, name: fileName, type: mimeType } as any));
  formData.append("message_type", "image");
  formData.append("conversation", String(conversationId));
  if (replyToId) formData.append("reply_to_id", String(replyToId));

  const token = await storage.getItem(ACCESS_KEY);
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  return api.post("/catalog/messages/send/", formData, {
    headers,
  });
};

export const sendDocumentMessage = async (
  conversationId: number,
  document: { uri: string; fileName?: string | null; mimeType?: string | null; file?: File | null },
  replyToId?: number,
) => {
  const formData = new FormData();
  const fileName = document.fileName || `message-doc-${Date.now()}`;
  const mimeType = document.mimeType || "application/octet-stream";
  formData.append("document", Platform.OS === "web" && document.file
    ? document.file
    : ({ uri: document.uri, name: fileName, type: mimeType } as any));
  formData.append("message_type", "document");
  formData.append("conversation", String(conversationId));
  if (replyToId) formData.append("reply_to_id", String(replyToId));

  const token = await storage.getItem(ACCESS_KEY);
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  return api.post("/catalog/messages/send/", formData, {
    headers,
  });
};

export const sendAudioMessage = async (conversationId: number, audioUri: string) => {
  const formData = new FormData();
  const timestamp = Date.now();
  if (Platform.OS === "web") {
    const response = await fetch(audioUri);
    if (!response.ok) throw new Error("Could not read the voice recording.");
    const audioBlob = await response.blob();
    const mimeType = (audioBlob.type || "audio/webm").split(";")[0];
    const extension = mimeType === "audio/mp4" ? "m4a" : mimeType.split("/")[1] || "webm";
    formData.append("audio", audioBlob, `voice-note-${timestamp}.${extension}`);
  } else {
    const extension = audioUri.split(/[?#]/)[0].match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase() || "m4a";
    const mimeType = extension === "3gp" ? "audio/3gpp" : extension === "webm" ? "audio/webm" : "audio/mp4";
    formData.append("audio", ({ uri: audioUri, name: `voice-note-${timestamp}.${extension}`, type: mimeType } as any));
  }
  formData.append("message_type", "audio");
  formData.append("conversation", String(conversationId));
  const token = await storage.getItem(ACCESS_KEY);
  return api.post("/catalog/messages/send/", formData, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
};

export const getMyProducts = () => api.get("/catalog/products/mine/");

export const markConversationRead = (conversationId: number) =>
  api.patch(`/catalog/conversations/${conversationId}/read/`, {});

export const updateProduct = (
  id: number,
  data: { title: string; description: string; price_xaf: number; category: string }
) => api.put(`/catalog/products/${id}/edit/`, data);

export const deleteProduct = (id: number) => api.delete(`/catalog/products/${id}/edit/`);

export const deleteProductImage = (imageId: number) =>
  api.delete(`/catalog/images/${imageId}/delete/`);

export const getAdminDashboard = () => api.get("/catalog/admin/dashboard/");

export const getAdminArtists = () => api.get("/catalog/admin/artists/");

export const getAdminSubscriptions = () => api.get("/billing/admin/subscriptions/");

export const activateSubscription = (subscriptionId: number, data: { action: string; days?: number }) =>
  api.patch(`/billing/admin/subscriptions/${subscriptionId}/activate/`, data);

export const verifyArtist = (artistId: number, isVerified: boolean) =>
  api.patch(`/catalog/admin/artists/${artistId}/verify/`, { is_verified: isVerified });

export const getArtistProfile = (artistId: number) => api.get(`/catalog/artists/${artistId}/`);

export const getArtistProducts = (artistId: number) =>
  api.get(`/catalog/artists/${artistId}/products/`);

export const getMyArtistProfile = () => api.get("/catalog/artists/me/");

export const updateMyArtistProfile = (data: {
  brand_name: string;
  bio: string;
  artistic_practice: string;
  instagram_handle: string;
  portfolio_url: string;
  avatarUri?: string | null;
  national_id_number?: string;
}) => {
  const formData = new FormData();
  formData.append("brand_name", data.brand_name);
  formData.append("bio", data.bio);
  formData.append("artistic_practice", data.artistic_practice);
  formData.append("instagram_handle", data.instagram_handle);
  formData.append("portfolio_url", data.portfolio_url);
  if (data.national_id_number !== undefined) {
    formData.append("national_id_number", data.national_id_number);
  }
  if (data.avatarUri) {
    formData.append("avatar", {
      uri: data.avatarUri,
      name: "avatar.jpg",
      type: "image/jpeg",
    } as any);
  }
  // Attach auth header directly for multipart request (in case interceptors are not applied for some environments)
  const attachHeaders = async () => {
    const token = await storage.getItem(ACCESS_KEY);
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return api.patch("/catalog/artists/me/", formData, { headers });
  };

  return attachHeaders();
};

export const reportConversation = (conversationId: number, reason: string) =>
  api.patch(`/catalog/conversations/${conversationId}/report/`, { reason });

export const getReportedConversations = () => api.get("/catalog/admin/reported-conversations/");

export const suspendArtist = (artistId: number, isSuspended: boolean, reason?: string) =>
  api.patch(`/catalog/admin/artists/${artistId}/suspend/`, {
    is_suspended: isSuspended,
    reason: reason || "",
  });

export const markProductSold = (id: number, isSold: boolean) =>
  api.patch(`/catalog/products/${id}/mark-sold/`, { is_sold: isSold });

export const changePassword = (oldPassword: string, newPassword: string) =>
  api.post("/accounts/change-password/", { old_password: oldPassword, new_password: newPassword });

export const updateProfile = async (data: {
  username: string;
  email: string;
  phone_number: string;
  profilePhoto?: { uri: string; fileName?: string | null; mimeType?: string | null; file?: File | null } | null;
}) => {
  if (!data.profilePhoto) {
    return api.patch("/accounts/update-profile/", {
      username: data.username,
      email: data.email,
      phone_number: data.phone_number,
    });
  }

  const formData = new FormData();
  formData.append("username", data.username);
  formData.append("email", data.email);
  formData.append("phone_number", data.phone_number);
  const photo = data.profilePhoto;
  formData.append("profile_photo", Platform.OS === "web" && photo.file
    ? photo.file
    : ({ uri: photo.uri, name: photo.fileName || "profile-photo.jpg", type: photo.mimeType || "image/jpeg" } as any));
  return api.patch("/accounts/update-profile/", formData);
};

export const registerPushToken = (token: string) =>
  api.post("/accounts/push-token/", { expo_push_token: token });

export const getNotifications = () => api.get("/accounts/notifications/");
export const markNotificationsRead = () => api.post("/accounts/notifications/read/");
export const markNotificationRead = (notificationId: number) =>
  api.post(`/accounts/notifications/${notificationId}/read/`);

export const deleteNotification = (notificationId: number) =>
  api.delete(`/accounts/notifications/${notificationId}/`);

export const clearNotifications = () => api.post("/accounts/notifications/clear/");

export const toggleFavorite = (productId: number) =>
  api.post("/catalog/favorites/toggle/", { product: productId });

export const getFavoriteIds = () => api.get("/catalog/favorites/ids/");

export const getProductComments = (productId: number) =>
  api.get(`/catalog/products/${productId}/comments/`);

export const createProductComment = (productId: number, text: string) =>
  api.post(`/catalog/products/${productId}/comments/`, { text });

export const getMyFavorites = () => api.get("/catalog/favorites/");

export const createReview = (data: { conversation: number; rating: number; comment: string }) =>
  api.post("/catalog/reviews/create/", data);

export const getProductReviews = (productId: number) =>
  api.get(`/catalog/products/${productId}/reviews/`);

export const getReviewableConversations = () =>
  api.get("/catalog/conversations/reviewable/");

export const getMyArtistAnalytics = () => api.get("/catalog/artists/me/analytics/");

export const sanaaImageRank = (imageUri: string, message?: string) => {
  const formData = new FormData();
  formData.append("image", {
    uri: imageUri,
    name: "sanaa-reference.jpg",
    type: "image/jpeg",
  } as any);
  if (message) formData.append("message", message);
  return api.post("/catalog/assistant/image-rank/", formData);
};

export const resumeConversation = (conversationId: number) =>
  api.patch(`/catalog/conversations/${conversationId}/resume/`);

export const createCommissionRequest = (data: {
  title: string;
  description: string;
  category: string;
  budget_xaf?: number;
  region?: string;
}) => api.post("/catalog/commissions/create/", data);

export const getMyCommissionRequests = () => api.get("/catalog/commissions/mine/");

export const getOpenCommissionRequests = (params?: { category?: string; region?: string }) => {
  const query = new URLSearchParams();
  if (params?.category) query.append("category", params.category);
  if (params?.region) query.append("region", params.region);
  const qs = query.toString();
  return api.get(`/catalog/commissions/open/${qs ? `?${qs}` : ""}`);
};

export const respondToCommission = (data: {
  commission: number;
  message: string;
  proposed_price_xaf?: number;
}) => api.post("/catalog/commissions/respond/", data);

export const updateCommissionStatus = (id: number, status: "in_progress" | "completed" | "cancelled") =>
  api.patch(`/catalog/commissions/${id}/status/`, { status });

export const getCustomerProfile = (id: number) => api.get(`/catalog/customers/${id}/`);

export const getMySubscription = () => api.get("/billing/me/");

export const getSubscriptionPlans = () => api.get("/billing/plans/");

export const startSubscriptionPayment = (planId: number, phoneNumber?: string, method?: "orange" | "mtn", amountXaf?: number) =>
  api.post("/billing/campay/start/", {
    plan_id: planId,
    ...(phoneNumber ? { phone_number: phoneNumber } : {}),
    ...(method ? { method } : {}),
    ...(amountXaf !== undefined ? { amount_xaf: amountXaf } : {}),
  });

export const confirmSubscriptionPayment = (externalReference: string) =>
  api.post("/billing/campay/confirm/", { external_reference: externalReference });

export const getSubscriptionPaymentStatus = (externalReference: string) =>
  api.get(`/billing/campay/payments/${externalReference}/`);

export const requestPasswordReset = (email: string) =>
  api.post("/accounts/request-password-reset/", { email });

export const confirmPasswordReset = (email: string, code: string, newPassword: string) =>
  api.post("/accounts/confirm-password-reset/", { email, code, new_password: newPassword });
