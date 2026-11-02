import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import Image from "../../components/MediaImage";
import ScreenHeader from "../../components/ScreenHeader";
import { useLanguage } from "../../context/LanguageContext";
import { useTheme } from "../../context/ThemeContext";
import { getFollowerProfile, resolveMediaUrl } from "../../services/api";

type FollowerProfile = {
  id: number;
  username: string;
  profile_photo: string | null;
  role: "artist" | "customer";
  artist_name: string | null;
};

export default function FollowerProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useLanguage();
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const [profile, setProfile] = useState<FollowerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const userId = Number(id);
    if (!Number.isInteger(userId) || userId <= 0) {
      setError(true);
      setLoading(false);
      return;
    }

    getFollowerProfile(userId)
      .then((response) => setProfile(response.data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [id]);

  const displayName = profile?.artist_name || profile?.username || "";
  const roleLabel = profile?.role === "artist"
    ? t("followerArtistRole")
    : t("followerCustomerRole");
  const photoUrl = resolveMediaUrl(profile?.profile_photo);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScreenHeader title={t("followerProfileTitle")} />
      {loading ? (
        <ActivityIndicator color={colors.accent} style={styles.loading} />
      ) : error || !profile ? (
        <Text style={[styles.error, { color: colors.textMuted }]}>
          {t("followerProfileUnavailable")}
        </Text>
      ) : (
        <View style={[styles.profileCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {photoUrl ? (
            <Image source={{ uri: photoUrl }} style={[styles.avatar, { borderColor: colors.accent }]} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder, { borderColor: colors.accent, backgroundColor: colors.background }]}>
              <Text style={[styles.avatarInitial, { color: colors.accent }]}>
                {displayName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <Text style={[styles.name, { color: colors.text }]}>{displayName}</Text>
          {profile.artist_name && profile.artist_name !== profile.username ? (
            <Text style={[styles.username, { color: colors.textMuted }]}>@{profile.username}</Text>
          ) : null}
          <View style={[styles.roleBadge, { borderColor: colors.accent }]}>
            <Text style={[styles.roleText, { color: colors.accent }]}>{roleLabel}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>["colors"]) {
  return StyleSheet.create({
    container: { flex: 1 },
    loading: { marginTop: 48 },
    error: { marginTop: 48, paddingHorizontal: 24, textAlign: "center", fontSize: 14 },
    profileCard: {
      alignItems: "center",
      alignSelf: "center",
      borderWidth: 1,
      borderRadius: 18,
      marginTop: 36,
      maxWidth: 480,
      paddingHorizontal: 32,
      paddingVertical: 36,
      width: "90%",
    },
    avatar: { width: 92, height: 92, borderRadius: 46, borderWidth: 2 },
    avatarPlaceholder: { alignItems: "center", justifyContent: "center" },
    avatarInitial: { fontSize: 32, fontWeight: "700" },
    name: { fontSize: 21, fontWeight: "700", marginTop: 16, textAlign: "center" },
    username: { fontSize: 14, marginTop: 5 },
    roleBadge: { borderWidth: 1, borderRadius: 999, marginTop: 16, paddingHorizontal: 16, paddingVertical: 7 },
    roleText: { fontSize: 13, fontWeight: "700" },
  });
}
