import { useCallback, useState } from "react";
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Pressable, RefreshControl } from "react-native";
import Image from "../../components/MediaImage";
import { useRouter, useFocusEffect } from "expo-router";
import { getMyFavorites, resolveMediaUrl, toggleFavorite } from "../../services/api";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import { Ionicons } from "@expo/vector-icons";
import ScreenHeader from "../../components/ScreenHeader";
import React from "react";

type FavoriteEntry = {
  id: number;
  product: number;
  product_detail: {
    id: number;
    title: string;
    price_xaf: number;
    category_display: string;
    artist_name: string;
    images: { image: string; is_primary: boolean }[];
  };
};

export default function FavoritesScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useLanguage();
  const styles = createStyles(colors);

  const [favorites, setFavorites] = useState<FavoriteEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    getMyFavorites()
      .then((res) => setFavorites(res.data))
      .catch((err) => setError(err.response?.data?.detail || "Failed to load favorites"))
      .finally(() => setLoading(false));
  };

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    getMyFavorites()
      .then((res) => setFavorites(res.data))
      .catch((err) => setError(err.response?.data?.detail || "Failed to load favorites"))
      .finally(() => setRefreshing(false));
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  const handleRemove = (productId: number) => {
    setFavorites((prev) => prev.filter((f) => f.product !== productId));
    toggleFavorite(productId).catch(() => load());
  };

  if (error) {
    return (
      <View style={styles.container}>
        <ScreenHeader title={t("favorites") || "My favorites"} showProfileAction />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={load} style={styles.retryBtn}>
            <Text style={styles.retryBtnText}>{t("retry")}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title={t("favorites") || "My favorites"} showProfileAction />

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={favorites}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ paddingTop: 10 }}
          refreshing={refreshing}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
          }
          ListEmptyComponent={
            <Text style={styles.empty}>You do not have any favorites yet.</Text>
          }
          renderItem={({ item }) => {
            const primaryImage =
              item.product_detail.images?.find((img) => img.is_primary) ||
              item.product_detail.images?.[0];
            const imageUrl = resolveMediaUrl(primaryImage?.image);

            return (
              <Pressable
                style={styles.card}
                onPress={() => router.push(`/product/${item.product_detail.id}`)}
              >
                {imageUrl && (
                  <Image source={{ uri: imageUrl }} style={styles.cardImage} resizeMode="cover" />
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{item.product_detail.title}</Text>
                  <Text style={styles.cardArtist}>{item.product_detail.artist_name}</Text>
                  <Text style={styles.cardPrice}>{item.product_detail.price_xaf} XAF</Text>
                </View>
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    handleRemove(item.product_detail.id);
                  }}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel="Remove from favorites"
                >
                  <Ionicons name="heart" size={22} color="#E05252" />
                </Pressable>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>["colors"]) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 16 },
    errorContainer: { flex: 1, justifyContent: "center", alignItems: "center", gap: 16 },
    errorText: { color: colors.textMuted, fontSize: 14, textAlign: "center" },
    retryBtn: { backgroundColor: colors.accent, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 24 },
    retryBtnText: { color: colors.accentText, fontWeight: "700", fontSize: 14 },
    card: {
      flexDirection: "row", alignItems: "center", gap: 12,
      borderWidth: 1, borderColor: colors.border, borderRadius: 10,
      padding: 10, marginBottom: 10,
    },
    cardImage: { width: 64, height: 64, borderRadius: 8, backgroundColor: colors.surface },
    cardTitle: { color: colors.text, fontSize: 14, fontWeight: "600" },
    cardArtist: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
    cardPrice: { color: colors.accent, fontSize: 13, marginTop: 4 },
    empty: { color: colors.textMuted, fontSize: 12, textAlign: "center", marginTop: 30 },
  });
}
