import { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator,
  Pressable, ScrollView, Modal, Dimensions,
} from "react-native";
import Image from "../components/MediaImage";
import { getPendingProducts, approveProduct, resolveMediaUrl } from "../services/api";
import { useLanguage } from "../context/LanguageContext";
import { useTheme } from "../context/ThemeContext";
import ScreenHeader from "../components/ScreenHeader";
import { Ionicons } from "@expo/vector-icons";
import React from "react";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

type ProductImage = { id: number; image: string; thumbnail?: string | null; is_primary: boolean };
type Product = {
  id: number;
  title: string;
  description: string;
  price_xaf: number;
  category_display: string;
  artist_name: string;
  artist_region_display: string | null;
  images: ProductImage[];
};

export default function AdminApproveScreen() {
  const { t } = useLanguage();
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [lightbox, setLightbox] = useState<{ images: ProductImage[]; index: number } | null>(null);
  const [decidingId, setDecidingId] = useState<number | null>(null);

  const loadPending = () => {
    setLoading(true);
    getPendingProducts()
      .then((res) => setProducts(res.data))
      .catch((err) => {
        console.log("Pending load error:", err.response?.data || err.message);
        setErrorMsg(t("pendingLoadError"));
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadPending(); }, []);

  const handleDecision = async (id: number, status: "approved" | "rejected") => {
    setDecidingId(id);
    try {
      await approveProduct(id, status);
      setProducts((prev) => prev.filter((p) => p.id !== id));
    } catch (err: any) {
      console.log("Approve error:", err.response?.data || err.message);
      setErrorMsg(t("approveError"));
    } finally {
      setDecidingId(null);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ScreenHeader title={t("pendingArtworksTitle")} />
        <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title={t("pendingArtworksTitle")} />
      {errorMsg ? <Text style={styles.error}>{errorMsg}</Text> : null}

      <FlatList
        data={products}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={{ padding: 16, paddingTop: 10 }}
        ListEmptyComponent={<Text style={styles.empty}>{t("noPendingArtworks")}</Text>}
        renderItem={({ item }) => {
          const isDeciding = decidingId === item.id;
          const allImages = item.images ?? [];
          const primaryImg = allImages.find((img) => img.is_primary) || allImages[0];

          return (
            <View style={styles.card}>

              {/* ── Image gallery ── */}
              {allImages.length === 0 ? (
                <View style={styles.noImageBox}>
                  <Ionicons name="image-outline" size={36} color={colors.textMuted} />
                  <Text style={styles.noImageText}>No images uploaded</Text>
                </View>
              ) : allImages.length === 1 ? (
                <Pressable onPress={() => setLightbox({ images: allImages, index: 0 })}>
                  <Image
                    source={{ uri: resolveMediaUrl(primaryImg?.image)! }}
                    style={styles.singleImage}
                    resizeMode="cover"
                  />
                  <View style={styles.imageBadge}>
                    <Ionicons name="expand-outline" size={12} color="#fff" />
                    <Text style={styles.imageBadgeText}>Tap to enlarge</Text>
                  </View>
                </Pressable>
              ) : (
                <View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.galleryStrip}>
                    {allImages.map((img, idx) => (
                      <Pressable key={img.id} onPress={() => setLightbox({ images: allImages, index: idx })}>
                        <View style={styles.thumbWrap}>
                          <Image
                            source={{ uri: resolveMediaUrl(img.thumbnail || img.image)! }}
                            style={styles.thumb}
                            resizeMode="cover"
                          />
                          {img.is_primary && (
                            <View style={styles.primaryBadge}>
                              <Text style={styles.primaryBadgeText}>Main</Text>
                            </View>
                          )}
                        </View>
                      </Pressable>
                    ))}
                  </ScrollView>
                  <View style={styles.galleryHint}>
                    <Ionicons name="images-outline" size={12} color={colors.textMuted} />
                    <Text style={styles.galleryHintText}>{allImages.length} photos · tap to enlarge</Text>
                  </View>
                </View>
              )}

              {/* ── Product info ── */}
              <View style={styles.infoBlock}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <View style={styles.metaRow}>
                  <Ionicons name="person-outline" size={12} color={colors.accent} />
                  <Text style={styles.cardArtist}>{item.artist_name}</Text>
                  {item.artist_region_display ? (
                    <>
                      <Text style={styles.metaDot}>·</Text>
                      <Ionicons name="location-outline" size={12} color={colors.textMuted} />
                      <Text style={styles.cardMeta}>{item.artist_region_display}</Text>
                    </>
                  ) : null}
                </View>
                <View style={styles.metaRow}>
                  <Ionicons name="pricetag-outline" size={12} color={colors.textMuted} />
                  <Text style={styles.cardMeta}>{item.category_display}</Text>
                  <Text style={styles.metaDot}>·</Text>
                  <Text style={styles.cardPrice}>{item.price_xaf.toLocaleString()} XAF</Text>
                </View>
                {item.description ? (
                  <Text style={styles.cardDesc} numberOfLines={3}>{item.description}</Text>
                ) : null}
              </View>

              {/* ── Decision buttons ── */}
              <View style={styles.row}>
                <Pressable
                  style={[styles.approveBtn, isDeciding && styles.btnDisabled]}
                  onPress={() => handleDecision(item.id, "approved")}
                  disabled={isDeciding}
                >
                  {isDeciding ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle-outline" size={16} color="#fff" style={{ marginRight: 6 }} />
                      <Text style={styles.btnText}>{t("approve")}</Text>
                    </>
                  )}
                </Pressable>
                <Pressable
                  style={[styles.rejectBtn, isDeciding && styles.btnDisabled]}
                  onPress={() => handleDecision(item.id, "rejected")}
                  disabled={isDeciding}
                >
                  {isDeciding ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="close-circle-outline" size={16} color="#fff" style={{ marginRight: 6 }} />
                      <Text style={styles.btnText}>{t("reject")}</Text>
                    </>
                  )}
                </Pressable>
              </View>
            </View>
          );
        }}
      />

      {/* ── Fullscreen lightbox ── */}
      {lightbox && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setLightbox(null)}>
          <View style={styles.lightboxBg}>
            <Pressable style={styles.lightboxClose} onPress={() => setLightbox(null)}>
              <Ionicons name="close-circle" size={34} color="#fff" />
            </Pressable>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              contentOffset={{ x: lightbox.index * SCREEN_W, y: 0 }}
            >
              {lightbox.images.map((img) => (
                <View key={img.id} style={styles.lightboxSlide}>
                  <Image
                    source={{ uri: resolveMediaUrl(img.image)! }}
                    style={styles.lightboxImage}
                    resizeMode="contain"
                  />
                </View>
              ))}
            </ScrollView>
            <Text style={styles.lightboxCounter}>
              {lightbox.index + 1} / {lightbox.images.length}
            </Text>
          </View>
        </Modal>
      )}
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>["colors"]) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    error: { color: "#E7A0A0", fontSize: 11, marginTop: 14, marginHorizontal: 16, textAlign: "center" },
    empty: { color: colors.textMuted, fontSize: 12, textAlign: "center", marginTop: 30 },

    card: {
      borderWidth: 1, borderColor: colors.border, borderRadius: 14,
      marginBottom: 16, overflow: "hidden", backgroundColor: colors.surface,
    },

    /* Single image */
    singleImage: { width: "100%", height: 260, backgroundColor: colors.background },
    imageBadge: {
      position: "absolute", bottom: 10, right: 10,
      flexDirection: "row", alignItems: "center", gap: 4,
      backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 20,
      paddingHorizontal: 10, paddingVertical: 4,
    },
    imageBadgeText: { color: "#fff", fontSize: 11 },

    /* No image */
    noImageBox: {
      height: 120, alignItems: "center", justifyContent: "center",
      backgroundColor: colors.background, gap: 6,
    },
    noImageText: { color: colors.textMuted, fontSize: 12 },

    /* Gallery strip */
    galleryStrip: { paddingLeft: 12, paddingVertical: 12 },
    thumbWrap: { marginRight: 8, borderRadius: 10, overflow: "hidden" },
    thumb: { width: 150, height: 150, backgroundColor: colors.background },
    primaryBadge: {
      position: "absolute", top: 6, left: 6,
      backgroundColor: colors.accent, borderRadius: 6,
      paddingHorizontal: 7, paddingVertical: 2,
    },
    primaryBadgeText: { color: colors.accentText, fontSize: 9, fontWeight: "700" },
    galleryHint: {
      flexDirection: "row", alignItems: "center", gap: 4,
      paddingHorizontal: 14, paddingBottom: 10,
    },
    galleryHintText: { color: colors.textMuted, fontSize: 11 },

    /* Info */
    infoBlock: { padding: 14 },
    cardTitle: { color: colors.text, fontSize: 16, fontWeight: "700", marginBottom: 6 },
    metaRow: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 4, flexWrap: "wrap" },
    metaDot: { color: colors.textMuted, fontSize: 12 },
    cardArtist: { color: colors.accent, fontSize: 12, fontWeight: "600" },
    cardMeta: { color: colors.textMuted, fontSize: 12 },
    cardPrice: { color: colors.accent, fontSize: 13, fontWeight: "800" },
    cardDesc: { color: colors.textMuted, fontSize: 12, marginTop: 8, lineHeight: 18 },

    /* Buttons */
    row: { flexDirection: "row", gap: 10, padding: 14, paddingTop: 0 },
    approveBtn: {
      backgroundColor: "#5FA779", borderRadius: 10, padding: 12,
      flex: 1, alignItems: "center", flexDirection: "row", justifyContent: "center",
    },
    rejectBtn: {
      backgroundColor: "#B0524F", borderRadius: 10, padding: 12,
      flex: 1, alignItems: "center", flexDirection: "row", justifyContent: "center",
    },
    btnDisabled: { opacity: 0.5 },
    btnText: { color: "#FFFFFF", fontWeight: "700", fontSize: 13 },

    /* Lightbox */
    lightboxBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.96)", justifyContent: "center" },
    lightboxClose: { position: "absolute", top: 50, right: 16, zIndex: 10 },
    lightboxSlide: { width: SCREEN_W, height: SCREEN_H, justifyContent: "center", alignItems: "center" },
    lightboxImage: { width: SCREEN_W, height: SCREEN_H * 0.8 },
    lightboxCounter: {
      position: "absolute", bottom: 40, alignSelf: "center",
      color: "rgba(255,255,255,0.7)", fontSize: 13,
    },
  });
}

