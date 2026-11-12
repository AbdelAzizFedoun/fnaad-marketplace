import AsyncStorage from "@react-native-async-storage/async-storage";

const PREFIX = "fnaad_offline_cache_v1_";
const KEY_CATALOG = `${PREFIX}catalog`;
const KEY_CONVERSATIONS = `${PREFIX}conversations`;
const KEY_FAVORITES = `${PREFIX}favorites`;
const KEY_PRODUCT_PREFIX = `${PREFIX}product_`;
const KEY_MESSAGES_PREFIX = `${PREFIX}messages_`;

/**
 * Safely parse JSON from storage, returning fallback if null or invalid.
 */
function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch (e) {
    return fallback;
  }
}

/**
 * Cache home catalog products
 */
export async function saveCatalogCache(products: any[]): Promise<void> {
  if (!Array.isArray(products) || products.length === 0) return;
  try {
    await AsyncStorage.setItem(KEY_CATALOG, JSON.stringify(products.slice(0, 100)));
  } catch (err) {
    console.warn("[offlineCache] Failed to save catalog cache:", err);
  }
}

export async function getCatalogCache(): Promise<any[] | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY_CATALOG);
    return safeParse<any[] | null>(raw, null);
  } catch (err) {
    console.warn("[offlineCache] Failed to get catalog cache:", err);
    return null;
  }
}

/**
 * Cache single product details
 */
export async function saveProductDetailCache(id: string | number, product: any): Promise<void> {
  if (!id || !product) return;
  try {
    await AsyncStorage.setItem(`${KEY_PRODUCT_PREFIX}${id}`, JSON.stringify(product));
  } catch (err) {
    console.warn(`[offlineCache] Failed to save product cache ${id}:`, err);
  }
}

export async function getProductDetailCache(id: string | number): Promise<any | null> {
  if (!id) return null;
  try {
    const raw = await AsyncStorage.getItem(`${KEY_PRODUCT_PREFIX}${id}`);
    return safeParse<any | null>(raw, null);
  } catch (err) {
    console.warn(`[offlineCache] Failed to get product cache ${id}:`, err);
    return null;
  }
}

/**
 * Cache conversations list
 */
export async function saveConversationsCache(conversations: any[]): Promise<void> {
  if (!Array.isArray(conversations)) return;
  try {
    await AsyncStorage.setItem(KEY_CONVERSATIONS, JSON.stringify(conversations.slice(0, 50)));
  } catch (err) {
    console.warn("[offlineCache] Failed to save conversations cache:", err);
  }
}

export async function getConversationsCache(): Promise<any[] | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY_CONVERSATIONS);
    return safeParse<any[] | null>(raw, null);
  } catch (err) {
    console.warn("[offlineCache] Failed to get conversations cache:", err);
    return null;
  }
}

/**
 * Cache conversation details & messages
 */
export async function saveMessagesCache(conversationId: string | number, data: any): Promise<void> {
  if (!conversationId || !data) return;
  try {
    await AsyncStorage.setItem(`${KEY_MESSAGES_PREFIX}${conversationId}`, JSON.stringify(data));
  } catch (err) {
    console.warn(`[offlineCache] Failed to save messages cache ${conversationId}:`, err);
  }
}

export async function getMessagesCache(conversationId: string | number): Promise<any | null> {
  if (!conversationId) return null;
  try {
    const raw = await AsyncStorage.getItem(`${KEY_MESSAGES_PREFIX}${conversationId}`);
    return safeParse<any | null>(raw, null);
  } catch (err) {
    console.warn(`[offlineCache] Failed to get messages cache ${conversationId}:`, err);
    return null;
  }
}

/**
 * Cache user favorite product IDs
 */
export async function saveFavoriteIdsCache(ids: number[]): Promise<void> {
  if (!Array.isArray(ids)) return;
  try {
    await AsyncStorage.setItem(KEY_FAVORITES, JSON.stringify(ids));
  } catch (err) {
    console.warn("[offlineCache] Failed to save favorite IDs cache:", err);
  }
}

export async function getFavoriteIdsCache(): Promise<number[] | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY_FAVORITES);
    return safeParse<number[] | null>(raw, null);
  } catch (err) {
    console.warn("[offlineCache] Failed to get favorite IDs cache:", err);
    return null;
  }
}
