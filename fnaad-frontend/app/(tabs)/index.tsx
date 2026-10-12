import { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Pressable, ScrollView, TextInput, Modal, RefreshControl } from "react-native";
import Image from "../../components/MediaImage";
import type { DimensionValue } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { api, resolveMediaUrl, toggleFavorite, getFavoriteIds, unwrapList } from "../../services/api";
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
  average_rating: number | null;
  review_count: number;
  like_count?: number;
  comment_count?: number;
  is_sold?: boolean;
  public_url: string;
  images: { image: string; thumbnail?: string | null; is_primary: boolean }[];
};

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
  const { loggedIn, initializing, user } = useAuth();
  const { t } = useLanguage();
  const { colors, mode } = useTheme();
  const layout = useResponsiveLayout();
  const styles = createStyles(colors, layout);
  const productColumns = layout.productColumns;

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedSort, setSelectedSort] = useState("newest");
  const [searchText, setSearchText] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [favoriteIds, setFavoriteIds] = useState<Set<number>>(new Set());
  const [shareProduct, setShareProduct] = useState<Product | null>(null);
  const [filterVisible, setFilterVisible] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const activeFilterCount = [selectedRegion, selectedCategory, selectedSort !== "newest"].filter(Boolean).length;

  const loadProducts = (region: string, category: string, search: string, sort: string) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (region) params.append("region", region);
    if (category) params.append("category", category);
    if (search) params.append("search", search);
    if (sort) params.append("sort", sort);
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
    const query = params.toString();
    const url = query ? `/catalog/products/?${query}` : "/catalog/products/";
    api
      .get(url, { skipAuth: true } as any)
      .then((res) => setProducts(unwrapList(res.data)))
      .catch((err) => console.log("API error:", err.message))
      .finally(() => setRefreshing(false));
  }, [selectedRegion, selectedCategory, selectedSort, debouncedSearch]);

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
  }, [selectedRegion, selectedCategory, debouncedSearch, selectedSort]);

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
        <View style={styles.headerRow}>
          {!loggedIn && (
            <Pressable onPress={() => router.push("/role-select")}>
              <Text style={styles.becomeArtistText}>{t("becomeArtist")}</Text>
            </Pressable>
          )}
          <Image
            source={require("../../assets/logo-header.png")}
            style={{ width: 140, height: 48 }}
            resizeMode="contain"
          />
          <View style={styles.headerActions}><LanguageSwitcher /></View>
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

        <View style={styles.sanaaRow}>
          <Pressable
            style={styles.aiButton}
            onPress={() => router.push("/assistant")}
          >
            <Ionicons name="sparkles-outline" size={16} color={colors.accent} style={{ marginRight: 6 }} />
            <Text style={styles.aiButtonText}>{t("askSanaa")}</Text>
          </Pressable>
          {loggedIn ? <Pressable style={styles.profileButton} onPress={() => router.push("/(tabs)/profile")} accessibilityRole="button" accessibilityLabel="Open profile">
            {user?.profile_photo ? <Image source={{ uri: resolveMediaUrl(user.profile_photo)! }} style={styles.profileImage} /> : <Text style={[styles.profileInitial, { color: colors.accentText }]}>{(user?.username || "U").slice(0, 1).toUpperCase()}</Text>}
          </Pressable> : null}
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
              products.length > 0 ? (
                <Text style={styles.resultsText}>
                  {products.length} {products.length === 1 ? "artwork" : "artworks"}
                  {selectedCategory ? ` · ${CATEGORIES.find((c) => c.value === selectedCategory)?.label}` : ""}
                  {selectedRegion ? ` · ${REGIONS.find((r) => r.value === selectedRegion)?.label}` : ""}
                </Text>
              ) : null
            }
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Ionicons name={apiError ? "wifi-outline" : "images-outline"} size={44} color={apiError ? "#E05252" : colors.textMuted} />
                <Text style={[styles.emptyTitle, apiError ? { color: "#E05252" } : {}]}>
                  {apiError ? `Cannot reach server:\n${apiError}` : debouncedSearch ? `No results for "${debouncedSearch}"` : t("noProducts")}
                </Text>
                {debouncedSearch && !apiError && (
                  <Pressable onPress={() => setSearchText("")} style={[styles.clearSearchAction, { borderColor: colors.border }]}>
                    <Text style={styles.clearSearchActionText}>Clear search</Text>
                  </Pressable>
                )}
              </View>
            }
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
  layout: ReturnType<typeof useResponsiveLayout>
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
    headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
    headerActions: { flexDirection: "row", alignItems: "center", gap: 8 },
    becomeArtistText: { color: colors.accent, fontSize: 12, fontWeight: "700" },
    sanaaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 14 },
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
    productRow: { columnGap: listGap, justifyContent: "space-between" },
    resultsText: { color: colors.textMuted, fontSize: 12, fontWeight: "600", marginBottom: 10 },
    skeletonGrid: { flexDirection: "row", flexWrap: "wrap", columnGap: listGap, paddingTop: 12 },
    ratingRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 },
    ratingText: { color: colors.text, fontSize: 12, fontWeight: "700" },
    ratingCount: { color: colors.textMuted, fontSize: 11 },
    clearSearchAction: { marginTop: 16, borderWidth: 1, borderRadius: 999, paddingVertical: 9, paddingHorizontal: 20 },
    clearSearchActionText: { color: colors.text, fontSize: 13, fontWeight: "700" },
    aiButton: {
      borderWidth: 1.5,
      borderColor: colors.accent,
      borderRadius: RADIUS.pill,
      paddingVertical: 11,
      paddingHorizontal: 18,
      flex: 1,
      backgroundColor: colors.surface,
      flexDirection: "row",
      alignItems: "center",
    },
    aiButtonText: {
      color: colors.accent,
      fontWeight: "700",
      fontSize: 13,
    },
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
    cardBody: { padding: 12 },
    cardHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
    cardArtist: { color: colors.textMuted, fontSize: 11, fontWeight: "600" },
    cardCategory: { color: colors.accent, fontSize: 10, marginTop: 1, textTransform: "uppercase", fontWeight: "700", letterSpacing: 0.4 },
    cardTitle: { color: colors.text, fontSize: 14, fontWeight: "700", lineHeight: 18, marginTop: 2 },
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
