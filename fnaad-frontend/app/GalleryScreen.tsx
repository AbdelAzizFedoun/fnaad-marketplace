import { useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Pressable, ScrollView, TextInput } from "react-native";
import Image from "../components/MediaImage";
import { useRouter } from "expo-router";
import { api, resolveMediaUrl, unwrapList } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { useTheme } from "../context/ThemeContext";
import { useResponsiveLayout } from "../hooks/useResponsiveLayout";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { shadow, RADIUS } from "../components/shadow";
import { Ionicons } from "@expo/vector-icons";
import React from "react";

type Product = {
  is_sold?: boolean;
  id: number;
  title: string;
  price_xaf: number;
  category_display: string;
  artist_id: number;
  artist_name: string;
  artist_region: string | null;
  artist_region_display: string | null;
  artist_is_verified: boolean;
  images: { image: string; is_primary: boolean }[];
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

const GAP = 12;
const SIDE_PAD = 16;
const COLUMNS_MOBILE = 2;
const COLUMNS_DESKTOP = 3;

export default function GalleryScreen() {
  const router = useRouter();
  const { loggedIn, initializing, logout, user } = useAuth();
  const { t } = useLanguage();
  const { colors } = useTheme();
  const { topPadding, width: screenWidth, isDesktop, maxContentWidth } = useResponsiveLayout();
  const styles = createStyles(colors, topPadding);
  const insets = useSafeAreaInsets();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRegion, setSelectedRegion] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [searchText, setSearchText] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const columns = isDesktop ? COLUMNS_DESKTOP : COLUMNS_MOBILE;
  const availableWidth = Math.min(screenWidth, isDesktop ? maxContentWidth : screenWidth) - SIDE_PAD * 2;
  const cardWidth = (availableWidth - GAP * (columns - 1)) / columns;

  const loadProducts = (region: string, category: string, search: string) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (region) params.append("region", region);
    if (category) params.append("category", category);
    if (search) params.append("search", search);
    const query = params.toString();
    const url = query ? `/catalog/products/?${query}` : "/catalog/products/";
    api
      .get(url, { skipAuth: true } as any)
      .then((res) => setProducts(unwrapList(res.data)))
      .catch((err) => console.log("API error:", err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(searchText), 400);
    return () => clearTimeout(timeout);
  }, [searchText]);

  useEffect(() => {
    loadProducts(selectedRegion, selectedCategory, debouncedSearch);
  }, [selectedRegion, selectedCategory, debouncedSearch]);

  if (initializing) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color={colors.accent} style={{ marginTop: 60 }} />
      </View>
    );
  }

  const hasActiveFilter = selectedRegion !== "" || selectedCategory !== "" || debouncedSearch !== "";

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.wordmark}>{t("appName")}</Text>
            <Text style={styles.tagline}>{t("galleryTagline")}</Text>
          </View>
          <View style={styles.headerActions}>
            {loggedIn && (
              <Pressable style={styles.iconButton} onPress={() => router.push("/settings")} accessibilityRole="button" accessibilityLabel="Settings">
                <Ionicons name="settings-outline" size={20} color={colors.text} />
              </Pressable>
            )}
          </View>
        </View>

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
            <Pressable onPress={() => setSearchText("")} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </Pressable>
          )}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {REGIONS.map((r) => {
            const active = selectedRegion === r.value;
            return (
              <Pressable
                key={r.value}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setSelectedRegion(r.value)}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {r.value === "" ? t("allRegions") : r.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {CATEGORIES.map((c) => {
            const active = selectedCategory === c.value;
            return (
              <Pressable
                key={c.value}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setSelectedCategory(c.value)}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {c.value === "" ? t("allCategories") : c.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : products.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Ionicons name="images-outline" size={42} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>{t("noProducts")}</Text>
          {hasActiveFilter && (
            <Pressable
              style={styles.clearFilters}
              onPress={() => {
                setSelectedRegion("");
                setSelectedCategory("");
                setSearchText("");
              }}
            >
              <Text style={styles.clearFiltersText}>{t("clearFilters")}</Text>
            </Pressable>
          )}
        </View>
      ) : (
        <FlatList
          data={products}
          numColumns={columns}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={[styles.grid, { paddingHorizontal: SIDE_PAD }]}
          columnWrapperStyle={styles.gridRow}
          ListFooterComponent={<View style={{ height: 200 }} />}
          style={{ flex: 1 }}
          renderItem={({ item }) => {
            const primaryImage = item.images?.find((img) => img.is_primary) || item.images?.[0];
            const imageUrl = resolveMediaUrl(primaryImage?.image);

            return (
              <Pressable style={[styles.card, { width: cardWidth }]} onPress={() => router.push(`/product/${item.id}`)}>
                <View style={styles.cardImageWrap}>
                  {imageUrl ? (
                    <Image source={{ uri: imageUrl }} style={[styles.cardImage, { height: cardWidth }]} resizeMode="cover" />
                  ) : (
                    <View style={[styles.cardImage, styles.cardImageFallback, { height: cardWidth }]}>
                      <Ionicons name="image-outline" size={32} color={colors.textMuted} />
                    </View>
                  )}
                  {item.is_sold && (
                    <View style={styles.soldBadge}>
                      <Text style={styles.soldBadgeText}>{t("sold")}</Text>
                    </View>
                  )}
                </View>
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
                  <Text style={styles.cardCategory}>{item.category_display}</Text>
                  <View style={styles.cardMetaRow}>
                    <View style={{ flexDirection: "row", alignItems: "center", flexShrink: 1 }}>
                      <Text style={styles.cardArtist} numberOfLines={1}>{item.artist_name}</Text>
                      {item.artist_is_verified && <Ionicons name="checkmark-circle" size={13} color="#5FA779" style={{ marginLeft: 3 }} />}
                    </View>
                  </View>
                  <View style={styles.cardFooter}>
                    <Text style={styles.cardPrice}>{item.price_xaf} XAF</Text>
                    {item.artist_region_display && (
                      <View style={styles.regionTag}>
                        <Ionicons name="location-outline" size={11} color={colors.textMuted} />
                        <Text style={styles.regionTagText} numberOfLines={1}>{item.artist_region_display}</Text>
                      </View>
                    )}
                  </View>
                </View>
              </Pressable>
            );
          }}
        />
      )}

      {loggedIn && (
        <View style={[styles.fabRow, { bottom: 28 + insets.bottom }]}>
          {user?.is_artist && (
            <Pressable style={styles.fab} onPress={() => router.push("/add-product")}>
              <Ionicons name="add" size={22} color={colors.accentText} />
              <Text style={styles.fabText}>{t("addProduct")}</Text>
            </Pressable>
          )}
          <Pressable style={[styles.fab, styles.fabGhost]} onPress={() => router.push(user?.is_artist ? "/my-products" : "/profile-hub")}>
            <Ionicons name={user?.is_artist ? "grid-outline" : "person-outline"} size={20} color={colors.text} />
          </Pressable>
        </View>
      )}

      <View style={[styles.footer, { paddingBottom: 30 + insets.bottom }]}>
        {user?.is_artist && (
          <>
            <Pressable style={styles.footerLink} onPress={() => router.push("/my-products")}>
              <Text style={styles.footerLinkText}>{t("myProducts")}</Text>
            </Pressable>
            <Pressable style={styles.footerLink} onPress={() => router.push("/edit-artist-profile")}>
              <Text style={styles.footerLinkText}>{t("editProfile")}</Text>
            </Pressable>
          </>
        )}
        {loggedIn && (
          <Pressable style={styles.footerLink} onPress={() => router.push("/conversations")}>
            <Text style={styles.footerLinkText}>{t("myConversations")}</Text>
          </Pressable>
        )}
        {user?.is_staff && (
          <>
            <Pressable style={styles.footerLink} onPress={() => router.push("/admin-dashboard")}>
              <Text style={styles.footerLinkText}>{t("dashboard")}</Text>
            </Pressable>
            <Pressable style={styles.footerLink} onPress={() => router.push("/admin-approve")}>
              <Text style={styles.footerLinkText}>{t("moderation")}</Text>
            </Pressable>
          </>
        )}
        {!loggedIn && (
          <Pressable style={styles.footerLink} onPress={() => router.push("/role-select")}>
            <Text style={styles.footerLinkText}>{t("becomeArtist")}</Text>
          </Pressable>
        )}
        {loggedIn && (
          <Pressable style={styles.footerLink} onPress={() => void logout()}>
            <Text style={[styles.footerLinkText, { color: "#B0524F" }]}>{t("logout")}</Text>
          </Pressable>
        )}
        <Pressable style={styles.termsLink} onPress={() => router.push("/terms")}>
          <Text style={styles.termsLinkText}>{t("terms")}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>["colors"], topPadding: number) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, paddingTop: topPadding },
    header: { paddingTop: 8, paddingHorizontal: SIDE_PAD, paddingBottom: 4 },
    headerRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
    wordmark: {
      color: colors.text, fontSize: 30, fontWeight: "800", letterSpacing: 1,
    },
    tagline: { color: colors.textMuted, fontSize: 12, marginTop: 2, letterSpacing: 0.3 },
    headerActions: { flexDirection: "row", alignItems: "center", gap: 10 },
    iconButton: {
      width: 38, height: 38, borderRadius: RADIUS.pill,
      backgroundColor: colors.surface, alignItems: "center", justifyContent: "center",
    },
    searchWrap: {
      flexDirection: "row", alignItems: "center",
      backgroundColor: colors.surface, borderRadius: RADIUS.pill,
      paddingHorizontal: 14, height: 44, marginTop: 16, borderWidth: 1, borderColor: colors.border,
    },
    searchIcon: { marginRight: 8 },
    searchInput: { flex: 1, color: colors.text, fontSize: 14 },
    chipRow: { paddingVertical: 12, gap: 8, paddingRight: SIDE_PAD },
    chip: {
      borderWidth: 1, borderColor: colors.border, borderRadius: RADIUS.pill,
      paddingVertical: 8, paddingHorizontal: 14, backgroundColor: colors.surface,
    },
    chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
    chipText: { color: colors.textMuted, fontSize: 12, fontWeight: "600" },
    chipTextActive: { color: colors.accentText, fontWeight: "700" },
    loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80 },
    emptyWrap: { alignItems: "center", justifyContent: "center", paddingTop: 100, paddingHorizontal: 40 },
    emptyTitle: { color: colors.textMuted, fontSize: 14, marginTop: 12, textAlign: "center", fontWeight: "500" },
    clearFilters: { marginTop: 14, paddingVertical: 10, paddingHorizontal: 20, borderRadius: RADIUS.pill, backgroundColor: colors.accent },
    clearFiltersText: { color: colors.accentText, fontWeight: "700", fontSize: 13 },
    grid: { paddingTop: 4, paddingBottom: 16 },
    gridRow: { gap: GAP, marginBottom: GAP },
    card: {
      backgroundColor: colors.surface, borderRadius: RADIUS.lg,
      overflow: "hidden", ...shadow(2), borderWidth: 1, borderColor: colors.border,
    },
    cardImageWrap: { position: "relative" },
    cardImage: { width: "100%", backgroundColor: colors.background },
    cardImageFallback: { alignItems: "center", justifyContent: "center" },
    soldBadge: {
      position: "absolute", top: 10, right: 10,
      backgroundColor: "rgba(11,10,12,0.82)", borderRadius: RADIUS.sm,
      paddingVertical: 4, paddingHorizontal: 9,
    },
    soldBadgeText: { color: "#fff", fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4 },
    cardBody: { padding: 12 },
    cardTitle: { color: colors.text, fontSize: 14, fontWeight: "700", lineHeight: 18 },
    cardCategory: { color: colors.accent, fontSize: 10, marginTop: 4, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: "700" },
    cardMetaRow: { marginTop: 6 },
    cardArtist: { color: colors.textMuted, fontSize: 11, fontWeight: "500" },
    cardFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 10 },
    cardPrice: { color: colors.text, fontSize: 13, fontWeight: "800" },
    regionTag: { flexDirection: "row", alignItems: "center", gap: 3, maxWidth: 90 },
    regionTagText: { color: colors.textMuted, fontSize: 10 },
    fabRow: {
      position: "absolute", right: 16, bottom: 28,
      flexDirection: "row", alignItems: "center", gap: 10,
    },
    fab: {
      flexDirection: "row", alignItems: "center", gap: 8,
      backgroundColor: colors.accent, borderRadius: RADIUS.pill,
      paddingVertical: 12, paddingHorizontal: 18, ...shadow(3),
    },
    fabGhost: { paddingHorizontal: 12, backgroundColor: colors.surface },
    fabText: { color: colors.accentText, fontWeight: "800", fontSize: 14 },
    footer: { paddingHorizontal: SIDE_PAD, paddingTop: 8, alignItems: "center" },
    footerLink: { paddingVertical: 10 },
    footerLinkText: { color: colors.textMuted, fontSize: 13, fontWeight: "600" },
    termsLink: { marginTop: 12, paddingBottom: 8 },
    termsLinkText: { color: colors.textMuted, fontSize: 10, textDecorationLine: "underline" },
  });
}
