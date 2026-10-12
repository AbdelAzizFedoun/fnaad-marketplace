import { useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Pressable, TextInput, Alert } from "react-native";
import Image from "../components/MediaImage";
import { useRouter } from "expo-router";
import { getAdminArtists, verifyArtist, suspendArtist, resolveMediaUrl } from "../services/api";
import { useLanguage } from "../context/LanguageContext";
import { useTheme } from "../context/ThemeContext";
import ScreenHeader from "../components/ScreenHeader";
import { Ionicons } from "@expo/vector-icons";
import React from "react";

type Artist = {
  id: number;
  username: string;
  brand_name: string;
  region: string | null;
  region_display: string;
  gender: string;
  gender_display: string;
  is_verified: boolean;
  is_suspended: boolean;
  suspension_reason: string;
  product_count: number;
  national_id_number: string;
  user_email: string;
  user_phone: string;
  bio: string;
  artistic_practice: string;
  instagram_handle: string;
  portfolio_url: string;
  avatar: string | null;
  mobile_money_number: string;
  mobile_money_provider: string;
  created_at: string;
  verified_at: string | null;
  suspended_at: string | null;
};

export default function AdminArtistsScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const [artists, setArtists] = useState<Artist[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [suspendingId, setSuspendingId] = useState<number | null>(null);
  const [suspendReason, setSuspendReason] = useState("");
  const [justVerifiedId, setJustVerifiedId] = useState<number | null>(null);

  const loadArtists = () => {
    getAdminArtists()
      .then((res) => setArtists(res.data))
      .catch((err) => console.log("Admin artists error:", err.response?.data || err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadArtists();
  }, []);

  const handleToggleVerify = async (artist: Artist) => {
    setUpdatingId(artist.id);
    try {
      const res = await verifyArtist(artist.id, !artist.is_verified);
      const updated = res.data;
      setArtists((prev) =>
        prev.map((a) => (a.id === artist.id ? { ...a, ...updated } : a))
      );
      if (!artist.is_verified) {
        setJustVerifiedId(artist.id);
        setTimeout(() => setJustVerifiedId(null), 1500);
      }
    } catch (err: any) {
      console.log("Verify error:", err.response?.data || err.message);
      Alert.alert("Error", err?.response?.data?.detail || "Could not update verification status.");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleConfirmSuspend = async (artist: Artist) => {
    if (!suspendReason.trim()) return;
    setUpdatingId(artist.id);
    try {
      await suspendArtist(artist.id, true, suspendReason.trim());
      setArtists((prev) =>
        prev.map((a) =>
          a.id === artist.id ? { ...a, is_suspended: true, suspension_reason: suspendReason.trim() } : a
        )
      );
      setSuspendingId(null);
      setSuspendReason("");
    } catch (err: any) {
      console.log("Suspend error:", err.response?.data || err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleReactivate = async (artist: Artist) => {
    setUpdatingId(artist.id);
    try {
      await suspendArtist(artist.id, false);
      setArtists((prev) =>
        prev.map((a) => (a.id === artist.id ? { ...a, is_suspended: false, suspension_reason: "" } : a))
      );
    } catch (err: any) {
      console.log("Reactivate error:", err.response?.data || err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ScreenHeader title={t("artistsTitle")} />
        <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title={t("artistsTitle")} />
      <FlatList
        data={artists}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={{ padding: 16, paddingTop: 10 }}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        ListEmptyComponent={<Text style={styles.empty}>{t("noArtistsYet")}</Text>}
        renderItem={({ item }) => (
          <View style={[styles.card, item.is_suspended && styles.cardSuspended, justVerifiedId === item.id && styles.cardJustVerified]}>
            <View style={styles.cardHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                {item.avatar ? (
                  <Image source={{ uri: resolveMediaUrl(item.avatar)! }} style={styles.cardAvatar} />
                ) : (
                  <View style={[styles.cardAvatar, styles.cardAvatarPlaceholder]}>
                    <Text style={styles.cardAvatarInitial}>{item.brand_name.charAt(0).toUpperCase()}</Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardName}>{item.brand_name}</Text>
                  <Text style={styles.cardMeta}>@{item.username} · {item.gender_display || item.gender}</Text>
                </View>
              </View>
              {item.is_verified && (
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Ionicons name="checkmark-circle" size={14} color="#5FA779" />
                  <Text style={styles.verifiedBadge}> {t("verified")}</Text>
                </View>
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Storefront</Text>
              <Text style={styles.cardMeta}>{item.region_display} · {item.product_count} {t("artworksCount")}</Text>
              {item.artistic_practice ? <Text style={styles.cardMeta}>Practice: {item.artistic_practice}</Text> : null}
              {item.bio ? <Text style={styles.cardMeta}>Bio: {item.bio}</Text> : null}
              {item.instagram_handle ? <Text style={styles.cardMeta}>Instagram: @{item.instagram_handle}</Text> : null}
              {item.portfolio_url ? (
                <Pressable onPress={() => router.push(item.portfolio_url)}>
                  <Text style={styles.link}>Portfolio</Text>
                </Pressable>
              ) : null}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Contact & payments</Text>
              <Text style={styles.cardMeta}>{item.user_email}</Text>
              <Text style={styles.cardMeta}>{item.user_phone}</Text>
              <Text style={styles.cardMeta}>Mobile money: {item.mobile_money_provider} ({item.mobile_money_number})</Text>
              <Text style={styles.cardMeta}>CNI: {item.national_id_number}</Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Account</Text>
              <Text style={styles.cardMeta}>Joined: {new Date(item.created_at).toLocaleDateString()}</Text>
              {item.verified_at ? <Text style={styles.cardMeta}>Verified: {new Date(item.verified_at).toLocaleString()}</Text> : null}
              {item.suspended_at ? <Text style={styles.cardMeta}>Suspended: {new Date(item.suspended_at).toLocaleString()}</Text> : null}
            </View>

            {item.is_suspended && (
              <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4 }}>
                <Ionicons name="warning" size={13} color="#B0524F" />
                <Text style={styles.suspendedNotice}>
                  {" "}{t("suspended")} — {item.suspension_reason}
                </Text>
              </View>
            )}

            <Pressable
              style={[styles.verifyBtn, item.is_verified && styles.unverifyBtn]}
              onPress={() => handleToggleVerify(item)}
              disabled={updatingId === item.id}
            >
              <Text style={styles.verifyBtnText}>
                {updatingId === item.id
                  ? "..."
                  : item.is_verified
                  ? t("removeVerification")
                  : t("verifyThisArtist")}
              </Text>
            </Pressable>

            {item.is_suspended ? (
              <Pressable
                style={styles.reactivateBtn}
                onPress={() => handleReactivate(item)}
                disabled={updatingId === item.id}
              >
                <Text style={styles.verifyBtnText}>
                  {updatingId === item.id ? "..." : t("reactivateAccount")}
                </Text>
              </Pressable>
            ) : suspendingId === item.id ? (
              <View style={styles.suspendBox}>
                <TextInput
                  style={styles.suspendInput}
                  placeholder={t("suspensionReasonPlaceholder")}
                  placeholderTextColor={colors.textMuted}
                  value={suspendReason}
                  onChangeText={setSuspendReason}
                  multiline
                />
                <View style={styles.suspendActionRow}>
                  <Pressable
                    style={styles.cancelSuspendBtn}
                    onPress={() => {
                      setSuspendingId(null);
                      setSuspendReason("");
                    }}
                  >
                    <Text style={styles.verifyBtnText}>{t("cancel")}</Text>
                  </Pressable>
                  <Pressable
                    style={styles.suspendBtn}
                    onPress={() => handleConfirmSuspend(item)}
                    disabled={updatingId === item.id}
                  >
                    <Text style={styles.verifyBtnText}>
                      {updatingId === item.id ? "..." : t("confirmSuspension")}
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <Pressable style={styles.suspendBtn} onPress={() => setSuspendingId(item.id)}>
                <Text style={styles.verifyBtnText}>{t("suspendAccount")}</Text>
              </Pressable>
            )}
          </View>
        )}
      />
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>["colors"]) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    card: {
      borderWidth: 1, borderColor: colors.border, borderRadius: 10,
      padding: 14, marginBottom: 10,
    },
    cardSuspended: { borderColor: "#B0524F" },
    cardJustVerified: { borderColor: "#5FA779", backgroundColor: "#F0FFF4" },
    cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    cardAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.background },
    cardAvatarPlaceholder: { justifyContent: "center", alignItems: "center", backgroundColor: colors.accent },
    cardAvatarInitial: { color: colors.accentText, fontSize: 18, fontWeight: "800" },
    cardName: { color: colors.text, fontSize: 15, fontWeight: "600" },
    verifiedBadge: { color: "#5FA779", fontSize: 11, fontWeight: "700" },
    cardMeta: { color: colors.textMuted, fontSize: 11, marginTop: 3 },
    section: { marginTop: 10, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8 },
    sectionTitle: { color: colors.text, fontSize: 12, fontWeight: "700", marginBottom: 4, textTransform: "uppercase" },
    link: { color: colors.accent, fontSize: 11, fontWeight: "700", marginTop: 3 },
    suspendedNotice: { color: "#E7A0A0", fontSize: 11, marginTop: 8, fontStyle: "italic" },
    verifyBtn: { backgroundColor: "#5FA779", borderRadius: 8, padding: 10, alignItems: "center", marginTop: 10 },
    unverifyBtn: { backgroundColor: "#B0524F" },
    verifyBtnText: { color: "#FFFFFF", fontWeight: "700", fontSize: 12 },
    suspendBtn: { backgroundColor: "#B0524F", borderRadius: 8, padding: 10, alignItems: "center", marginTop: 8, flex: 1 },
    reactivateBtn: { backgroundColor: "#4A90D9", borderRadius: 8, padding: 10, alignItems: "center", marginTop: 8 },
    suspendBox: { marginTop: 8 },
    suspendInput: {
      borderWidth: 1, borderColor: "#B0524F", borderRadius: 8, padding: 10,
      color: colors.text, fontSize: 12, marginBottom: 8, minHeight: 50, textAlignVertical: "top",
    },
    suspendActionRow: { flexDirection: "row", gap: 8 },
    cancelSuspendBtn: { backgroundColor: colors.border, borderRadius: 8, padding: 10, alignItems: "center", flex: 1 },
    empty: { color: colors.textMuted, fontSize: 12, textAlign: "center", marginTop: 30 },
  });
}
