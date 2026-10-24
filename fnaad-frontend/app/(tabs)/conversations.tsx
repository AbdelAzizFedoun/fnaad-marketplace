import { useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Pressable, RefreshControl, TextInput } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { getMyConversations, resolveMediaUrl } from "../../services/api";
import { useLanguage } from "../../context/LanguageContext";
import { useTheme } from "../../context/ThemeContext";
import { useAuth } from "../../context/AuthContext";
import ScreenHeader from "../../components/ScreenHeader";
import Image from "../../components/MediaImage";
import { Ionicons } from "@expo/vector-icons";
import React from "react";

type ConversationSummary = {
  id: number;
  product_title: string | null;
  product_id: number | null;
  customer_username: string;
  artist_name: string;
  artist_avatar: string | null;
  unread: boolean;
  messages: {
    id: number;
    text: string | null;
    sender_username: string;
    message_type: string;
    created_at: string;
  }[];
};

type ListFilter = "all" | "unread";

const MEDIA_PREVIEWS: Record<string, { icon: string; label: string }> = {
  image: { icon: "image-outline", label: "Photo" },
  audio: { icon: "mic-outline", label: "Voice note" },
  location: { icon: "location-outline", label: "Location" },
  document: { icon: "document-outline", label: "Document" },
};

function formatListTime(value: string): string {
  const date = new Date(value);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString([], { month: "numeric", day: "numeric" });
}

export default function ConversationsListScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { colors } = useTheme();
  const { user } = useAuth();
  const styles = createStyles(colors);

  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<ListFilter>("all");

  const load = () => {
    setError(null);
    getMyConversations()
      .then((res) => setConversations(res.data))
      .catch((err) => setError(err.response?.data?.detail || "Failed to load conversations"))
      .finally(() => setLoading(false));
  };

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    getMyConversations()
      .then((res) => setConversations(res.data))
      .catch((err) => setError(err.response?.data?.detail || "Failed to load conversations"))
      .finally(() => setRefreshing(false));
  }, []);

  useEffect(() => {
    load();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      load();
    }, [])
  );

  const query = searchQuery.trim().toLowerCase();
  const filtered = conversations
    .filter((item) => {
      if (filter === "unread" && !item.unread) return false;
      if (!query) return true;
      const lastMessage = item.messages?.[item.messages.length - 1];
      return (
        (item.product_title || "").toLowerCase().includes(query) ||
        (item.customer_username || "").toLowerCase().includes(query) ||
        (item.artist_name || "").toLowerCase().includes(query) ||
        (lastMessage?.text || "").toLowerCase().includes(query)
      );
    })
    .sort((a, b) => {
      const at = a.messages?.[a.messages.length - 1]?.created_at || "";
      const bt = b.messages?.[b.messages.length - 1]?.created_at || "";
      return bt.localeCompare(at);
    });

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <ScreenHeader title={t("myConversationsTitle")} showProfileAction />
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
      <ScreenHeader title={t("myConversationsTitle")} showProfileAction />

      <View style={styles.searchRow}>
        <Ionicons name="search" size={16} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search conversations"
          placeholderTextColor={colors.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
          autoCapitalize="none"
        />
        {searchQuery ? (
          <Pressable onPress={() => setSearchQuery("")} hitSlop={8} accessibilityLabel="Clear search">
            <Ionicons name="close-circle" size={16} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.chipRow}>
        {([
          { key: "all", label: "All" },
          { key: "unread", label: "Unread" },
        ] as { key: ListFilter; label: string }[]).map((option) => {
          const selected = filter === option.key;
          return (
            <Pressable
              key={option.key}
              onPress={() => setFilter(option.key)}
              style={[styles.chip, { backgroundColor: selected ? colors.accent : colors.surface, borderColor: colors.border }]}
              accessibilityRole="button"
            >
              <Text style={[styles.chipText, { color: selected ? colors.accentText : colors.text }]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={{ paddingTop: 10, paddingBottom: 24 }}
        refreshing={refreshing}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="chatbubbles-outline" size={40} color={colors.textMuted} />
            <Text style={styles.emptyText}>
              {query || filter === "unread" ? "No conversations match your filters" : t("noConversations")}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const lastMessage = item.messages?.[item.messages.length - 1];
          const isCustomerSide = item.customer_username === user?.username;
          const otherName = isCustomerSide ? item.artist_name || item.customer_username : item.customer_username;
          const avatarUrl = isCustomerSide ? item.artist_avatar : null;
          const media = lastMessage ? MEDIA_PREVIEWS[lastMessage.message_type] : null;
          const previewText = lastMessage
            ? media ? media.label : lastMessage.text || ""
            : "";

          return (
            <Pressable
              style={[styles.card, item.unread && { borderColor: colors.accent }]}
              onPress={() => router.push(`/conversation/${item.id}`)}
            >
              {avatarUrl ? (
                <Image source={{ uri: resolveMediaUrl(avatarUrl) || undefined }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: colors.background }]}>
                  <Text style={[styles.avatarInitial, { color: colors.textMuted }]}>
                    {otherName.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={styles.cardBody}>
                <View style={styles.cardHeader}>
                  <Text
                    style={[styles.cardTitle, item.unread && styles.cardTitleUnread]}
                    numberOfLines={1}
                  >
                    {item.product_title || otherName}
                  </Text>
                  {lastMessage?.created_at ? (
                    <Text style={[styles.cardTime, item.unread && styles.cardTimeUnread]}>
                      {formatListTime(lastMessage.created_at)}
                    </Text>
                  ) : null}
                </View>
                <Text style={styles.cardCustomer} numberOfLines={1}>{otherName}</Text>
                {lastMessage ? (
                  <View style={styles.previewRow}>
                    {media ? (
                      <Ionicons name={media.icon as any} size={13} color={colors.textMuted} style={styles.previewIcon} />
                    ) : null}
                    <Text
                      style={[styles.cardPreview, item.unread && styles.cardPreviewUnread]}
                      numberOfLines={1}
                    >
                      {lastMessage.sender_username === user?.username ? "You" : lastMessage.sender_username}: {previewText}
                    </Text>
                  </View>
                ) : null}
              </View>
              {item.unread && <View style={styles.unreadDot} />}
            </Pressable>
          );
        }}
      />
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
    searchRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 20,
      paddingHorizontal: 12,
      paddingVertical: 8,
      marginTop: 10,
      backgroundColor: colors.surface,
    },
    searchInput: { flex: 1, fontSize: 14, color: colors.text, padding: 0 },
    chipRow: { flexDirection: "row", gap: 8, marginTop: 10 },
    chip: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 6 },
    chipText: { fontSize: 12, fontWeight: "700" },
    card: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      borderWidth: 1,
      borderRadius: 14,
      padding: 12,
      marginBottom: 10,
    },
    avatar: { width: 46, height: 46, borderRadius: 23 },
    avatarFallback: { alignItems: "center", justifyContent: "center" },
    avatarInitial: { fontSize: 18, fontWeight: "800" },
    cardBody: { flex: 1, gap: 2 },
    cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
    cardTitle: { color: colors.text, fontSize: 15, fontWeight: "600", flex: 1 },
    cardTitleUnread: { fontWeight: "800" },
    cardTime: { color: colors.textMuted, fontSize: 11 },
    cardTimeUnread: { color: colors.accent, fontWeight: "700" },
    cardCustomer: { color: colors.textMuted, fontSize: 11 },
    previewRow: { flexDirection: "row", alignItems: "center", marginTop: 4 },
    previewIcon: { marginRight: 5 },
    cardPreview: { color: colors.textMuted, fontSize: 12, flex: 1 },
    cardPreviewUnread: { color: colors.text, fontWeight: "700" },
    unreadDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent },
    emptyState: { alignItems: "center", gap: 12, marginTop: 60, paddingHorizontal: 24 },
    emptyText: { color: colors.textMuted, fontSize: 13, textAlign: "center" },
  });
}
