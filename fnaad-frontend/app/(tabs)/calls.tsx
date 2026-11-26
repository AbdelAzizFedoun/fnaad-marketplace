import React, { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View, TextInput } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { getMyConversations, getVoiceCallHistory, resolveMediaUrl, type VoiceCall } from "../../services/api";
import { useTheme } from "../../context/ThemeContext";
import ScreenHeader from "../../components/ScreenHeader";
import Image from "../../components/MediaImage";

const formatDate = (value: string) => new Date(value).toLocaleString([], {
  day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
});
const formatDuration = (seconds?: number | null) => seconds == null ? "" : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

export default function CallsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const [calls, setCalls] = useState<VoiceCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [contacts, setContacts] = useState<{ id: number; name: string; avatar: string | null }[]>([]);

  const load = useCallback(() => {
    Promise.all([getVoiceCallHistory(), getMyConversations()]).then(([history, conversations]) => {
      setCalls(history.data);
      const seen = new Set<number>();
      setContacts(conversations.data.flatMap((item: any) => {
        if (seen.has(item.id)) return [];
        seen.add(item.id);
        return [{ id: item.id, name: item.artist_name || item.customer_username || "FNAAD user", avatar: item.artist_avatar || null }];
      }));
    }).catch(() => undefined).finally(() => setLoading(false));
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const refresh = useCallback(() => {
    setRefreshing(true);
    getVoiceCallHistory().then((response) => setCalls(response.data)).catch(() => undefined).finally(() => setRefreshing(false));
  }, []);

  return <View style={styles.container}>
    <ScreenHeader title="Calls" />
    {loading ? <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} /> : <FlatList
      data={calls}
      keyExtractor={(item) => String(item.id)}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accent} />}
      contentContainerStyle={{ padding: 16, flexGrow: 1 }}
      ListHeaderComponent={<>
        <View style={styles.search}><Ionicons name="search-outline" size={18} color={colors.textMuted} /><TextInput value={search} onChangeText={setSearch} placeholder="Search a username" placeholderTextColor={colors.textMuted} style={styles.searchInput} /></View>
        {search.trim() ? <View style={styles.searchResults}>{contacts.filter((contact) => contact.name.toLowerCase().includes(search.trim().toLowerCase())).map((contact) => <Pressable key={contact.id} style={styles.contact} onPress={() => router.push(`/conversation/${contact.id}?autoCall=1`)}><View style={[styles.avatar, styles.avatarFallback]}><Ionicons name="person" size={20} color={colors.textMuted} /></View><Text style={styles.name}>{contact.name}</Text><Ionicons name="call" size={20} color={colors.accent} /></Pressable>)}{!contacts.some((contact) => contact.name.toLowerCase().includes(search.trim().toLowerCase())) ? <Text style={styles.hint}>No matching FNAAD contact found.</Text> : null}</View> : <Text style={styles.section}>Recent calls</Text>}
      </>}
      ListEmptyComponent={<View style={styles.empty}><Ionicons name="call-outline" size={42} color={colors.textMuted} /><Text style={styles.emptyText}>No calls yet</Text><Text style={styles.hint}>Your recent voice calls will appear here.</Text></View>}
      renderItem={({ item }) => {
        const missed = item.status === "rejected" || item.status === "expired";
        const color = missed ? "#B0524F" : colors.accent;
        return <Pressable style={styles.row} onPress={() => router.push(`/conversation/${item.conversation}`)}>
          {item.other_user_avatar ? <Image source={{ uri: resolveMediaUrl(item.other_user_avatar)! }} style={styles.avatar} /> : <View style={[styles.avatar, styles.avatarFallback]}><Ionicons name="person" size={20} color={colors.textMuted} /></View>}
          <View style={styles.copy}><Text style={styles.name}>{item.other_user_name || "FNAAD user"}</Text><View style={styles.meta}><Ionicons name={item.direction === "outgoing" ? "arrow-up" : "arrow-down"} size={15} color={color} /><Text style={[styles.status, { color }]}>{missed ? "Missed" : item.direction === "outgoing" ? "Outgoing" : "Incoming"}</Text><Text style={styles.date}>{formatDate(item.created_at)}{formatDuration(item.duration_seconds) ? ` · ${formatDuration(item.duration_seconds)}` : ""}</Text></View></View>
          <Pressable onPress={() => router.push(`/conversation/${item.conversation}?autoCall=1`)} hitSlop={10} accessibilityLabel="Call back"><Ionicons name="call-outline" size={21} color={colors.accent} /></Pressable>
        </Pressable>;
      }}
    />}
  </View>;
}

function createStyles(colors: any) { return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: colors.border },
  search: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 12, height: 44, marginBottom: 14 },
  searchInput: { flex: 1, color: colors.text, fontSize: 14 }, searchResults: { marginBottom: 14 }, contact: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }, section: { color: colors.text, fontWeight: "800", marginBottom: 4 },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.surface },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  copy: { flex: 1 }, name: { color: colors.text, fontWeight: "700", fontSize: 14 },
  meta: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 5 }, status: { fontSize: 12 }, date: { color: colors.textMuted, fontSize: 11, marginLeft: 5 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center" }, emptyText: { color: colors.text, fontWeight: "700", marginTop: 12 }, hint: { color: colors.textMuted, fontSize: 12, marginTop: 6 },
}); }
