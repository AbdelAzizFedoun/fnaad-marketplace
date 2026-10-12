import { useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Pressable, ScrollView } from "react-native";
import Image from "../../components/MediaImage";
import { useLocalSearchParams, useRouter } from "expo-router";
import { getArtistProfile, getArtistProducts, resolveMediaUrl, unwrapList } from "../../services/api";
import { useLanguage } from "../../context/LanguageContext";
import { useTheme } from "../../context/ThemeContext";
import { useResponsiveLayout } from "../../hooks/useResponsiveLayout";
import ScreenHeader from "../../components/ScreenHeader";
import { Ionicons } from "@expo/vector-icons";
import { shadow, RADIUS } from "../../components/shadow";
import React from "react";

type ArtistProfile = {
  id: number;
  brand_name: string;
  bio: string;
  avatar: string | null;
  region_display: string;
  is_verified: boolean;
  product_count: number;
};

type Product = {
  id: number;
  title: string;
  price_xaf: number;
  images: { image: string; is_primary: boolean }[];
};

export default function ArtistProfileScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { t } = useLanguage();
  const { colors } = useTheme();
  const layout = useResponsiveLayout();
  const styles = createStyles(colors, layout);

  const [artist, setArtist] = useState<ArtistProfile | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getArtistProfile(Number(id)), getArtistProducts(Number(id))])
      .then(([artistRes, productsRes]) => {
        setArtist(artistRes.data);
        setProducts(unwrapList(productsRes.data));
      })
      .catch((err) => {
        const status = err.response?.status;
        console.log("Artist profile error:", status, err.response?.data || err.message);
        setErrorMsg(
          status === 404 ? t("artistNotFound") : err.message || "Failed to load artist"
        );
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <View style={styles.container}>
        <ScreenHeader title={t("artist") || "Artist"} />
        <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
      </View>
    );
  }

  if (!artist) {
    return (
      <View style={styles.container}>
        <ScreenHeader title={t("artist") || "Artist"} />
        <Text style={styles.error}>{errorMsg || t("artistNotFound")}</Text>
      </View>
    );
  }

  const avatarUrl = resolveMediaUrl(artist.avatar || undefined);

  return (
    <View style={styles.container}>
      <ScreenHeader title={artist.brand_name} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerCard}>
          <View style={styles.avatarRow}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Text style={styles.avatarInitial}>{artist.brand_name.charAt(0).toUpperCase()}</Text>
              </View>
            )}
            <View style={styles.avatarInfo}>
              <View style={styles.nameRow}>
                <Text style={styles.brandName}>{artist.brand_name}</Text>
                {artist.is_verified && <Ionicons name="checkmark-circle" size={18} color="#5FA779" style={{ marginLeft: 6 }} />}
              </View>
              <View style={styles.metaRow}>
                <Ionicons name="location" size={14} color="#7D9ED9" />
                <Text style={styles.region}> {artist.region_display}</Text>
              </View>
            </View>
          </View>

          {artist.bio ? <Text style={styles.bio}>{artist.bio}</Text> : null}

          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{artist.product_count}</Text>
              <Text style={styles.statLabel}>{t("productsPublished")}</Text>
            </View>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t("moreFromArtist")} {artist.brand_name}</Text>
        </View>

        <FlatList
          data={products}
          keyExtractor={(item) => item.id.toString()}
          numColumns={2}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
          columnWrapperStyle={{ gap: 12 }}
          ListEmptyComponent={<Text style={styles.empty}>{t("noArtistProducts")}</Text>}
          scrollEnabled={false}
          renderItem={({ item }) => {
            const primaryImage = item.images?.find((img) => img.is_primary) || item.images?.[0];
            const imageUrl = resolveMediaUrl(primaryImage?.image);
            return (
              <Pressable style={styles.card} onPress={() => router.push(`/product/${item.id}`)}>
                <View style={styles.cardImageWrap}>
                  {imageUrl && (
                    <Image source={{ uri: imageUrl }} style={styles.cardImage} resizeMode="cover" />
                  )}
                </View>
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
                  <Text style={styles.cardPrice}>{item.price_xaf} XAF</Text>
                </View>
              </Pressable>
            );
          }}
        />
      </ScrollView>
    </View>
  );
}

function createStyles(
  colors: ReturnType<typeof useTheme>["colors"],
  layout: ReturnType<typeof useResponsiveLayout>
) {
  const cardWidth = (layout.width - layout.horizontalPadding * 2 - 12) / 2;
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scrollContent: { paddingBottom: 40 },
    headerCard: {
      marginHorizontal: 16, marginTop: 8, marginBottom: 20,
      backgroundColor: colors.surface, borderRadius: RADIUS.lg, padding: 20,
      borderWidth: 1, borderColor: colors.border, ...shadow(2),
    },
    avatarRow: { flexDirection: "row", alignItems: "center", gap: 14 },
    avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.background },
    avatarPlaceholder: { justifyContent: "center", alignItems: "center", backgroundColor: colors.accent },
    avatarInitial: { color: colors.accentText, fontSize: 28, fontWeight: "800" },
    avatarInfo: { flex: 1 },
    nameRow: { flexDirection: "row", alignItems: "center" },
    brandName: { color: colors.accent, fontSize: 20, fontWeight: "800" },
    metaRow: { flexDirection: "row", alignItems: "center", marginTop: 6 },
    region: { color: "#7D9ED9", fontSize: 13, fontWeight: "500" },
    emailRow: { flexDirection: "row", alignItems: "center", marginTop: 10, gap: 6 },
    email: { color: colors.textMuted, fontSize: 13 },
    bio: { color: colors.text, fontSize: 14, marginTop: 14, lineHeight: 21, opacity: 0.88 },
    statsRow: { flexDirection: "row", marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderColor: colors.border },
    statBox: { flex: 1, alignItems: "center" },
    statValue: { color: colors.accent, fontSize: 22, fontWeight: "800" },
    statLabel: { color: colors.textMuted, fontSize: 11, marginTop: 2, textTransform: "uppercase", fontWeight: "600" },
    sectionHeader: { paddingHorizontal: 20, marginBottom: 12 },
    sectionTitle: { color: colors.text, fontSize: 15, fontWeight: "700" },
    card: {
      width: cardWidth,
      backgroundColor: colors.surface, borderRadius: RADIUS.md,
      overflow: "hidden", borderWidth: 1, borderColor: colors.border, ...shadow(1),
    },
    cardImageWrap: { position: "relative" },
    cardImage: { width: "100%", height: 140, backgroundColor: colors.background },
    cardBody: { padding: 10 },
    cardTitle: { color: colors.text, fontSize: 13, fontWeight: "700" },
    cardPrice: { color: colors.accent, fontSize: 12, marginTop: 3, fontWeight: "800" },
    empty: { color: colors.textMuted, fontSize: 13, textAlign: "center", marginTop: 30, fontWeight: "500" },
    error: { color: "#E7A0A0", fontSize: 14, textAlign: "center", marginTop: 60 },
  });
}
