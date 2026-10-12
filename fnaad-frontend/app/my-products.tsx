import { useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Pressable } from "react-native";
import Image from "../components/MediaImage";
import { useRouter } from "expo-router";
import { getMyProducts, deleteProduct, getMyArtistProfile, resolveMediaUrl, markProductSold } from "../services/api";
import { useLanguage } from "../context/LanguageContext";
import { useTheme } from "../context/ThemeContext";
import ScreenHeader from "../components/ScreenHeader";
import { shadow, RADIUS } from "../components/shadow";
import { Ionicons } from "@expo/vector-icons";
import React from "react";

type Product = {
  id: number;
  title: string;
  price_xaf: number;
  status: string;
  is_sold: boolean;
  images: { image: string; is_primary: boolean }[];
};

const STATUS_COLORS: Record<string, string> = {
  pending: "#C9A24B",
  approved: "#5FA779",
  rejected: "#B0524F",
  hidden: "#7D7880",
};

export default function MyProductsScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const [products, setProducts] = useState<Product[]>([]);
  const [myAvatar, setMyAvatar] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const loadProducts = () => {
    setErrorMsg("");
    getMyProducts()
      .then((res) => setProducts(res.data))
      .catch((err) => {
        console.log("My products error:", err.response?.data || err.message);
        setErrorMsg(err?.response?.data?.detail || "Unable to load your products. Please try again.");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadProducts();
    getMyArtistProfile()
      .then((res) => setMyAvatar(res.data.avatar))
      .catch((err) => console.log("My profile error:", err.response?.data || err.message));
  }, []);

  const handleDeleteConfirmed = async (id: number) => {
    setDeletingId(id);
    try {
      await deleteProduct(id);
      setProducts((prev) => prev.filter((p) => p.id !== id));
    } catch (err: any) {
      console.log("Delete error:", err.response?.data || err.message);
    } finally {
      setDeletingId(null);
      setConfirmingId(null);
    }
  };

  const handleToggleSold = async (item: Product) => {
    setTogglingId(item.id);
    try {
      await markProductSold(item.id, !item.is_sold);
      setProducts((prev) =>
        prev.map((p) => (p.id === item.id ? { ...p, is_sold: !p.is_sold } : p))
      );
    } catch (err: any) {
      console.log("Mark sold error:", err.response?.data || err.message);
    } finally {
      setTogglingId(null);
    }
  };

  const getStatusLabel = (status: string) => {
    const key = `status${status.charAt(0).toUpperCase() + status.slice(1)}`;
    return t(key);
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ScreenHeader title={t("myProductsTitle")} />
        <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
      </View>
    );
  }

  const avatarUrl = resolveMediaUrl(myAvatar || undefined);
  const profileShortcut = (
    <Pressable style={styles.profileShortcut} onPress={() => router.push("/edit-artist-profile")}>
      {avatarUrl ? (
        <Image source={{ uri: avatarUrl }} style={styles.profileAvatar} />
      ) : (
        <View style={[styles.profileAvatar, styles.profileAvatarPlaceholder]}>
          <Ionicons name="person" size={20} color={colors.textMuted} />
        </View>
      )}
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <ScreenHeader title={t("myProductsTitle")} rightElement={profileShortcut} />
      {errorMsg ? <Text style={styles.error}>{errorMsg}</Text> : null}
      <FlatList
        data={products}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Ionicons name="cube-outline" size={44} color={colors.textMuted} />
            <Text style={styles.empty}>{t("noMyProducts")}</Text>
            <Pressable style={styles.emptyCta} onPress={() => router.push("/add-product")}>
              <Text style={styles.emptyCtaText}>{t("addProduct")}</Text>
            </Pressable>
          </View>
        }
        renderItem={({ item }) => {
          const primaryImage = item.images?.find((img) => img.is_primary) || item.images?.[0];
          const imageUrl = resolveMediaUrl(primaryImage?.image);
          const isConfirming = confirmingId === item.id;
          const isDeleting = deletingId === item.id;
          const isToggling = togglingId === item.id;
          const statusColor = STATUS_COLORS[item.status] || colors.textMuted;

          return (
            <View style={styles.card}>
              <View style={styles.cardRow}>
                {imageUrl && (
                  <View style={styles.imageWrap}>
                    <Image
                      source={{ uri: imageUrl }}
                      style={[styles.cardImage, item.is_sold && styles.cardImageSold]}
                      resizeMode="cover"
                    />
                    {item.is_sold && (
                      <View style={styles.soldBadge}>
                        <Text style={styles.soldBadgeText}>{t("sold")}</Text>
                      </View>
                    )}
                  </View>
                )}
                <View style={styles.cardInfo}>
                  <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
                  <Text style={styles.cardPrice}>{item.price_xaf} XAF</Text>
                  <View style={[styles.statusPill, { borderColor: statusColor }]}>
                    <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                    <Text style={[styles.statusText, { color: statusColor }]}>{getStatusLabel(item.status)}</Text>
                  </View>
                </View>
              </View>

              {!isConfirming ? (
                <>
                  <View style={styles.actionRow}>
                    <Pressable
                      style={[styles.actionBtn, styles.actionBtnPrimary]}
                      onPress={() => router.push(`/edit-product/${item.id}`)}
                    >
                      <Ionicons name="create-outline" size={16} color={colors.accent} />
                      <Text style={styles.actionBtnPrimaryText}>{t("edit")}</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.actionBtn, styles.actionBtnDanger]}
                      onPress={() => setConfirmingId(item.id)}
                    >
                      <Ionicons name="trash-outline" size={16} color="#B0524F" />
                      <Text style={styles.actionBtnDangerText}>{t("delete")}</Text>
                    </Pressable>
                  </View>

                  {item.status === "approved" && (
                    <Pressable
                      style={[styles.actionBtn, styles.actionBtnFull, item.is_sold && styles.actionBtnActive]}
                      onPress={() => handleToggleSold(item)}
                      disabled={isToggling}
                    >
                      <Ionicons name={item.is_sold ? "refresh-outline" : "checkmark-done-outline"} size={16} color={item.is_sold ? "#FFFFFF" : colors.text} />
                      <Text style={[styles.actionBtnFullText, item.is_sold && styles.actionBtnActiveText]}>
                        {isToggling ? "..." : item.is_sold ? t("markAvailable") : t("markSold")}
                      </Text>
                    </Pressable>
                  )}

                  {item.status === "approved" && (
                    <Pressable
                      style={[styles.actionBtn, styles.actionBtnFull, styles.actionBtnGhost]}
                      onPress={() => router.push(`/product-qr/${item.id}`)}
                    >
                      <Ionicons name="qr-code-outline" size={16} color={colors.accent} />
                      <Text style={styles.actionBtnGhostText}>{t("viewQrCode")}</Text>
                    </Pressable>
                  )}
                </>
              ) : (
                <View style={styles.actionRow}>
                  <Pressable
                    style={[styles.actionBtn, styles.actionBtnNeutral]}
                    onPress={() => setConfirmingId(null)}
                    disabled={isDeleting}
                  >
                    <Text style={styles.actionBtnNeutralText}>{t("cancel")}</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.actionBtn, styles.actionBtnDanger, styles.actionBtnDangerSolid]}
                    onPress={() => handleDeleteConfirmed(item.id)}
                    disabled={isDeleting}
                  >
                    <Ionicons name="trash-outline" size={16} color="#FFFFFF" />
                    <Text style={styles.actionBtnDangerSolidText}>
                      {isDeleting ? "..." : t("confirmDelete")}
                    </Text>
                  </Pressable>
                </View>
              )}
            </View>
          );
        }}
      />
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>["colors"]) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    profileShortcut: { width: 40, height: 40 },
    profileAvatar: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: colors.accent, backgroundColor: colors.surface },
    profileAvatarPlaceholder: { justifyContent: "center", alignItems: "center" },
    list: { padding: 16, paddingTop: 12 },
    error: { color: "#E7A0A0", fontSize: 12, marginBottom: 14, textAlign: "center", fontWeight: "500" },
    card: {
      backgroundColor: colors.surface,
      borderRadius: RADIUS.lg,
      padding: 14,
      marginBottom: 14,
      borderWidth: 1,
      borderColor: colors.border,
      ...shadow(1),
    },
    cardRow: { flexDirection: "row" },
    imageWrap: { position: "relative" },
    cardImage: { width: 76, height: 76, borderRadius: 10, backgroundColor: colors.background },
    cardImageSold: { opacity: 0.4 },
    soldBadge: {
      position: "absolute", top: 4, left: 4,
      backgroundColor: "rgba(11,10,12,0.8)", borderRadius: 5, paddingVertical: 2, paddingHorizontal: 6,
    },
    soldBadgeText: { color: "#FFFFFF", fontSize: 8, fontWeight: "700", textTransform: "uppercase" },
    cardInfo: { marginLeft: 14, flex: 1, justifyContent: "center" },
    cardTitle: { color: colors.text, fontSize: 16, fontWeight: "700", lineHeight: 20 },
    cardPrice: { color: colors.accent, fontSize: 14, fontWeight: "800", marginTop: 4 },
    statusPill: {
      flexDirection: "row", alignItems: "center", alignSelf: "flex-start",
      backgroundColor: colors.background, borderWidth: 1, borderRadius: RADIUS.pill,
      paddingVertical: 3, paddingHorizontal: 9, marginTop: 8,
    },
    statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
    statusText: { fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4 },
    actionRow: { flexDirection: "row", gap: 10, marginTop: 14 },
    actionBtn: {
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7,
      borderRadius: RADIUS.md, paddingVertical: 11, paddingHorizontal: 12,
    },
    actionBtnFull: { width: "100%", marginTop: 10 },
    actionBtnPrimary: { flex: 1, backgroundColor: colors.accent + "14" },
    actionBtnPrimaryText: { color: colors.accent, fontWeight: "700", fontSize: 13 },
    actionBtnDanger: { flex: 1, backgroundColor: "#B0524F14" },
    actionBtnDangerText: { color: "#B0524F", fontWeight: "700", fontSize: 13 },
    actionBtnDangerSolid: { backgroundColor: "#B0524F", flex: 1 },
    actionBtnDangerSolidText: { color: "#FFFFFF", fontWeight: "700", fontSize: 13 },
    actionBtnNeutral: { flex: 1, backgroundColor: colors.border },
    actionBtnNeutralText: { color: colors.text, fontWeight: "700", fontSize: 13 },
    actionBtnGhost: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
    actionBtnGhostText: { color: colors.text, fontWeight: "700", fontSize: 13 },
    actionBtnActive: { backgroundColor: "#4A90D9" },
    actionBtnFullText: { color: colors.text, fontWeight: "700", fontSize: 13 },
    actionBtnActiveText: { color: "#FFFFFF" },
    emptyWrap: { alignItems: "center", paddingTop: 80, paddingHorizontal: 40 },
    empty: { color: colors.textMuted, fontSize: 13, textAlign: "center", marginTop: 14 },
    emptyCta: { marginTop: 16, backgroundColor: colors.accent, borderRadius: RADIUS.pill, paddingVertical: 10, paddingHorizontal: 20 },
    emptyCtaText: { color: colors.accentText, fontWeight: "700", fontSize: 13 },
  });
}
