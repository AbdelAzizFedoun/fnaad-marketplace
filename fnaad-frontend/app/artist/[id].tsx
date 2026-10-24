import { useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Pressable, ScrollView, Modal, Dimensions } from "react-native";
import Image from "../../components/MediaImage";
import { useLocalSearchParams, useRouter } from "expo-router";
import { getArtistProfile, getArtistProducts, getArtistFollowStatus, toggleArtistFollow, resolveMediaUrl, unwrapList } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
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
  follower_count: number;
  is_artist_of_week?: boolean;
  artist_of_week_note?: string;
  studio_photos?: { id: number; image: string; caption?: string }[];
};

type Product = {
  id: number;
  title: string;
  price_xaf: number;
  images: { image: string; is_primary: boolean }[];
};
type ProfileTab = "works" | "studio" | "about";

export default function ArtistProfileScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { t } = useLanguage();
  const { colors } = useTheme();
  const { loggedIn } = useAuth();
  const layout = useResponsiveLayout();
  const styles = createStyles(colors, layout);

  const [artist, setArtist] = useState<ArtistProfile | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [following, setFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [activeTab, setActiveTab] = useState<ProfileTab>("works");
  const [galleryProduct, setGalleryProduct] = useState<Product | null>(null);

  useEffect(() => {
    Promise.all([getArtistProfile(Number(id)), getArtistProducts(Number(id))])
      .then(([artistRes, productsRes]) => {
        setArtist(artistRes.data);
        setFollowerCount(artistRes.data.follower_count || 0);
        setProducts(unwrapList(productsRes.data));
        if (loggedIn) getArtistFollowStatus(Number(id)).then((res) => setFollowing(!!res.data.following)).catch(() => undefined);
      })
      .catch((err) => {
        const status = err.response?.status;
        console.log("Artist profile error:", status, err.response?.data || err.message);
        setErrorMsg(
          status === 404 ? t("artistNotFound") : err.message || "Failed to load artist"
        );
      })
      .finally(() => setLoading(false));
  }, [id, loggedIn]);

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
  const handleFollow = async () => {
    if (!loggedIn) { router.push("/login"); return; }
    const result = await toggleArtistFollow(Number(id));
    setFollowing(!!result.data.following);
    setFollowerCount(result.data.follower_count || 0);
  };

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

          {artist.is_artist_of_week && <View style={styles.artistWeek}><Ionicons name="star" size={16} color="#E7C878" /><Text style={styles.artistWeekText}>{t("artistOfWeek")}{artist.artist_of_week_note ? ` · ${artist.artist_of_week_note}` : ""}</Text></View>}
          <Pressable onPress={handleFollow} style={[styles.followButton, following && styles.followingButton]}><Ionicons name={following ? "checkmark" : "add"} size={16} color={following ? colors.text : colors.accentText} /><Text style={[styles.followButtonText, following && styles.followingButtonText]}>{following ? t("following") : t("followArtist")}</Text></Pressable>

          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{artist.product_count}</Text>
              <Text style={styles.statLabel}>{t("productsPublished")}</Text>
            </View>
            <View style={styles.statBox}><Text style={styles.statValue}>{followerCount}</Text><Text style={styles.statLabel}>{t("followers")}</Text></View>
          </View>
        </View>

        <View style={styles.tabBar}>{(["works", "studio", "about"] as ProfileTab[]).map((tab) => <Pressable key={tab} onPress={() => setActiveTab(tab)} style={[styles.tab, activeTab === tab && styles.activeTab]}><Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>{tab === "works" ? t("worksTab") : tab === "studio" ? t("studioTab") : t("aboutTab")}</Text></Pressable>)}</View>

        {activeTab === "studio" && <View style={styles.studioSection}>{artist.studio_photos?.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.studioRow}>{artist.studio_photos.map((photo) => <View key={photo.id} style={styles.studioCard}><Image source={{ uri: resolveMediaUrl(photo.image)! }} style={styles.studioImage} resizeMode="cover" />{photo.caption ? <Text style={styles.studioCaption}>{photo.caption}</Text> : null}</View>)}</ScrollView> : <Text style={styles.empty}>{t("noStudioContent")}</Text>}</View>}
        {activeTab === "about" && <View style={styles.aboutCard}><Text style={styles.sectionTitle}>{t("aboutTab")} {artist.brand_name}</Text><Text style={styles.aboutText}>{artist.bio || t("noArtistBio")}</Text><Text style={styles.aboutMeta}>{artist.region_display} · {artist.follower_count} {t("followers")}</Text></View>}

        {activeTab === "works" && <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>{t("moreFromArtist")} {artist.brand_name}</Text></View>}

        {activeTab === "works" && <FlatList
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
                    <Pressable onPress={() => setGalleryProduct(item)}><Image source={{ uri: imageUrl }} style={styles.cardImage} resizeMode="cover" /></Pressable>
                  )}
                </View>
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
                  <Text style={styles.cardPrice}>{item.price_xaf} XAF</Text>
                </View>
              </Pressable>
            );
          }}
        />}
        <Modal visible={!!galleryProduct} transparent animationType="fade" onRequestClose={() => setGalleryProduct(null)}>
          <View style={styles.galleryBackdrop}>
            <Pressable style={styles.galleryClose} onPress={() => setGalleryProduct(null)}><Ionicons name="close" size={26} color="#fff" /></Pressable>
            <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} contentOffset={{ x: 0, y: 0 }}>
              {(galleryProduct?.images || []).map((image, index) => <View key={`${image.image}-${index}`} style={styles.gallerySlide}><Image source={{ uri: resolveMediaUrl(image.image)! }} style={styles.galleryImage} resizeMode="contain" /></View>)}
            </ScrollView>
            <Text style={styles.galleryTitle}>{galleryProduct?.title}</Text>
            <Pressable style={styles.galleryDetailsButton} onPress={() => { if (galleryProduct) router.push(`/product/${galleryProduct.id}`); setGalleryProduct(null); }}><Text style={styles.galleryDetailsText}>{t("viewArtwork")}</Text></Pressable>
          </View>
        </Modal>
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
    artistWeek: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 14, padding: 10, borderRadius: 10, backgroundColor: colors.background },
    artistWeekText: { color: colors.accent, fontSize: 12, fontWeight: "800" },
    followButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: colors.accent, borderRadius: 10, paddingVertical: 10, marginTop: 14 },
    followingButton: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
    followButtonText: { color: colors.accentText, fontSize: 13, fontWeight: "800" },
    followingButtonText: { color: colors.text },
    statsRow: { flexDirection: "row", marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderColor: colors.border },
    statBox: { flex: 1, alignItems: "center" },
    statValue: { color: colors.accent, fontSize: 22, fontWeight: "800" },
    statLabel: { color: colors.textMuted, fontSize: 11, marginTop: 2, textTransform: "uppercase", fontWeight: "600" },
    sectionHeader: { paddingHorizontal: 20, marginBottom: 12 },
    sectionTitle: { color: colors.text, fontSize: 15, fontWeight: "700" },
    tabBar: { flexDirection: "row", marginHorizontal: 16, marginBottom: 14, borderBottomWidth: 1, borderColor: colors.border },
    tab: { flex: 1, alignItems: "center", paddingVertical: 12 },
    activeTab: { borderBottomWidth: 2, borderBottomColor: colors.accent },
    tabText: { color: colors.textMuted, fontSize: 12, fontWeight: "700" },
    activeTabText: { color: colors.accent },
    aboutCard: { marginHorizontal: 16, padding: 16, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, marginBottom: 20 },
    aboutText: { color: colors.text, fontSize: 14, lineHeight: 21, marginTop: 10 },
    aboutMeta: { color: colors.textMuted, fontSize: 12, marginTop: 14 },
    studioSection: { marginBottom: 20 },
    studioRow: { gap: 10, paddingHorizontal: 16, paddingTop: 10 },
    studioCard: { width: 190, borderRadius: 12, overflow: "hidden", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
    studioImage: { width: 190, height: 125, backgroundColor: colors.border },
    studioCaption: { color: colors.textMuted, fontSize: 11, padding: 8 },
    card: {
      width: cardWidth,
      backgroundColor: colors.surface, borderRadius: RADIUS.md,
      overflow: "hidden", borderWidth: 1, borderColor: colors.border, ...shadow(1),
    },
    cardImageWrap: { position: "relative" },
    cardImage: { width: "100%", height: 140, backgroundColor: colors.background },
    cardBody: { padding: 10 },
    cardTitle: { color: colors.text, fontFamily: "Georgia", fontSize: 14, fontWeight: "700" },
    cardPrice: { color: colors.accent, fontSize: 12, marginTop: 3, fontWeight: "800" },
    galleryBackdrop: { flex: 1, backgroundColor: "rgba(5,4,7,0.97)", justifyContent: "center" },
    galleryClose: { position: "absolute", right: 18, top: 45, zIndex: 2, padding: 8 },
    gallerySlide: { width: Dimensions.get("window").width, height: Dimensions.get("window").height * 0.62, justifyContent: "center", alignItems: "center" },
    galleryImage: { width: "92%", height: "100%" },
    galleryTitle: { color: "#fff", fontSize: 18, fontWeight: "700", textAlign: "center", marginTop: 10 },
    galleryDetailsButton: { alignSelf: "center", backgroundColor: colors.accent, borderRadius: 22, paddingVertical: 11, paddingHorizontal: 22, marginTop: 16 },
    galleryDetailsText: { color: colors.accentText, fontWeight: "800" },
    empty: { color: colors.textMuted, fontSize: 13, textAlign: "center", marginTop: 30, fontWeight: "500" },
    error: { color: "#E7A0A0", fontSize: 14, textAlign: "center", marginTop: 60 },
  });
}
