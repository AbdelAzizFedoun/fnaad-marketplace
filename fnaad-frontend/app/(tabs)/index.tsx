import { useEffect, useState, useCallback, useRef } from "react";
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Pressable, ScrollView, TextInput, Modal, RefreshControl, Image as NativeImage, Share } from "react-native";
import Image from "../../components/MediaImage";
import type { DimensionValue } from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { api, createStoryComment, getStoryComments, recordStoryView, resolveMediaUrl, toggleFavorite, toggleStoryLike, getFavoriteIds, unwrapList } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import { useTheme } from "../../context/ThemeContext";
import { useNetwork } from "../../context/NetworkContext";
import OfflineBanner from "../../components/OfflineBanner";
import { saveCatalogCache, getCatalogCache, saveFavoriteIdsCache, getFavoriteIdsCache } from "../../services/offlineCache";
import LanguageSwitcher from "../../components/LanguageSwitcher";
import { useResponsiveLayout } from "../../hooks/useResponsiveLayout";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import ShareSheet from "../../components/ShareSheet";
import { shadow, RADIUS } from "../../components/shadow";
import React from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useVideoPlayer, VideoView } from "expo-video";

type Product = {
  id: number;
  title: string;
  description: string | null;
  price_xaf: number | null;
  category_display: string;
  artist_id: number;
  artist_name: string;
  artist_avatar: string | null;
  artist_region: string | null;
  artist_region_display: string | null;
  artist_is_verified: boolean;
  created_at?: string;
  moods?: string[];
  verification_level?: string;
  originality_evidence_count?: number;
  average_rating: number | null;
  review_count: number;
  like_count?: number;
  comment_count?: number;
  is_sold?: boolean;
  public_url: string;
  images: { image: string; thumbnail?: string | null; is_primary: boolean }[];
};

type SpotlightProduct = Product & { delivered_review_count?: number; spotlight_expires_at?: string | null };
type ArtistStory = {
  id: number;
  artist_id: number;
  artist_name: string;
  artist_avatar: string | null;
  image: string | null;
  video: string | null;
  media_type: "image" | "video" | "text";
  caption: string;
  created_at: string;
  like_count: number;
  comments_count: number;
  liked_by_me: boolean;
};
type ArtistStoryComment = {
  id: number;
  username: string;
  text: string;
  created_at: string;
};

function StoryVideo({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (videoPlayer) => {
    videoPlayer.loop = true;
    videoPlayer.play();
  });
  return <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="contain" nativeControls />;
}

function formatStoryAge(value: string, t: (key: string, params?: Record<string, string>) => string) {
  const elapsed = Math.max(0, Date.now() - new Date(value).getTime());
  const minutes = Math.floor(elapsed / 60000);
  if (minutes < 1) return t("storyJustNow");
  if (minutes < 60) return t("storyMinutesAgo", { count: String(minutes) });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("storyHoursAgo", { count: String(hours) });
  const days = Math.floor(hours / 24);
  if (days < 7) return t("storyDaysAgo", { count: String(days) });
  return new Date(value).toLocaleDateString();
}

const CATEGORIES = [
  { value: "", labelKey: "allCategories" },
  { value: "painting", labelKey: "categoryPainting" },
  { value: "drawing", labelKey: "categoryDrawing" },
  { value: "abstract", labelKey: "categoryAbstract" },
  { value: "sculpture", labelKey: "categorySculpture" },
  { value: "portrait", labelKey: "categoryPortrait" },
  { value: "home_design", labelKey: "categoryHomeDesign" },
  { value: "contemporary", labelKey: "categoryContemporary" },
  { value: "calligraphy", labelKey: "categoryCalligraphy" },
  { value: "artisan_crafts", labelKey: "categoryArtisanCrafts" },
  { value: "hall_of_fame", labelKey: "categoryHallOfFame" },
  { value: "traditional_wear", labelKey: "categoryTraditionalWear" },
  { value: "other", labelKey: "categoryOther" },
];

const REGIONS = [
  { value: "", labelKey: "allRegions" },
  { value: "adamaoua", label: "Adamaoua" },
  { value: "centre", label: "Centre" },
  { value: "est", label: "Est" },
  { value: "extreme_nord", label: "Far North" },
  { value: "littoral", label: "Littoral" },
  { value: "nord", label: "Nord" },
  { value: "nord_ouest", label: "Nord-Ouest" },
  { value: "ouest", label: "Ouest" },
  { value: "sud", label: "Sud" },
  { value: "sud_ouest", label: "Sud-Ouest" },
];

const SORT_OPTIONS = [
  { value: "newest", labelKey: "sort_newest" },
  { value: "price_low", labelKey: "sort_price_low" },
  { value: "price_high", labelKey: "sort_price_high" },
  { value: "rating", labelKey: "sort_rating" },
];

const formatPrice = (value: number) => value.toLocaleString("en-US");

function SkeletonCard({ cardWidth, colors }: { cardWidth: DimensionValue; colors: any }) {
  return (
    <View style={{ width: cardWidth, backgroundColor: colors.surface, borderRadius: RADIUS.lg, overflow: "hidden", marginBottom: 14, borderWidth: 1, borderColor: colors.border }}>
      <View style={{ width: "100%", aspectRatio: 1, backgroundColor: colors.border }} />
      <View style={{ padding: 12, gap: 8 }}>
        <View style={{ height: 10, borderRadius: 5, width: "45%", backgroundColor: colors.border }} />
        <View style={{ height: 12, borderRadius: 6, width: "85%", backgroundColor: colors.border }} />
        <View style={{ height: 12, borderRadius: 6, width: "60%", backgroundColor: colors.border }} />
      </View>
    </View>
  );
}

export default function GalleryScreen() {
  const router = useRouter();
  const { isOnline, notifyOffline } = useNetwork();
  const { storyId: storyIdParam } = useLocalSearchParams<{ storyId?: string }>();
  const { loggedIn, initializing, user } = useAuth();
  const { t } = useLanguage();
  const { colors, fonts, mode } = useTheme();
  const layout = useResponsiveLayout();
  const styles = createStyles(colors, layout, fonts);
  const productColumns = layout.productColumns;

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedSort, setSelectedSort] = useState("newest");
  const [selectedMood, setSelectedMood] = useState("");
  const [searchText, setSearchText] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [favoriteIds, setFavoriteIds] = useState<Set<number>>(new Set());
  const [shareProduct, setShareProduct] = useState<Product | null>(null);
  const [filterVisible, setFilterVisible] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [spotlight, setSpotlight] = useState<SpotlightProduct[]>([]);
  const [stories, setStories] = useState<ArtistStory[]>([]);
  const [activeStoryArtistId, setActiveStoryArtistId] = useState<number | null>(null);
  const [activeStoryIndex, setActiveStoryIndex] = useState(0);
  const [storyComments, setStoryComments] = useState<ArtistStoryComment[]>([]);
  const [storyCommentsVisible, setStoryCommentsVisible] = useState(false);
  const [storyCommentsLoading, setStoryCommentsLoading] = useState(false);
  const [storyCommentText, setStoryCommentText] = useState("");
  const [storyCommentSending, setStoryCommentSending] = useState(false);
  const [storyLikeSaving, setStoryLikeSaving] = useState(false);
  const [storyActionError, setStoryActionError] = useState("");
  const recordedStoryViews = useRef(new Set<number>());
  const [countdownNow, setCountdownNow] = useState(Date.now());
  const [recentlyViewed, setRecentlyViewed] = useState<Product[]>([]);

  const rememberProduct = useCallback(async (product: Product) => {
    const next = [product, ...recentlyViewed.filter((item) => item.id !== product.id)].slice(0, 8);
    setRecentlyViewed(next);
    try { await AsyncStorage.setItem("fnaad_recently_viewed_v1", JSON.stringify(next)); } catch {}
  }, [recentlyViewed]);

  const openProduct = useCallback((product: Product) => {
    void rememberProduct(product);
    router.push(`/product/${product.id}`);
  }, [rememberProduct, router]);

  useEffect(() => {
    AsyncStorage.getItem("fnaad_recently_viewed_v1").then((raw) => {
      if (raw) setRecentlyViewed(JSON.parse(raw) as Product[]);
    }).catch(() => undefined);
  }, []);

  const activeFilterCount = [selectedRegion, selectedCategory, selectedSort !== "newest"].filter(Boolean).length;
  const storiesByArtist = new Map<number, ArtistStory[]>();
  for (const story of stories) {
    const artistStories = storiesByArtist.get(story.artist_id) || [];
    artistStories.push(story);
    storiesByArtist.set(story.artist_id, artistStories);
  }
  const storyArtists = Array.from(storiesByArtist, ([artistId, media]) => ({
    artistId,
    artistName: media[0].artist_name,
    artistAvatar: media[0].artist_avatar,
    media: media.sort((first, second) => first.created_at.localeCompare(second.created_at)),
  }));
  const dayNumber = Math.floor(new Date(countdownNow).setHours(0, 0, 0, 0) / 86_400_000);
  const newestProducts = [...products].sort((first, second) => {
    const firstCreated = Date.parse(first.created_at || "") || 0;
    const secondCreated = Date.parse(second.created_at || "") || 0;
    return secondCreated - firstCreated;
  });
  const productsWithImages = newestProducts.filter((product) =>
    product.images?.some((image) => image.image)
  );
  const activeSpotlights = spotlight.filter((item) => {
    if (!item.spotlight_expires_at) return true;
    const expiresAt = new Date(item.spotlight_expires_at).getTime();
    return !Number.isFinite(expiresAt) || expiresAt > countdownNow;
  });
  const discoveryPool: SpotlightProduct[] = activeSpotlights.length
    ? activeSpotlights
    : productsWithImages.length
      ? productsWithImages
      : newestProducts;
  const recommendationSignals = [...recentlyViewed, ...products.filter((item) => favoriteIds.has(item.id))];
  const preferredCategories = new Set(recommendationSignals.map((item) => item.category_display).filter(Boolean));
  const preferredArtists = new Set(recommendationSignals.map((item) => item.artist_id));
  const recommendedProducts = products
    .filter((item) => !recommendationSignals.some((signal) => signal.id === item.id))
    .map((item) => ({
      item,
      score: (preferredCategories.has(item.category_display) ? 3 : 0)
        + (preferredArtists.has(item.artist_id) ? 4 : 0)
        + (item.artist_is_verified ? 1 : 0),
    }))
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 8)
    .map(({ item }) => item);
  const dailyDiscovery = discoveryPool.length
    ? discoveryPool[((dayNumber % discoveryPool.length) + discoveryPool.length) % discoveryPool.length]
    : null;
  const isSpotlightDiscovery = dailyDiscovery
    ? activeSpotlights.some((item) => item.id === dailyDiscovery.id)
    : false;
  const discoveryImage = dailyDiscovery?.images?.find((image) => image.is_primary)
    || dailyDiscovery?.images?.[0];
  const spotlightExpiry = isSpotlightDiscovery && dailyDiscovery?.spotlight_expires_at
    ? new Date(dailyDiscovery.spotlight_expires_at).getTime()
    : NaN;
  const spotlightRemaining = Number.isFinite(spotlightExpiry)
    ? Math.max(0, spotlightExpiry - countdownNow)
    : 0;
  const spotlightHours = Math.floor(spotlightRemaining / 3_600_000);
  const spotlightMinutes = Math.floor((spotlightRemaining % 3_600_000) / 60_000);
  const tomorrow = new Date(countdownNow);
  tomorrow.setHours(24, 0, 0, 0);
  const dailyRefreshRemaining = Math.max(0, tomorrow.getTime() - countdownNow);
  const dailyRefreshHours = Math.floor(dailyRefreshRemaining / 3_600_000);
  const dailyRefreshMinutes = Math.floor((dailyRefreshRemaining % 3_600_000) / 60_000);
  const hasDiscoveryRating = Boolean(
    dailyDiscovery?.review_count && dailyDiscovery.average_rating !== null
  );
  const activeStoryGroup = storyArtists.find((artist) => artist.artistId === activeStoryArtistId);
  const activeStory = activeStoryGroup?.media[activeStoryIndex];

  useEffect(() => {
    const cacheKey = "fnaad_spotlight_cache_v1";
    const loadSpotlight = async () => {
      try {
        const cached = await AsyncStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached) as { savedAt: number; items: SpotlightProduct[] };
          if (Date.now() - parsed.savedAt < 60_000) {
            setSpotlight(parsed.items);
          }
        }
        const res = await api.get("/catalog/spotlight/", { skipAuth: true } as any);
        const items = unwrapList<SpotlightProduct>(res.data);
        setSpotlight(items);
        await AsyncStorage.setItem(cacheKey, JSON.stringify({ savedAt: Date.now(), items }));
        await Promise.all(items.slice(0, 6).flatMap((item) => (item.images || []).slice(0, 2).map((image) => image.image ? NativeImage.prefetch(resolveMediaUrl(image.image)!) : Promise.resolve(false))));
      } catch {
        setSpotlight((current) => current);
      }
    };
    void loadSpotlight();
  }, []);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      api.get("/catalog/stories/?page_size=100")
        .then((response) => {
          if (isActive) setStories(unwrapList<ArtistStory>(response.data));
        })
        .catch((error) => console.warn("Unable to load Studio Stories:", error.message));
      return () => {
        isActive = false;
      };
    }, [])
  );

  useEffect(() => {
    const storyId = Number(storyIdParam);
    if (!storyId || !stories.length) return;
    const story = stories.find((item) => item.id === storyId);
    if (story) {
      const artist = storyArtists.find((item) => item.artistId === story.artist_id);
      if (artist) {
        setActiveStoryArtistId(artist.artistId);
        setActiveStoryIndex(artist.media.findIndex((item) => item.id === story.id));
      }
    }
    router.setParams({ storyId: undefined });
  }, [router, storyIdParam, stories]);

  useEffect(() => {
    setStoryComments([]);
    setStoryCommentsVisible(false);
    setStoryCommentText("");
    setStoryActionError("");
  }, [activeStory?.id]);

  useEffect(() => {
    if (!activeStory || recordedStoryViews.current.has(activeStory.id)) return;
    recordedStoryViews.current.add(activeStory.id);
    recordStoryView(activeStory.id)
      .then(({ data }) => {
        setStories((current) => current.map((story) =>
          story.id === activeStory.id
            ? { ...story, views_count: data.views_count }
            : story
        ));
      })
      .catch((error) => {
        recordedStoryViews.current.delete(activeStory.id);
        console.warn("Unable to record Studio Story view:", error.message);
      });
  }, [activeStory?.id]);

  useEffect(() => { const timer = setInterval(() => setCountdownNow(Date.now()), 1000); return () => clearInterval(timer); }, []);

  useEffect(() => {
    // Instant cache-first feed on app launch
    getCatalogCache().then((cached) => {
      if (cached && cached.length > 0) {
        setProducts(cached);
        setLoading(false);
      }
    });
    getFavoriteIdsCache().then((cachedIds) => {
      if (cachedIds && cachedIds.length > 0) {
        setFavoriteIds(new Set(cachedIds));
      }
    });
  }, []);

  const loadProducts = (region: string, category: string, search: string, sort: string) => {
    // If we have cached products, keep them visible while loading fresh data
    if (products.length === 0) {
      setLoading(true);
    }
    const params = new URLSearchParams();
    if (region) params.append("region", region);
    if (category) params.append("category", category);
    if (search) params.append("search", search);
    if (sort) params.append("sort", sort);
    if (selectedMood) params.append("mood", selectedMood);
    const query = params.toString();
    const url = query ? `/catalog/products/?${query}` : "/catalog/products/";
    setApiError(null);
    api
      .get(url, { skipAuth: true } as any)
      .then((res) => {
        const list = unwrapList<Product>(res.data);
        setProducts(list);
        setApiError(null);
        if (!region && !category && !search && !selectedMood && sort === "newest") {
          saveCatalogCache(list);
        }
      })
      .catch((err) => {
        console.log("API error:", err.message);
        setApiError(err.message || "Network error");
      })
      .finally(() => setLoading(false));
  };

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    const params = new URLSearchParams();
    if (selectedRegion) params.append("region", selectedRegion);
    if (selectedCategory) params.append("category", selectedCategory);
    if (debouncedSearch) params.append("search", debouncedSearch);
    if (selectedSort) params.append("sort", selectedSort);
    if (selectedMood) params.append("mood", selectedMood);
    const query = params.toString();
    const url = query ? `/catalog/products/?${query}` : "/catalog/products/";
    api
      .get(url, { skipAuth: true } as any)
      .then((res) => {
        const list = unwrapList<Product>(res.data);
        setProducts(list);
        setApiError(null);
        if (!selectedRegion && !selectedCategory && !debouncedSearch && !selectedMood && selectedSort === "newest") {
          saveCatalogCache(list);
        }
      })
      .catch((err) => {
        console.log("API error:", err.message);
        setApiError(err.message || "Network error");
      })
      .finally(() => setRefreshing(false));
  }, [selectedRegion, selectedCategory, selectedSort, debouncedSearch, selectedMood]);

  const loadFavoriteIds = () => {
    if (!loggedIn) {
      setFavoriteIds(new Set());
      return;
    }
    getFavoriteIds()
      .then((res) => {
        const ids = res.data.favorite_ids || [];
        setFavoriteIds(new Set(ids));
        saveFavoriteIdsCache(ids);
      })
      .catch((err) => console.log("Failed to load favorite ids:", err.message));
  };

  useFocusEffect(
    useCallback(() => {
      loadFavoriteIds();
    }, [loggedIn])
  );

  const handleToggleFavorite = (productId: number) => {
    if (!loggedIn) {
      router.push("/login");
      return;
    }
    if (!isOnline) {
      notifyOffline(t("offlineActionLike") || "like artworks");
      return;
    }
    const wasFavorited = favoriteIds.has(productId);
    setFavoriteIds((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
    setProducts((prev) => prev.map((product) => product.id === productId
      ? { ...product, like_count: Math.max(0, (product.like_count || 0) + (wasFavorited ? -1 : 1)) }
      : product
    ));

    toggleFavorite(productId).catch((err) => {
      console.log("Failed to toggle favorite:", err.message);
      loadFavoriteIds();
      setProducts((prev) => prev.map((product) => product.id === productId
        ? { ...product, like_count: Math.max(0, (product.like_count || 0) + (wasFavorited ? 1 : -1)) }
        : product
      ));
    });
  };

  const updateStory = (storyId: number, update: Partial<ArtistStory>) => {
    setStories((current) => current.map((story) =>
      story.id === storyId ? { ...story, ...update } : story
    ));
  };

  const handleToggleStoryLike = async () => {
    if (!activeStory || storyLikeSaving) return;
    if (!loggedIn) {
      router.push("/login");
      return;
    }
    if (!isOnline) {
      notifyOffline(t("offlineActionLike") || "like");
      return;
    }
    setStoryLikeSaving(true);
    setStoryActionError("");
    try {
      const { data } = await toggleStoryLike(activeStory.id);
      updateStory(activeStory.id, {
        liked_by_me: data.liked,
        like_count: data.like_count,
      });
    } catch (error) {
      setStoryActionError(
        (error as any)?.response?.data?.detail || t("storyLikeFailed")
      );
    } finally {
      setStoryLikeSaving(false);
    }
  };

  const openStoryComments = async () => {
    if (!activeStory) return;
    setStoryCommentsVisible((visible) => !visible);
    if (storyCommentsVisible) return;
    setStoryCommentsLoading(true);
    setStoryActionError("");
    try {
      const { data } = await getStoryComments(activeStory.id);
      setStoryComments(unwrapList<ArtistStoryComment>(data));
    } catch (error) {
      setStoryActionError(
        (error as any)?.response?.data?.detail || t("storyCommentsFailed")
      );
    } finally {
      setStoryCommentsLoading(false);
    }
  };

  const submitStoryComment = async () => {
    if (!activeStory || !storyCommentText.trim() || storyCommentSending) return;
    if (!loggedIn) {
      router.push("/login");
      return;
    }
    if (!isOnline) {
      notifyOffline(t("offlineActionComment") || "post a comment");
      return;
    }
    setStoryCommentSending(true);
    setStoryActionError("");
    try {
      const { data } = await createStoryComment(activeStory.id, storyCommentText.trim());
      setStoryComments((current) => [data, ...current]);
      setStoryCommentText("");
      updateStory(activeStory.id, {
        comments_count: activeStory.comments_count + 1,
      });
    } catch (error) {
      setStoryActionError(
        (error as any)?.response?.data?.text?.[0]
          || (error as any)?.response?.data?.detail
          || t("storyCommentFailed")
      );
    } finally {
      setStoryCommentSending(false);
    }
  };

  const shareActiveStory = () => {
    if (!activeStory || !activeStoryGroup) return;
    const mediaUrl = resolveMediaUrl(
      activeStory.media_type === "video" ? activeStory.video : activeStory.image
    );
    Share.share({
      message: `${activeStoryGroup.artistName} on FNAAD${activeStory.caption ? `: ${activeStory.caption}` : ""}${mediaUrl ? ` ${mediaUrl}` : ""}`,
    }).catch((error) => {
      setStoryActionError(error.message || t("storyShareFailed"));
    });
  };

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(searchText), 400);
    return () => clearTimeout(timeout);
  }, [searchText]);

  useEffect(() => {
    // Fire products and favorites in parallel to halve the cold-start wait
    loadProducts(selectedRegion, selectedCategory, debouncedSearch, selectedSort);
    if (loggedIn) {
      getFavoriteIds()
        .then((res) => setFavoriteIds(new Set(res.data.favorite_ids)))
        .catch((err) => console.log("Failed to load favorite ids:", err.message));
    }
  }, [selectedRegion, selectedCategory, debouncedSearch, selectedSort, selectedMood]);

  if (initializing) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <OfflineBanner onRetry={onRefresh} />
      <View style={styles.page}>
        {/* ── TOP NAVBAR: Profile/Login | FNAAD Art | Join & Language ── */}
        <View style={styles.headerRow}>
          {loggedIn ? (
            <Pressable
              style={styles.profileButton}
              onPress={() => router.push("/(tabs)/profile")}
              accessibilityRole="button"
              accessibilityLabel="Open profile"
            >
              {user?.profile_photo ? (
                <Image source={{ uri: resolveMediaUrl(user.profile_photo)! }} style={styles.profileImage} />
              ) : (
                <Text style={[styles.profileInitial, { color: colors.accentText }]}>
                  {(user?.username || "U").slice(0, 1).toUpperCase()}
                </Text>
              )}
            </Pressable>
          ) : (
            <Pressable
              onPress={() => router.push("/login")}
              style={styles.navLoginBtn}
              accessibilityRole="button"
              accessibilityLabel="Log in"
            >
              <Ionicons name="log-in-outline" size={16} color={colors.accent} style={{ marginRight: 4 }} />
              <Text style={styles.navLoginText}>{t("loginBtn")}</Text>
            </Pressable>
          )}

          <View style={styles.brandLockup} accessibilityLabel="FNAAD Art Marketplace">
            <NativeImage source={require("../../assets/logo-icon.png")} style={styles.brandLogo} resizeMode="contain" />
            <View style={styles.brandCopy}>
              <Text style={styles.brandName}>FNAAD</Text>
              <Text style={styles.brandSubtitle}>{t("galleryTagline")}</Text>
            </View>
          </View>

          <View style={styles.headerActions}>
            {!loggedIn && (
              <Pressable
                onPress={() => router.push("/role-select")}
                style={styles.becomeArtistPill}
                accessibilityRole="button"
                accessibilityLabel="Become an artist"
              >
                <Ionicons name="color-palette-outline" size={14} color={colors.accentText} style={{ marginRight: 4 }} />
                <Text style={styles.becomeArtistPillText}>{t("join") || "Join"}</Text>
              </Pressable>
            )}
            <LanguageSwitcher />
          </View>
        </View>

        <View style={styles.searchRow}>
          <View style={styles.searchWrap}>
            <Ionicons name="search-outline" size={18} color={colors.textMuted} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder={t("searchPlaceholder")}
              placeholderTextColor={colors.textMuted}
              value={searchText}
              onChangeText={setSearchText}
              returnKeyType="search"
              blurOnSubmit
            />
            {searchText.length > 0 && (
              <Pressable onPress={() => setSearchText("")} hitSlop={8} style={styles.clearSearchBtn}>
                <Ionicons name="close-circle" size={18} color={colors.textMuted} />
              </Pressable>
            )}
          </View>
          <Pressable style={styles.filterButton} onPress={() => setFilterVisible(true)} accessibilityRole="button" accessibilityLabel="Open filters">
            <Ionicons name="options-outline" size={20} color={colors.accent} />
            {activeFilterCount > 0 && <View style={styles.filterBadge}><Text style={styles.filterBadgeText}>{activeFilterCount}</Text></View>}
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.quickNavRail}
          contentContainerStyle={styles.quickNavScroll}
        >
          {[
            { label: t("discover"), onPress: () => { setSelectedCategory(""); setSelectedMood(""); } },
            { label: t("artistsNav"), onPress: () => setSelectedSort("rating") },
            ...(dailyDiscovery ? [{
              label: t("dailyDiscoveryQuickNav"),
              onPress: () => router.push(`/product/${dailyDiscovery.id}`),
            }] : []),
            { label: t("forMyHome"), onPress: () => setSelectedMood("home_decor") },
          ].map((item) => (
            <Pressable key={item.label} onPress={item.onPress} style={styles.quickNavItem}>
              <Text style={styles.quickNavText}>{item.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <View style={styles.galleryStatus}>
          {activeSpotlights.length > 0
            ? <View style={styles.galleryStatusDot} />
            : <Ionicons name={dailyDiscovery ? "sparkles-outline" : "time-outline"} size={12} color={colors.accent} />}
          <Text style={styles.galleryStatusText}>
            {activeSpotlights.length
              ? t("todayAtFnaad", { count: String(activeSpotlights.length) })
              : dailyDiscovery
                ? t("dailyDiscoveryStatus")
                : t("dailyDiscoveryEmptySubtitle")}
          </Text>
        </View>

        <Modal visible={filterVisible} animationType="slide" transparent onRequestClose={() => setFilterVisible(false)}>
          <View style={styles.filterBackdrop}>
            <View style={styles.filterModal}>
              <View style={styles.filterModalHeader}>
                <Text style={styles.filterModalTitle}>{t("filtersTitle")}</Text>
                <Pressable onPress={() => setFilterVisible(false)} accessibilityRole="button" accessibilityLabel="Close filters">
                  <Ionicons name="close-outline" size={24} color={colors.text} />
                </Pressable>
              </View>

              <Text style={styles.filterModalHint}>{t("filterChangesApplyImmediately")}</Text>

              <ScrollView contentContainerStyle={styles.filterModalContent}>
                <Text style={styles.filterSectionLabel}>{t("filterRegion")}</Text>
                <View style={styles.filterChipRow}>
                  {REGIONS.map((r) => (
                    <Pressable
                      key={r.value}
                      style={[styles.filterChip, selectedRegion === r.value && styles.filterChipSelected]}
                      onPress={() => setSelectedRegion(r.value)}
                    >
                      <Text style={[styles.filterChipText, selectedRegion === r.value && styles.filterChipTextSelected]}>
                        {r.value === "" ? t((r.labelKey || r.label) as string) : r.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={styles.filterSectionLabel}>{t("filterCategory")}</Text>
                <View style={styles.filterChipRow}>
                  {CATEGORIES.map((c) => (
                    <Pressable
                      key={c.value}
                      style={[styles.filterChip, selectedCategory === c.value && styles.filterChipSelected]}
                      onPress={() => setSelectedCategory(c.value)}
                    >
                      <Text style={[styles.filterChipText, selectedCategory === c.value && styles.filterChipTextSelected]}>
                        {t(c.labelKey)}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={styles.filterSectionLabel}>{t("filterSortBy")}</Text>
                <View style={styles.filterChipRow}>
                  {SORT_OPTIONS.map((s) => (
                    <Pressable
                      key={s.value}
                      style={[styles.filterChip, selectedSort === s.value && styles.filterChipSelected]}
                      onPress={() => setSelectedSort(s.value)}
                    >
                      <Text style={[styles.filterChipText, selectedSort === s.value && styles.filterChipTextSelected]}>
                        {t(s.labelKey)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>

              <Pressable style={styles.filterClearButton} onPress={() => { setSelectedRegion(""); setSelectedCategory(""); setSelectedSort("newest"); }}>
                <Text style={styles.filterClearButtonText}>{t("filterClearAll")}</Text>
              </Pressable>
            </View>
          </View>
        </Modal>

        <Modal
          visible={activeStoryArtistId !== null && !!activeStory}
          animationType="fade"
          transparent
          onRequestClose={() => setActiveStoryArtistId(null)}
        >
          <View style={styles.storyBackdrop}>
            {activeStory && activeStoryGroup ? (
              <View style={styles.storyViewer}>
                {activeStory.media_type === "text" ? (
                  <View style={styles.storyTextStatus}><Ionicons name="chatbubble-ellipses-outline" size={30} color="#D4AF37" /><Text style={styles.storyTextStatusBody}>{activeStory.caption}</Text></View>
                ) : activeStory.media_type === "video" && activeStory.video ? (
                  <StoryVideo key={activeStory.id} uri={resolveMediaUrl(activeStory.video)!} />
                ) : activeStory.image ? (
                  <Image source={{ uri: resolveMediaUrl(activeStory.image)! }} style={styles.storyMedia} resizeMode="contain" />
                ) : (
                  <View style={styles.storyMediaFallback}><Ionicons name="images-outline" size={40} color="#FFFFFF" /></View>
                )}
                <View style={styles.storyTopOverlay}>
                  <View style={styles.storyProgressRow}>
                    {activeStoryGroup.media.map((story, index) => (
                      <View key={story.id} style={styles.storyProgressTrack}>
                        <View style={[styles.storyProgressFill, index <= activeStoryIndex && styles.storyProgressComplete]} />
                      </View>
                    ))}
                  </View>
                  <View style={styles.storyArtistHeader}>
                    {activeStoryGroup.artistAvatar ? (
                      <Image source={{ uri: resolveMediaUrl(activeStoryGroup.artistAvatar)! }} style={styles.storyHeaderAvatar} />
                    ) : (
                      <View style={styles.storyHeaderAvatarFallback}><Text style={styles.storyHeaderInitial}>{activeStoryGroup.artistName.slice(0, 1).toUpperCase()}</Text></View>
                    )}
                    <Text style={styles.storyArtistName} numberOfLines={1}>{activeStoryGroup.artistName}</Text>
                    <Text style={styles.storyPublishedAt}>{formatStoryAge(activeStory.created_at, t)}</Text>
                    <Pressable onPress={() => setActiveStoryArtistId(null)} hitSlop={12} accessibilityRole="button" accessibilityLabel={t("closeStory")}>
                      <Ionicons name="close" size={28} color="#FFFFFF" />
                    </Pressable>
                  </View>
                </View>
                <Pressable
                  style={styles.storyPreviousArea}
                  onPress={() => {
                    if (activeStoryIndex > 0) setActiveStoryIndex((index) => index - 1);
                    else setActiveStoryArtistId(null);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={t("previousStory")}
                />
                <Pressable
                  style={styles.storyNextArea}
                  onPress={() => {
                    if (activeStoryIndex < activeStoryGroup.media.length - 1) setActiveStoryIndex((index) => index + 1);
                    else setActiveStoryArtistId(null);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={t("nextStory")}
                />
                <View style={styles.storyBottomOverlay} pointerEvents="box-none">
                  {activeStory.caption ? <Text style={styles.storyCaption}>{activeStory.caption}</Text> : null}
                  <View style={styles.storyActions}>
                    <Pressable
                      style={styles.storyActionButton}
                      onPress={() => void handleToggleStoryLike()}
                      disabled={storyLikeSaving}
                      accessibilityRole="button"
                      accessibilityLabel={`${t("likeStory")} ${activeStory.like_count}`}
                    >
                      <Ionicons name={activeStory.liked_by_me ? "heart" : "heart-outline"} size={21} color={activeStory.liked_by_me ? "#FF6B78" : "#FFFFFF"} />
                      <Text style={styles.storyActionText}>{activeStory.like_count}</Text>
                    </Pressable>
                    <Pressable
                      style={styles.storyActionButton}
                      onPress={() => void openStoryComments()}
                      accessibilityRole="button"
                      accessibilityLabel={`${t("commentOnStory")} ${activeStory.comments_count}`}
                    >
                      <Ionicons name="chatbubble-outline" size={20} color="#FFFFFF" />
                      <Text style={styles.storyActionText}>{activeStory.comments_count}</Text>
                    </Pressable>
                    <Pressable
                      style={styles.storyActionButton}
                      onPress={shareActiveStory}
                      accessibilityRole="button"
                      accessibilityLabel={t("shareStory")}
                    >
                      <Ionicons name="share-social-outline" size={20} color="#FFFFFF" />
                    </Pressable>
                  </View>
                  {storyActionError ? <Text style={styles.storyActionError}>{storyActionError}</Text> : null}
                  <Pressable
                    style={styles.storyShopButton}
                    onPress={() => {
                      const artistId = activeStoryGroup.artistId;
                      setActiveStoryArtistId(null);
                      router.push(`/artist/${artistId}`);
                    }}
                    accessibilityRole="button"
                  >
                    <Text style={styles.storyShopText}>{t("shopThisArtist")}</Text>
                    <Ionicons name="arrow-forward" size={16} color={colors.accentText} />
                  </Pressable>
                  {storyCommentsVisible ? (
                    <View style={styles.storyCommentsPanel}>
                      {storyCommentsLoading ? (
                        <ActivityIndicator size="small" color={colors.accent} />
                      ) : storyComments.length ? (
                        <ScrollView style={styles.storyCommentsList} nestedScrollEnabled>
                          {storyComments.map((comment) => (
                            <View key={comment.id} style={styles.storyComment}>
                              <Text style={styles.storyCommentAuthor}>{comment.username}</Text>
                              <Text style={styles.storyCommentBody}>{comment.text}</Text>
                              <Text style={styles.storyCommentAge}>{formatStoryAge(comment.created_at, t)}</Text>
                            </View>
                          ))}
                        </ScrollView>
                      ) : (
                        <Text style={styles.storyCommentsEmpty}>{t("storyCommentsEmpty")}</Text>
                      )}
                      <View style={styles.storyCommentComposer}>
                        <TextInput
                          style={styles.storyCommentInput}
                          value={storyCommentText}
                          onChangeText={setStoryCommentText}
                          placeholder={t("storyCommentPlaceholder")}
                          placeholderTextColor="rgba(255,255,255,0.65)"
                          maxLength={500}
                          editable={!storyCommentSending}
                          returnKeyType="send"
                          onSubmitEditing={() => void submitStoryComment()}
                        />
                        <Pressable
                          onPress={() => void submitStoryComment()}
                          disabled={!storyCommentText.trim() || storyCommentSending}
                          accessibilityRole="button"
                          accessibilityLabel={t("sendStoryComment")}
                        >
                          {storyCommentSending
                            ? <ActivityIndicator size="small" color="#FFFFFF" />
                            : <Ionicons name="send" size={19} color={storyCommentText.trim() ? "#FFFFFF" : "rgba(255,255,255,0.45)"} />}
                        </Pressable>
                      </View>
                    </View>
                  ) : null}
                </View>
              </View>
            ) : null}
          </View>
        </Modal>

        {loading ? (
          <View style={styles.skeletonGrid}>
            {Array.from({ length: 6 }).map((_, index) => (
              <SkeletonCard key={index} cardWidth={
                layout.productColumns === 1
                  ? "100%"
                  : `${(100 - (layout.productColumns - 1) * 2) / layout.productColumns}%` as DimensionValue
              } colors={colors} />
            ))}
          </View>
        ) : (
          <FlatList
            key={`products-${productColumns}`}
            data={products}
            numColumns={productColumns}
            keyExtractor={(item) => item.id.toString()}
            style={styles.productList}
            columnWrapperStyle={productColumns > 1 ? styles.productRow : undefined}
            contentContainerStyle={styles.listContent}
            refreshing={refreshing}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
            ListHeaderComponent={
              <View style={styles.discoveryHeader}>
                {!debouncedSearch && recentlyViewed.length > 0 && (
                  <View style={{ marginBottom: 18 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 9 }}>
                      <Text style={styles.sectionTitle}>Recently viewed</Text>
                      <Text style={{ color: colors.textMuted, fontSize: 11 }}>Just for you</Text>
                    </View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                      {recentlyViewed.map((item) => {
                        const image = item.images?.find((entry) => entry.is_primary) || item.images?.[0];
                        return <Pressable key={item.id} onPress={() => openProduct(item)} style={{ width: 145, borderWidth: 1, borderColor: colors.border, borderRadius: 12, overflow: "hidden", backgroundColor: colors.surface }}>
                          {image?.image ? <Image source={{ uri: resolveMediaUrl(image.image)! }} style={{ width: 145, height: 100 }} resizeMode="cover" /> : <View style={{ width: 145, height: 100, backgroundColor: colors.border }} />}
                          <View style={{ padding: 8 }}><Text numberOfLines={1} style={{ color: colors.text, fontSize: 12, fontWeight: "700" }}>{item.title}</Text><Text numberOfLines={1} style={{ color: colors.textMuted, fontSize: 10, marginTop: 3 }}>{item.price_xaf != null ? `${formatPrice(item.price_xaf)} XAF` : "Price on request"}</Text></View>
                        </Pressable>;
                      })}
                    </ScrollView>
                  </View>
                )}
                {!debouncedSearch && recommendedProducts.length > 0 && (
                  <View style={{ marginBottom: 18 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 9 }}>
                      <Text style={styles.sectionTitle}>Recommended for you</Text>
                      <Ionicons name="sparkles-outline" size={16} color={colors.accent} />
                    </View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                      {recommendedProducts.map((item) => {
                        const image = item.images?.find((entry) => entry.is_primary) || item.images?.[0];
                        return <Pressable key={item.id} onPress={() => openProduct(item)} style={{ width: 145, borderWidth: 1, borderColor: colors.border, borderRadius: 12, overflow: "hidden", backgroundColor: colors.surface }}>
                          {image?.image ? <Image source={{ uri: resolveMediaUrl(image.image)! }} style={{ width: 145, height: 100 }} resizeMode="cover" /> : <View style={{ width: 145, height: 100, backgroundColor: colors.border }} />}
                          <View style={{ padding: 8 }}><Text numberOfLines={1} style={{ color: colors.text, fontSize: 12, fontWeight: "700" }}>{item.title}</Text><Text numberOfLines={1} style={{ color: colors.textMuted, fontSize: 10, marginTop: 3 }}>{item.price_xaf != null ? `${formatPrice(item.price_xaf)} XAF` : "Price on request"}</Text></View>
                        </Pressable>;
                      })}
                    </ScrollView>
                  </View>
                )}
                {/* ── Become an Artist Invitation Banner (for visitors) ── */}
                {!loggedIn && (
                  <View style={styles.artistInviteBanner}>
                    <View style={styles.artistInviteLeft}>
                      <View style={styles.artistInviteIconCircle}>
                        <Ionicons name="color-palette" size={24} color={colors.accent} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.artistInviteTitle}>
                          {t("joinAsArtistBannerTitle")}
                        </Text>
                        <Text style={styles.artistInviteSub}>
                        {t("joinAsArtistBannerSub")}
                        </Text>
                      </View>
                    </View>
                    <Pressable
                      style={styles.artistInviteCta}
                      onPress={() => router.push("/role-select")}
                      accessibilityRole="button"
                      accessibilityLabel="Join as an artist"
                    >
                      <Text style={styles.artistInviteCtaText}>
                        {t("becomeArtist") || "Become an Artist"}
                      </Text>
                      <Ionicons name="arrow-forward" size={14} color={colors.accentText} style={{ marginLeft: 4 }} />
                    </Pressable>
                  </View>
                )}
                {!debouncedSearch && !selectedCategory && !selectedRegion && (
                  <View style={styles.storiesSection}>
                    <Text style={styles.sectionTitle}>{t("studioStoriesTitle")}</Text>
                    {storyArtists.length ? (
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.storiesRail}>
                        {storyArtists.map((artist) => (
                          <Pressable
                            key={artist.artistId}
                            style={styles.storyArtistButton}
                            onPress={() => {
                              setActiveStoryArtistId(artist.artistId);
                              setActiveStoryIndex(0);
                            }}
                            accessibilityRole="button"
                            accessibilityLabel={t("viewArtistStudioStories", { artist: artist.artistName })}
                          >
                            <View style={styles.storyRing}>
                              {artist.artistAvatar ? (
                                <Image source={{ uri: resolveMediaUrl(artist.artistAvatar)! }} style={styles.storyAvatar} />
                              ) : (
                                <View style={styles.storyAvatarFallback}><Text style={styles.storyAvatarInitial}>{artist.artistName.slice(0, 1).toUpperCase()}</Text></View>
                              )}
                              {artist.media.some((story) => story.media_type === "video") && (
                                <View style={styles.storyVideoBadge}><Ionicons name="play" size={10} color="#FFFFFF" /></View>
                              )}
                            </View>
                            <Text style={styles.storyArtistLabel} numberOfLines={1}>{artist.artistName}</Text>
                          </Pressable>
                        ))}
                      </ScrollView>
                    ) : (
                      <View style={styles.storiesEmpty}>
                        <Ionicons name="camera-outline" size={19} color={colors.textMuted} />
                        <Text style={styles.storiesEmptyText}>{t("studioStoriesEmpty")}</Text>
                      </View>
                    )}
                  </View>
                )}
                {!debouncedSearch && !selectedCategory && !selectedRegion && (() => {
                  if (!dailyDiscovery) {
                    return (
                      <View style={[styles.welcomeHero, styles.spotlightHero, styles.heroEmpty]}>
                        <View style={styles.heroContent}>
                          <Text style={styles.heroEyebrow}>{t("dailyDiscoveryEyebrow")}</Text>
                          <Text style={styles.heroTitle}>{t("dailyDiscoveryEmptyTitle")}</Text>
                          <Text style={styles.heroSubtitle}>{t("dailyDiscoveryEmptySubtitle")}</Text>
                          <Pressable style={styles.heroButton} onPress={() => router.push("/role-select")}>
                            <Text style={styles.heroButtonText}>{t("becomeArtist")}</Text>
                            <Ionicons name="arrow-forward" size={15} color={colors.accentText} />
                          </Pressable>
                        </View>
                      </View>
                    );
                  }

                  const artistAndRegion = [
                    dailyDiscovery.artist_name || t("unknownArtist"),
                    dailyDiscovery.artist_region_display,
                  ].filter(Boolean).join(" · ");

                  return (
                    <View style={[styles.welcomeHero, styles.welcomeHeroSpotlight, styles.spotlightHero]}>
                      <Image
                        source={require("../../assets/logo-full-transparent.png")}
                        style={styles.spotlightWatermark}
                        resizeMode="contain"
                      />
                      {discoveryImage?.image ? (
                        <Image
                          source={{ uri: resolveMediaUrl(discoveryImage.image)! }}
                          style={styles.heroSpotlightImage}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={styles.heroImageFallback}>
                          <Ionicons name="image-outline" size={28} color={colors.textMuted} />
                        </View>
                      )}
                      <View style={styles.heroContent}>
                        <Text style={styles.heroEyebrow}>
                          {isSpotlightDiscovery ? t("spotlightHeroEyebrow") : t("dailyGalleryPickEyebrow")}
                        </Text>
                        <Text style={styles.heroTitle} numberOfLines={2}>{dailyDiscovery.title}</Text>
                        <Text style={styles.heroSubtitle} numberOfLines={1}>
                          {t("byArtist")} {artistAndRegion}
                        </Text>
                        <View style={styles.heroRatingRow}>
                          <Ionicons
                            name={hasDiscoveryRating ? "star" : "star-outline"}
                            size={12}
                            color={hasDiscoveryRating ? "#F5A623" : colors.textMuted}
                          />
                          <Text style={styles.heroRatingText}>
                            {hasDiscoveryRating
                              ? `${dailyDiscovery.average_rating?.toFixed(1)} (${dailyDiscovery.review_count})`
                              : t("beFirstToReview")}
                          </Text>
                        </View>
                        {isSpotlightDiscovery && spotlightRemaining > 0 ? (
                          <Text style={styles.spotlightCountdown}>
                            {t("spotlightEndsIn", {
                              hours: String(spotlightHours),
                              minutes: String(spotlightMinutes),
                            })}
                          </Text>
                        ) : !isSpotlightDiscovery && discoveryPool.length > 1 ? (
                          <Text style={styles.spotlightCountdown}>
                            {t("newDiscoveryIn", {
                              hours: String(dailyRefreshHours),
                              minutes: String(dailyRefreshMinutes),
                            })}
                          </Text>
                        ) : null}
                        <Pressable
                          style={styles.heroButton}
                          onPress={() => openProduct(dailyDiscovery)}
                          accessibilityRole="button"
                        >
                          <Text style={styles.heroButtonText}>{t("viewArtwork")}</Text>
                          <Ionicons name="arrow-forward" size={15} color={colors.accentText} />
                        </Pressable>
                        <Pressable
                          style={styles.heroArtistLink}
                          onPress={() => router.push(`/artist/${dailyDiscovery.artist_id}`)}
                          accessibilityRole="button"
                        >
                          <Text style={styles.heroArtistLinkText}>{t("meetArtist")}</Text>
                          <Ionicons name="arrow-forward" size={13} color={colors.accent} />
                        </Pressable>
                      </View>
                    </View>
                  );
                })()}
                {!debouncedSearch && <><Text style={styles.sectionTitle}>{t("findYourMood")}</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.moodRow}>{[{ label: t("mood_african_heritage"), value: "african_heritage", icon: "earth-outline" }, { label: t("mood_calm"), value: "calm", icon: "leaf-outline" }, { label: t("mood_bold"), value: "bold", icon: "flash-outline" }, { label: t("mood_home_decor"), value: "home_decor", icon: "home-outline" }].map((mood) => <Pressable key={mood.value} style={[styles.moodChip, selectedMood === mood.value && styles.moodChipSelected]} onPress={() => setSelectedMood(selectedMood === mood.value ? "" : mood.value)}><Ionicons name={mood.icon as any} size={16} color={colors.accent} /><Text style={styles.moodText}>{mood.label}</Text></Pressable>)}</ScrollView><View style={styles.trustBanner}><Ionicons name="shield-checkmark-outline" size={20} color={colors.accent} /><View style={{ flex: 1 }}><Text style={styles.trustTitle}>{t("originalArtMaker")}</Text><Text style={styles.trustText}>{t("passportAvailable")}</Text></View></View></>}
              </View>
            }
            /*
                  {selectedCategory ? ` · ${CATEGORIES.find((c) => c.value === selectedCategory)?.label}` : ""}
                  {selectedRegion ? ` · ${REGIONS.find((r) => r.value === selectedRegion)?.label}` : ""}
            */
            ListEmptyComponent={() => {
              if (apiError) {
                return (
                  <View style={styles.emptyWrap}>
                    <Ionicons name="cloud-offline-outline" size={48} color={colors.accent} />
                    <Text style={[styles.emptyTitle, { color: colors.text, fontWeight: "700", fontSize: 16, marginTop: 12 }]}>
                      {t("offlineTitle") || "You're offline"}
                    </Text>
                    <Text style={{ textAlign: "center", color: colors.textMuted, fontSize: 13, marginTop: 6, lineHeight: 18, maxWidth: 280 }}>
                      {t("offlineDesc") || "No internet connection detected. Please check your network and try again."}
                    </Text>
                    <Pressable
                      onPress={onRefresh}
                      style={[styles.clearSearchAction, { marginTop: 16, backgroundColor: colors.accent, borderColor: colors.accent, paddingHorizontal: 20, paddingVertical: 8 }]}
                    >
                      <Text style={[styles.clearSearchActionText, { color: "#FFFFFF", fontWeight: "600" }]}>
                        {t("retry") || "Retry"}
                      </Text>
                    </Pressable>
                  </View>
                );
              }
              return (
                <View style={styles.emptyWrap}>
                  <Ionicons name="images-outline" size={44} color={colors.textMuted} />
                  <Text style={styles.emptyTitle}>
                    {debouncedSearch ? t("noSearchResults", { query: debouncedSearch }) : t("noProducts")}
                  </Text>
                  {debouncedSearch ? (
                    <Pressable onPress={() => setSearchText("")} style={[styles.clearSearchAction, { borderColor: colors.border }]}>
                      <Text style={styles.clearSearchActionText}>{t("clearSearchAction")}</Text>
                    </Pressable>
                  ) : null}
                </View>
              );
            }}
            renderItem={({ item }) => {
              const primaryImage = item.images?.find((img) => img.is_primary) || item.images?.[0];
              const imageUrl = resolveMediaUrl(primaryImage?.thumbnail || primaryImage?.image);
              const isFavorited = favoriteIds.has(item.id);

              return (
                <Pressable style={styles.card} onPress={() => openProduct(item)}>
                  <View style={styles.cardImageWrap}>
                    {imageUrl ? (
                      <Image source={{ uri: imageUrl }} style={styles.cardImage} resizeMode="contain" />
                    ) : (
                      <View style={styles.cardImageFallback}>
                        <Ionicons name="image-outline" size={32} color={colors.textMuted} />
                      </View>
                    )}
                    {item.is_sold && (
                      <View style={[styles.soldOverlay, { pointerEvents: "none" }]}>
                        <BlurView intensity={30} tint={mode === "dark" ? "dark" : "light"} style={StyleSheet.absoluteFill} />
                        <View style={styles.soldBadge}>
                          <Text style={styles.soldBadgeText}>{t("sold")}</Text>
                        </View>
                      </View>
                    )}
                    {(item.verification_level === "verified" || (item.originality_evidence_count || 0) > 0) && <View style={styles.originalBadge}><Ionicons name="shield-checkmark" size={11} color="#FFFFFF" /><Text style={styles.originalBadgeText}>{item.verification_level === "verified" ? t("fnaadVerifiedShort") : t("evidenceAvailableShort")}</Text></View>}
                    <Pressable
                      style={styles.heartButton}
                      onPress={(e) => {
                        e.stopPropagation();
                        handleToggleFavorite(item.id);
                      }}
                      hitSlop={10}
                    >
                      <Ionicons name={isFavorited ? "heart" : "heart-outline"} size={20} color={isFavorited ? "#E05252" : "#FFFFFF"} />
                    </Pressable>
                  </View>
                  <View style={styles.cardBody}>
                    <View style={styles.cardHeader}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.cardArtist} numberOfLines={1}>{item.artist_name}</Text>
                        <Text style={styles.cardCategory}>{item.category_display}</Text>
                      </View>
                      {item.artist_is_verified && <Ionicons name="checkmark-circle" size={13} color="#5FA779" style={{ marginLeft: 4 }} />}
                    </View>
                    <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
                    {item.average_rating != null && (
                      <View style={styles.ratingRow}>
                        <Ionicons name="star" size={12} color="#F5A623" />
                        <Text style={styles.ratingText}>{Number(item.average_rating).toFixed(1)}</Text>
                        {item.review_count > 0 && (
                          <Text style={styles.ratingCount}>({item.review_count})</Text>
                        )}
                      </View>
                    )}
                    <View style={styles.cardFooter}>
                      <Text style={styles.cardPrice}>{item.price_xaf != null ? `${formatPrice(item.price_xaf)} XAF` : "Price on request"}</Text>
                      {item.artist_region_display && (
                        <View style={styles.regionTag}>
                          <Ionicons name="location-outline" size={11} color={colors.textMuted} />
                          <Text style={styles.regionTagText} numberOfLines={1}>{item.artist_region_display}</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.cardSocialActions}>
                      <Pressable
                        style={styles.cardSocialAction}
                        onPress={(e) => {
                          e.stopPropagation();
                          handleToggleFavorite(item.id);
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={`${t("like")}: ${item.title}`}
                      >
                        <Ionicons name={isFavorited ? "heart" : "heart-outline"} size={14} color={isFavorited ? "#E05252" : colors.textMuted} />
                        <Text style={styles.cardSocialText}>{item.like_count || 0}</Text>
                      </Pressable>
                      <Pressable
                        style={styles.cardSocialAction}
                        onPress={(e) => { e.stopPropagation(); router.push(`/product/${item.id}`); }}
                        accessibilityRole="button"
                        accessibilityLabel={`${t("comment")}: ${item.title}`}
                      >
                        <Ionicons name="chatbubble-outline" size={14} color={colors.textMuted} />
                        <Text style={styles.cardSocialText}>{t("comment")}{item.comment_count ? ` ${item.comment_count}` : ""}</Text>
                      </Pressable>
                      <Pressable
                        style={styles.cardSocialAction}
                        onPress={(e) => { e.stopPropagation(); setShareProduct(item); }}
                        accessibilityRole="button"
                        accessibilityLabel={`${t("share")}: ${item.title}`}
                      >
                        <Ionicons name="share-social-outline" size={14} color={colors.textMuted} />
                        <Text style={styles.cardSocialText}>{t("share")}</Text>
                      </Pressable>
                    </View>
                  </View>
                </Pressable>
              );
            }}
          />
        )}
      </View>
      {shareProduct && (
        <ShareSheet
          visible={!!shareProduct}
          onClose={() => setShareProduct(null)}
          product={{
            title: shareProduct.title,
            url: shareProduct.public_url,
            imageUrl: resolveMediaUrl(
              (shareProduct.images.find((img) => img.is_primary) || shareProduct.images[0])?.image
            ),
            priceXaf: shareProduct.price_xaf,
            authorName: shareProduct.artist_name,
            authorAvatar: resolveMediaUrl(shareProduct.artist_avatar || undefined),
            authorVerified: shareProduct.artist_is_verified,
            description: shareProduct.description,
            category: shareProduct.category_display,
            isSold: shareProduct.is_sold,
          }}
        />
      )}
    </View>
  );
}

function createStyles(
  colors: ReturnType<typeof useTheme>["colors"],
  layout: ReturnType<typeof useResponsiveLayout>,
  fonts: ReturnType<typeof useTheme>["fonts"]
) {
  const listGap = layout.isTablet ? 14 : 0;
  const cardWidth: DimensionValue =
    layout.productColumns === 1
      ? "100%"
      : `${(100 - (layout.productColumns - 1) * 2) / layout.productColumns}%` as DimensionValue;

  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    page: {
      flex: 1,
      width: "100%",
      maxWidth: layout.maxContentWidth,
      alignSelf: "center",
      paddingTop: layout.topPadding,
      paddingHorizontal: layout.horizontalPadding,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 10,
      paddingVertical: 4,
      gap: layout.isSmallPhone ? 4 : 8,
    },
    brandLockup: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: layout.isSmallPhone ? 5 : 7,
      minWidth: 0,
    },
    brandLogo: { width: layout.isSmallPhone ? 26 : 30, height: layout.isSmallPhone ? 26 : 30 },
    brandCopy: { alignItems: "flex-start", minWidth: 0 },
    brandName: { color: colors.text, fontFamily: fonts.display, fontSize: layout.isSmallPhone ? 15 : 17, fontWeight: "800", letterSpacing: layout.isSmallPhone ? 1.2 : 2 },
    brandSubtitle: { color: colors.accent, fontSize: layout.isSmallPhone ? 6.5 : 7, fontWeight: "800", letterSpacing: 1, marginTop: 1 },
    headerActions: { flexDirection: "row", alignItems: "center", gap: layout.isSmallPhone ? 5 : 8 },
    becomeArtistText: { color: colors.accent, fontSize: 12, fontWeight: "700" },
    navLoginBtn: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: layout.isSmallPhone ? 8 : 10,
      paddingVertical: layout.isSmallPhone ? 5 : 6,
      borderRadius: 18,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    navLoginText: {
      color: colors.text,
      fontSize: layout.isSmallPhone ? 11 : 12,
      fontWeight: "700",
    },
    becomeArtistPill: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.accent,
      paddingHorizontal: layout.isSmallPhone ? 8 : 10,
      paddingVertical: layout.isSmallPhone ? 5 : 6,
      borderRadius: 18,
      elevation: 2,
      shadowColor: colors.accent,
      shadowOpacity: 0.2,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 2 },
    },
    becomeArtistPillText: {
      color: colors.accentText,
      fontSize: layout.isSmallPhone ? 11 : 12,
      fontWeight: "800",
    },
    artistInviteBanner: {
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.accent,
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
      elevation: 2,
      shadowColor: colors.accent,
      shadowOpacity: 0.12,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 3 },
    },
    artistInviteLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginBottom: 12,
    },
    artistInviteIconCircle: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.background,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.border,
    },
    artistInviteTitle: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "800",
    },
    artistInviteSub: {
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 16,
      marginTop: 2,
    },
    artistInviteCta: {
      backgroundColor: colors.accent,
      borderRadius: 10,
      paddingVertical: 10,
      paddingHorizontal: 16,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      alignSelf: "flex-start",
    },
    artistInviteCtaText: {
      color: colors.accentText,
      fontSize: 13,
      fontWeight: "800",
    },
    quickNavRail: { flexGrow: 0, marginTop: 12 },
    quickNavScroll: { flexDirection: "row", alignItems: "center", columnGap: 8, paddingRight: 12 },
    quickNavItem: { alignSelf: "flex-start", paddingVertical: 7, paddingHorizontal: 12, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
    quickNavText: { color: colors.text, fontSize: 12, fontWeight: "700" },
    galleryStatus: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 10, marginBottom: 2 },
    galleryStatusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#5FA779" },
    galleryStatusText: { color: colors.textMuted, fontSize: 11, fontWeight: "600" },
    profileButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center", overflow: "hidden" },
    profileImage: { width: 36, height: 36, borderRadius: 18 },
    profileInitial: { fontSize: 15, fontWeight: "800" },
    searchWrap: {
      flex: 1, flexDirection: "row", alignItems: "center",
      backgroundColor: colors.surface, borderRadius: RADIUS.pill,
      paddingHorizontal: layout.isSmallPhone ? 10 : 14, height: 44, borderWidth: 1, borderColor: colors.border,
    },
    searchIcon: { marginRight: layout.isSmallPhone ? 6 : 8 },
    searchInput: { flex: 1, color: colors.text, fontSize: 14 },
    clearSearchBtn: { marginLeft: 4 },
    searchRow: { flexDirection: "row", alignItems: "center", gap: layout.isSmallPhone ? 6 : 10, marginTop: 10 },
    filterButton: {
      width: 44, height: 44, borderRadius: RADIUS.md, borderWidth: 1, borderColor: colors.border,
      alignItems: "center", justifyContent: "center", backgroundColor: colors.surface,
    },
    filterBadge: { position: "absolute", top: -5, right: -5, backgroundColor: colors.accent, borderRadius: 8, minWidth: 18, height: 18, alignItems: "center", justifyContent: "center", paddingHorizontal: 5 },
    filterBadgeText: { color: colors.accentText, fontSize: 10, fontWeight: "700" },
    filterBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
    filterModal: { maxHeight: "80%", minHeight: 320, backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 16 },
    filterModalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1, borderColor: colors.border },
    filterModalTitle: { color: colors.text, fontSize: 17, fontWeight: "700" },
    filterModalHint: { color: colors.textMuted, fontSize: 12, paddingHorizontal: 20, paddingTop: 12, lineHeight: 18 },
    filterModalContent: { paddingHorizontal: 20, paddingBottom: 20 },
    filterSectionLabel: { color: colors.textMuted, fontSize: 11, fontWeight: "700", textTransform: "uppercase", marginTop: 18, marginBottom: 8, letterSpacing: 0.5 },
    filterChipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    filterChip: {
      borderWidth: 1, borderColor: colors.border, borderRadius: 20,
      paddingVertical: 9, paddingHorizontal: 15,
    },
    filterChipSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
    filterChipText: { color: colors.textMuted, fontSize: 12 },
    filterChipTextSelected: { color: colors.accentText, fontWeight: "700" },
    filterClearButton: { marginHorizontal: 20, marginBottom: 20, padding: 14, alignItems: "center", borderWidth: 1, borderColor: colors.border, borderRadius: 12 },
    filterClearButtonText: { color: colors.textMuted, fontSize: 14, fontWeight: "600" },
    productList: { flex: 1, width: "100%", marginTop: 2 },
    listContent: { paddingTop: 12, paddingBottom: 28 },
    discoveryHeader: { width: "100%", paddingBottom: 8 },
    welcomeHero: {
      minHeight: layout.isSmallPhone ? 170 : 190,
      flexDirection: "row",
      backgroundColor: colors.surface,
      borderRadius: 20,
      padding: layout.isSmallPhone ? 14 : 20,
      marginTop: 14,
      marginBottom: 18,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden",
      position: "relative",
    },
    welcomeHeroSpotlight: { paddingRight: "44%" },
    spotlightHero: { minHeight: layout.isSmallPhone ? 270 : 280, backgroundColor: colors.background },
    heroEmpty: { minHeight: layout.isSmallPhone ? 220 : 230 },
    spotlightWatermark: { position: "absolute", right: 28, top: 18, width: 150, height: 42, opacity: 0.18, zIndex: 2 },
    spotlightCountdown: { color: colors.accent, fontSize: 11, fontWeight: "800", marginTop: 8 },
    heroSpotlightImage: { position: "absolute", right: 0, top: 0, bottom: 0, width: "44%", opacity: 0.92 },
    heroImageFallback: { position: "absolute", right: 0, top: 0, bottom: 0, width: "44%", alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
    heroContent: { flex: 1, zIndex: 1 },
    heroEyebrow: { color: colors.accent, fontSize: 10, fontWeight: "800", letterSpacing: 1.5 },
    heroTitle: { color: colors.text, fontFamily: fonts.display, fontSize: layout.isSmallPhone ? 21 : 27, lineHeight: layout.isSmallPhone ? 26 : 32, fontWeight: "700", marginTop: 7 },
    heroSubtitle: { color: colors.textMuted, fontSize: layout.isSmallPhone ? 12 : 13, lineHeight: layout.isSmallPhone ? 17 : 19, marginTop: 7, maxWidth: 290 },
    heroRatingRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 6 },
    heroRatingText: { color: colors.textMuted, fontSize: 11, fontWeight: "600", flexShrink: 1 },
    heroButton: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: colors.accent, borderRadius: RADIUS.pill, paddingVertical: 10, paddingHorizontal: 14, marginTop: 14 },
    heroButtonText: { color: colors.accentText, fontSize: 12, fontWeight: "800" },
    heroArtistLink: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 6, marginTop: 2 },
    heroArtistLinkText: { color: colors.accent, fontSize: 12, fontWeight: "800" },
    heroMark: { width: 54, height: 54, borderRadius: 27, backgroundColor: colors.background, alignItems: "center", justifyContent: "center", marginLeft: 8 },
    sectionTitle: { color: colors.text, fontSize: 16, fontWeight: "800", marginBottom: 9 },
    storiesSection: { marginBottom: 16 },
    storiesRail: { gap: 14, paddingVertical: 3, paddingHorizontal: 2 },
    storyArtistButton: { width: 70, alignItems: "center", gap: 5 },
    storyRing: { width: 62, height: 62, borderRadius: 31, borderWidth: 2, borderColor: colors.accent, padding: 3, position: "relative" },
    storyAvatar: { width: "100%", height: "100%", borderRadius: 28 },
    storyAvatarFallback: { width: "100%", height: "100%", borderRadius: 28, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
    storyAvatarInitial: { color: colors.accent, fontSize: 21, fontWeight: "800" },
    storyVideoBadge: { position: "absolute", right: -2, bottom: -1, width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: colors.accent, borderWidth: 2, borderColor: colors.background },
    storyArtistLabel: { maxWidth: 70, color: colors.textMuted, fontSize: 10, fontWeight: "700", textAlign: "center" },
    storiesEmpty: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.surface },
    storiesEmptyText: { flex: 1, color: colors.textMuted, fontSize: 12 },
    storyBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.92)", justifyContent: "center", alignItems: "center", padding: 14 },
    storyViewer: { width: "100%", height: "90%", maxWidth: 480, maxHeight: 850, borderRadius: 20, overflow: "hidden", backgroundColor: "#111111", position: "relative" },
    storyMedia: { ...StyleSheet.absoluteFill, width: "100%", height: "100%" },
    storyMediaFallback: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },
    storyTextStatus: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center", padding: 30, backgroundColor: "#17121B" },
    storyTextStatusBody: { color: "#FFFFFF", fontSize: 22, lineHeight: 30, fontWeight: "700", textAlign: "center", marginTop: 16 },
    storyTopOverlay: { position: "absolute", top: 0, left: 0, right: 0, paddingTop: 12, paddingHorizontal: 12, backgroundColor: "rgba(0,0,0,0.35)" },
    storyProgressRow: { flexDirection: "row", gap: 4, marginBottom: 12 },
    storyProgressTrack: { flex: 1, height: 3, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.42)", overflow: "hidden" },
    storyProgressFill: { width: 0, height: "100%", backgroundColor: "#FFFFFF" },
    storyProgressComplete: { width: "100%" },
    storyArtistHeader: { flexDirection: "row", alignItems: "center", gap: 9, paddingBottom: 10 },
    storyHeaderAvatar: { width: 34, height: 34, borderRadius: 17 },
    storyHeaderAvatarFallback: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: colors.accent },
    storyHeaderInitial: { color: colors.accentText, fontWeight: "800" },
    storyArtistName: { color: "#FFFFFF", fontSize: 14, fontWeight: "800", maxWidth: "48%" },
    storyPublishedAt: { flex: 1, color: "rgba(255,255,255,0.78)", fontSize: 11 },
    storyPreviousArea: { position: "absolute", top: 60, bottom: 110, left: 0, width: "35%" },
    storyNextArea: { position: "absolute", top: 60, bottom: 110, right: 0, width: "65%" },
    storyBottomOverlay: { position: "absolute", left: 0, right: 0, bottom: 0, padding: 16, paddingTop: 36, gap: 10, backgroundColor: "rgba(0,0,0,0.62)" },
    storyCaption: { color: "#FFFFFF", fontSize: 14, lineHeight: 20 },
    storyActions: { flexDirection: "row", alignItems: "center", gap: 20 },
    storyActionButton: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 36 },
    storyActionText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },
    storyActionError: { color: "#FFD4D4", fontSize: 12 },
    storyShopButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, alignSelf: "stretch", minHeight: 46, borderRadius: 24, backgroundColor: colors.accent },
    storyShopText: { color: colors.accentText, fontSize: 13, fontWeight: "800" },
    storyCommentsPanel: { padding: 10, borderRadius: 12, backgroundColor: "rgba(0,0,0,0.55)", gap: 8 },
    storyCommentsList: { maxHeight: 130 },
    storyComment: { paddingVertical: 5, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(255,255,255,0.2)" },
    storyCommentAuthor: { color: "#FFFFFF", fontSize: 12, fontWeight: "800" },
    storyCommentBody: { color: "#FFFFFF", fontSize: 12, marginTop: 2 },
    storyCommentAge: { color: "rgba(255,255,255,0.65)", fontSize: 10, marginTop: 2 },
    storyCommentsEmpty: { color: "rgba(255,255,255,0.8)", fontSize: 12, paddingVertical: 4 },
    storyCommentComposer: { minHeight: 42, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.35)", borderRadius: 22 },
    storyCommentInput: { flex: 1, color: "#FFFFFF", fontSize: 13, paddingVertical: 8 },
    moodRow: { gap: 8, paddingBottom: 16 },
    moodChip: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: RADIUS.pill, paddingVertical: 9, paddingHorizontal: 12 },
    moodChipSelected: { borderColor: colors.accent, backgroundColor: colors.surface },
    moodText: { color: colors.text, fontSize: 11, fontWeight: "700" },
    trustBanner: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: 12, marginBottom: 15 },
    trustTitle: { color: colors.text, fontSize: 12, fontWeight: "800" },
    trustText: { color: colors.textMuted, fontSize: 11, marginTop: 3 },
    productRow: { columnGap: listGap, justifyContent: "space-between" },
    resultsText: { color: colors.textMuted, fontSize: 12, fontWeight: "600", marginBottom: 10 },
    skeletonGrid: { flexDirection: "row", flexWrap: "wrap", columnGap: listGap, paddingTop: 12 },
    ratingRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 },
    ratingText: { color: colors.text, fontSize: 12, fontWeight: "700" },
    ratingCount: { color: colors.textMuted, fontSize: 11 },
    clearSearchAction: { marginTop: 16, borderWidth: 1, borderRadius: 999, paddingVertical: 9, paddingHorizontal: 20 },
    clearSearchActionText: { color: colors.text, fontSize: 13, fontWeight: "700" },
    card: {
      width: cardWidth,
      backgroundColor: colors.surface,
      borderRadius: RADIUS.lg,
      overflow: "hidden",
      marginBottom: 14,
      borderWidth: 1,
      borderColor: colors.border,
      ...shadow(2),
    },
    cardImageWrap: { position: "relative", backgroundColor: colors.background },
    cardImage: { width: "100%", aspectRatio: 1, backgroundColor: colors.background },
    cardImageFallback: { width: "100%", aspectRatio: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
    soldOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, justifyContent: "center", alignItems: "center" },
    soldBadge: {
      backgroundColor: "#B0524F",
      paddingHorizontal: 18,
      paddingVertical: 8,
      borderRadius: RADIUS.sm,
      transform: [{ rotate: "-6deg" }],
    },
    soldBadgeText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800", letterSpacing: 1.5, textTransform: "uppercase" },
    heartButton: {
      position: "absolute", top: 10, right: 10,
      backgroundColor: "rgba(0,0,0,0.5)",
      borderRadius: 20, width: 36, height: 36,
      alignItems: "center", justifyContent: "center",
      borderWidth: 1, borderColor: "rgba(255,255,255,0.15)",
    },
    originalBadge: { position: "absolute", left: 9, top: 9, flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(42,105,78,0.92)", borderRadius: 999, paddingVertical: 5, paddingHorizontal: 8 },
    originalBadgeText: { color: "#FFFFFF", fontSize: 9, fontWeight: "800" },
    cardBody: { padding: 12 },
    cardHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
    cardArtist: { color: colors.textMuted, fontSize: 11, fontWeight: "600" },
    cardCategory: { color: colors.accent, fontSize: 10, marginTop: 1, textTransform: "uppercase", fontWeight: "700", letterSpacing: 0.4 },
    cardTitle: { color: colors.text, fontFamily: fonts.display, fontSize: 15, fontWeight: "700", lineHeight: 19, marginTop: 2 },
    cardFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 10 },
    cardPrice: { color: colors.accent, fontSize: 14, fontWeight: "800", letterSpacing: 0.2 },
    regionTag: { flexDirection: "row", alignItems: "center", gap: 3, maxWidth: 100 },
    regionTagText: { color: colors.textMuted, fontSize: 10 },
    cardSocialActions: { flexDirection: "row", borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border, paddingVertical: 8, marginTop: 10 },
    cardSocialAction: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 3, paddingVertical: 3 },
    cardSocialText: { color: colors.textMuted, fontSize: layout.isSmallPhone ? 9.5 : 10, fontWeight: "600" },
    emptyWrap: { alignItems: "center", justifyContent: "center", paddingTop: 100, paddingHorizontal: 40 },
    emptyTitle: { color: colors.textMuted, fontSize: 14, marginTop: 14, textAlign: "center", fontWeight: "500" },
    loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80 },
  });
}
