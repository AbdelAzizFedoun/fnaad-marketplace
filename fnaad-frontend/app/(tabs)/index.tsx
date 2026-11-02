import { useEffect, useState, useCallback, useRef } from "react";
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Pressable, ScrollView, TextInput, Modal, RefreshControl, Image as NativeImage, PanResponder, Share } from "react-native";
import Image from "../../components/MediaImage";
import type { DimensionValue } from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { api, createStoryComment, getStoryComments, recordStoryView, resolveMediaUrl, toggleFavorite, toggleStoryLike, getFavoriteIds, unwrapList } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import { useTheme } from "../../context/ThemeContext";
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
  price_xaf: number;
  category_display: string;
  artist_id: number;
  artist_name: string;
  artist_avatar: string | null;
  artist_region: string | null;
  artist_region_display: string | null;
  artist_is_verified: boolean;
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
  media_type: "image" | "video";
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

const SHOWCASE_INFO = [
  { eyebrow: "FROM FNAAD ARTISTS", title: "Art made by people.", subtitle: "Meet independent artists and find something meaningful to keep." },
  { eyebrow: "ORIGINALITY MATTERS", title: "Discover with confidence.", subtitle: "Every featured artwork comes from a real artist and a real customer experience." },
  { eyebrow: "COME BACK TOMORROW", title: "Fresh stories, every day.", subtitle: "See who the FNAAD community is celebrating right now." },
];

const CATEGORIES = [
  { value: "", labelKey: "allCategories" },
  { value: "painting", label: "Painting" },
  { value: "drawing", label: "Drawing" },
  { value: "abstract", label: "Abstract art" },
  { value: "sculpture", label: "Sculpture" },
  { value: "portrait", label: "Portrait" },
  { value: "home_design", label: "Home Design" },
  { value: "contemporary", label: "Contemporary Art" },
  { value: "calligraphy", label: "Calligraphy" },
  { value: "artisan_crafts", label: "Artisan Crafts" },
  { value: "hall_of_fame", label: "Hall of Fame" },
  { value: "other", label: "Other" },
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
  const [spotlightLoading, setSpotlightLoading] = useState(true);
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
  const [showcaseIndex, setShowcaseIndex] = useState(0);
  const spotlightPanResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderRelease: (_, gesture) => {
      if (Math.abs(gesture.dx) > 45 && showcaseItems.length > 1) setShowcaseIndex((current) => gesture.dx < 0 ? (current + 1) % showcaseItems.length : (current - 1 + showcaseItems.length) % showcaseItems.length);
    },
  })).current;

  const activeFilterCount = [selectedRegion, selectedCategory, selectedSort !== "newest"].filter(Boolean).length;
  const showcaseItems = [...SHOWCASE_INFO, ...spotlight];
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
            setSpotlightLoading(false);
          }
        }
        const res = await api.get("/catalog/spotlight/", { skipAuth: true } as any);
        const items = unwrapList<SpotlightProduct>(res.data);
        setSpotlight(items);
        await AsyncStorage.setItem(cacheKey, JSON.stringify({ savedAt: Date.now(), items }));
        await Promise.all(items.slice(0, 6).flatMap((item) => (item.images || []).slice(0, 2).map((image) => image.image ? NativeImage.prefetch(resolveMediaUrl(image.image)!) : Promise.resolve(false))));
      } catch {
        setSpotlight((current) => current);
      } finally {
        setSpotlightLoading(false);
      }
    };
    void loadSpotlight();
  }, []);

  useEffect(() => {
    api.get("/catalog/stories/?page_size=100")
      .then((response) => setStories(unwrapList<ArtistStory>(response.data)))
      .catch((error) => console.warn("Unable to load Studio Stories:", error.message));
  }, []);

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

  useEffect(() => {
    if (showcaseItems.length < 2) return;
    const timer = setInterval(() => setShowcaseIndex((current) => (current + 1) % showcaseItems.length), 6500);
    return () => clearInterval(timer);
  }, [spotlight.length]);

  useEffect(() => {
    if (showcaseIndex >= showcaseItems.length) setShowcaseIndex(0);
  }, [showcaseItems.length, showcaseIndex]);
  useEffect(() => { const timer = setInterval(() => setCountdownNow(Date.now()), 1000); return () => clearInterval(timer); }, []);

  const loadProducts = (region: string, category: string, search: string, sort: string) => {
    setLoading(true);
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
      .then((res) => { setProducts(unwrapList(res.data)); setApiError(null); })
      .catch((err) => { console.log("API error:", err.message); setApiError(err.message || "Network error"); })
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
        setProducts(unwrapList(res.data));
        setApiError(null);
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
      .then((res) => setFavoriteIds(new Set(res.data.favorite_ids)))
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
              <Text style={styles.brandSubtitle}>ART MARKETPLACE</Text>
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
                <Text style={styles.becomeArtistPillText}>Join</Text>
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
            { label: t("spotlight"), onPress: () => setShowcaseIndex(Math.min(SHOWCASE_INFO.length, showcaseItems.length - 1)) },
            { label: t("forMyHome"), onPress: () => setSelectedMood("home_decor") },
          ].map((item) => (
            <Pressable key={item.label} onPress={item.onPress} style={styles.quickNavItem}>
              <Text style={styles.quickNavText}>{item.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <View style={styles.galleryStatus}>
          <View style={styles.galleryStatusDot} />
          <Text style={styles.galleryStatusText}>Today at FNAAD · {spotlight.length || 0} artists in the 24h Spotlight</Text>
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
                        {c.value === "" ? t((c.labelKey || c.label) as string) : c.label}
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
                {activeStory.media_type === "video" && activeStory.video ? (
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
                {/* ── Become an Artist Invitation Banner (for visitors) ── */}
                {!loggedIn && (
                  <View style={styles.artistInviteBanner}>
                    <View style={styles.artistInviteLeft}>
                      <View style={styles.artistInviteIconCircle}>
                        <Ionicons name="color-palette" size={24} color={colors.accent} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.artistInviteTitle}>
                          {t("joinAsArtistBannerTitle") || "Are you an Artist or Artisan?"}
                        </Text>
                        <Text style={styles.artistInviteSub}>
                          {t("joinAsArtistBannerSub") || "Open your mobile gallery, gain verified collectors & receive Mobile Money payouts."}
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
                  const item = showcaseItems[showcaseIndex];
                  const spotlightItem = item && !("eyebrow" in item) ? item as SpotlightProduct : null;
                  const infoItem = !spotlightItem ? item as typeof SHOWCASE_INFO[number] : null;
                  const primaryImage = spotlightItem?.images?.find((image) => image.is_primary) || spotlightItem?.images?.[0];
                  const remaining = spotlightItem?.spotlight_expires_at ? Math.max(0, new Date(spotlightItem.spotlight_expires_at).getTime() - countdownNow) : 0;
                  const remainingHours = Math.floor(remaining / 3600000);
                  const remainingMinutes = Math.floor((remaining % 3600000) / 60000);
                  return <View {...spotlightPanResponder.panHandlers} style={[styles.welcomeHero, spotlightItem && styles.welcomeHeroSpotlight, spotlightItem && styles.spotlightHero]}>
                    {spotlightItem && <Image source={require("../../assets/logo-full-transparent.png")} style={styles.spotlightWatermark} resizeMode="contain" />}
                    {primaryImage?.image ? <Image source={{ uri: resolveMediaUrl(primaryImage.image)! }} style={styles.heroSpotlightImage} resizeMode="cover" /> : null}
                    <View style={styles.heroContent}><Text style={styles.heroEyebrow}>{spotlightItem ? "FNAAD SPOTLIGHT · TOP RATED" : infoItem?.eyebrow}</Text><Text style={styles.heroTitle}>{spotlightItem?.title || infoItem?.title}</Text><Text style={styles.heroSubtitle}>{spotlightItem ? `by ${spotlightItem.artist_name} · ${spotlightItem.average_rating?.toFixed(1) || "5.0"} ★` : infoItem?.subtitle}</Text><Pressable style={styles.heroButton} onPress={() => spotlightItem ? router.push(`/product/${spotlightItem.id}`) : setSelectedCategory("painting")}><Text style={styles.heroButtonText}>{spotlightItem ? "View artwork" : "Browse artworks"}</Text><Ionicons name="arrow-forward" size={15} color={colors.accentText} /></Pressable></View>
                    {showcaseItems.length > 1 && <View style={styles.showcaseDots}>{showcaseItems.map((_, index) => <Pressable key={index} onPress={() => setShowcaseIndex(index)} style={[styles.showcaseDot, index === showcaseIndex && styles.showcaseDotActive]} />)}</View>}
                  </View>;
                })()}
                {!debouncedSearch && products.length > 0 && (() => { const featured = products[0]; const image = featured.images?.find((item) => item.is_primary) || featured.images?.[0]; return <Pressable style={styles.featuredCard} onPress={() => router.push(`/product/${featured.id}`)}><Image source={image?.image ? { uri: resolveMediaUrl(image.image)! } : undefined} style={styles.featuredImage} resizeMode="cover" /><View style={styles.featuredOverlay}><Text style={styles.featuredEyebrow}>FEATURED TODAY</Text><Text style={styles.featuredTitle}>{featured.title}</Text><Text style={styles.featuredArtist}>by {featured.artist_name}{featured.artist_region_display ? ` · ${featured.artist_region_display}` : ""}</Text></View></Pressable>; })()}
                {!debouncedSearch && <><Text style={styles.sectionTitle}>{t("findYourMood")}</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.moodRow}>{[{ label: "African heritage", value: "african_heritage", icon: "earth-outline" }, { label: "Calm", value: "calm", icon: "leaf-outline" }, { label: "Bold & modern", value: "bold", icon: "flash-outline" }, { label: "For my home", value: "home_decor", icon: "home-outline" }].map((mood) => <Pressable key={mood.value} style={[styles.moodChip, selectedMood === mood.value && styles.moodChipSelected]} onPress={() => setSelectedMood(selectedMood === mood.value ? "" : mood.value)}><Ionicons name={mood.icon as any} size={16} color={colors.accent} /><Text style={styles.moodText}>{mood.label}</Text></Pressable>)}</ScrollView><View style={styles.trustBanner}><Ionicons name="shield-checkmark-outline" size={20} color={colors.accent} /><View style={{ flex: 1 }}><Text style={styles.trustTitle}>{t("originalArtMaker")}</Text><Text style={styles.trustText}>{t("passportAvailable")}</Text></View></View></>}
              </View>
            }
            /*
                  {selectedCategory ? ` · ${CATEGORIES.find((c) => c.value === selectedCategory)?.label}` : ""}
                  {selectedRegion ? ` · ${REGIONS.find((r) => r.value === selectedRegion)?.label}` : ""}
            */
            ListEmptyComponent={() => (
              <View style={styles.emptyWrap}>
                <Ionicons name={apiError ? "wifi-outline" : "images-outline"} size={44} color={apiError ? "#E05252" : colors.textMuted} />
                <Text style={[styles.emptyTitle, apiError ? { color: "#E05252" } : {}]}>
                  {apiError ? `Cannot reach server:\n${apiError}` : debouncedSearch ? `No results for "${debouncedSearch}"` : t("noProducts")}
                </Text>
                {debouncedSearch && !apiError ? (
                  <Pressable onPress={() => setSearchText("")} style={[styles.clearSearchAction, { borderColor: colors.border }]}>
                    <Text style={styles.clearSearchActionText}>Clear search</Text>
                  </Pressable>
                ) : null}
              </View>
            )}
            renderItem={({ item }) => {
              const primaryImage = item.images?.find((img) => img.is_primary) || item.images?.[0];
              const imageUrl = resolveMediaUrl(primaryImage?.thumbnail || primaryImage?.image);
              const isFavorited = favoriteIds.has(item.id);

              return (
                <Pressable style={styles.card} onPress={() => router.push(`/product/${item.id}`)}>
                  <View style={styles.cardImageWrap}>
                    {imageUrl ? (
                      <Image source={{ uri: imageUrl }} style={styles.cardImage} resizeMode="cover" />
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
                    {(item.verification_level === "verified" || (item.originality_evidence_count || 0) > 0) && <View style={styles.originalBadge}><Ionicons name="shield-checkmark" size={11} color="#FFFFFF" /><Text style={styles.originalBadgeText}>{item.verification_level === "verified" ? "FNAAD verified" : "Evidence available"}</Text></View>}
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
                      <Text style={styles.cardPrice}>{formatPrice(item.price_xaf)} XAF</Text>
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
    headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10, paddingVertical: 4 },
    brandLockup: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
    brandLogo: { width: 30, height: 30 },
    brandCopy: { alignItems: "flex-start" },
    brandName: { color: colors.text, fontFamily: fonts.display, fontSize: 17, fontWeight: "800", letterSpacing: 2 },
    brandSubtitle: { color: colors.accent, fontSize: 7, fontWeight: "800", letterSpacing: 1.2, marginTop: 1 },
    headerActions: { flexDirection: "row", alignItems: "center", gap: 8 },
    becomeArtistText: { color: colors.accent, fontSize: 12, fontWeight: "700" },
    navLoginBtn: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 18,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    navLoginText: {
      color: colors.text,
      fontSize: 12,
      fontWeight: "700",
    },
    becomeArtistPill: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.accent,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 18,
      elevation: 2,
      shadowColor: colors.accent,
      shadowOpacity: 0.2,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 2 },
    },
    becomeArtistPillText: {
      color: colors.accentText,
      fontSize: 12,
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
      paddingHorizontal: 14, height: 46, borderWidth: 1, borderColor: colors.border,
    },
    searchIcon: { marginRight: 8 },
    searchInput: { flex: 1, color: colors.text, fontSize: 14 },
    clearSearchBtn: { marginLeft: 6 },
    searchRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 14 },
    filterButton: {
      width: 46, height: 46, borderRadius: RADIUS.md, borderWidth: 1, borderColor: colors.border,
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
    welcomeHero: { minHeight: 190, flexDirection: "row", backgroundColor: colors.surface, borderRadius: 20, padding: 20, marginTop: 14, marginBottom: 18, borderWidth: 1, borderColor: colors.border, overflow: "hidden", position: "relative" },
    welcomeHeroSpotlight: { paddingRight: 120 },
    spotlightHero: { minHeight: 220, backgroundColor: colors.background },
    spotlightWatermark: { position: "absolute", right: 28, top: 18, width: 150, height: 42, opacity: 0.18, zIndex: 2 },
    spotlightCountdown: { color: colors.accent, fontSize: 11, fontWeight: "800", marginTop: 8 },
    heroSpotlightImage: { position: "absolute", right: 0, top: 0, bottom: 0, width: 120, opacity: 0.82 },
    heroContent: { flex: 1, zIndex: 1 },
    showcaseDots: { position: "absolute", right: 16, bottom: 14, flexDirection: "row", gap: 5 },
    showcaseDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.border },
    showcaseDotActive: { width: 18, backgroundColor: colors.accent },
    heroEyebrow: { color: colors.accent, fontSize: 10, fontWeight: "800", letterSpacing: 1.5 },
    heroTitle: { color: colors.text, fontFamily: fonts.display, fontSize: 27, lineHeight: 32, fontWeight: "700", marginTop: 7 },
    heroSubtitle: { color: colors.textMuted, fontSize: 13, lineHeight: 19, marginTop: 7, maxWidth: 290 },
    heroButton: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: colors.accent, borderRadius: RADIUS.pill, paddingVertical: 10, paddingHorizontal: 14, marginTop: 14 },
    heroButtonText: { color: colors.accentText, fontSize: 12, fontWeight: "800" },
    heroMark: { width: 54, height: 54, borderRadius: 27, backgroundColor: colors.background, alignItems: "center", justifyContent: "center", marginLeft: 8 },
    featuredCard: { height: 210, borderRadius: 20, overflow: "hidden", marginBottom: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
    featuredImage: { width: "100%", height: "100%", backgroundColor: colors.border },
    featuredOverlay: { position: "absolute", left: 0, right: 0, bottom: 0, padding: 16, paddingTop: 42, backgroundColor: "rgba(0,0,0,0.58)" },
    featuredEyebrow: { color: "#E8C878", fontSize: 10, fontWeight: "800", letterSpacing: 1.3 },
    featuredTitle: { color: "#FFFFFF", fontFamily: fonts.display, fontSize: 21, fontWeight: "700", marginTop: 4 },
    featuredArtist: { color: "rgba(255,255,255,0.8)", fontSize: 12, marginTop: 3 },
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
    cardSocialAction: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 3 },
    cardSocialText: { color: colors.textMuted, fontSize: 10, fontWeight: "600" },
    emptyWrap: { alignItems: "center", justifyContent: "center", paddingTop: 100, paddingHorizontal: 40 },
    emptyTitle: { color: colors.textMuted, fontSize: 14, marginTop: 14, textAlign: "center", fontWeight: "500" },
    loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80 },
  });
}
