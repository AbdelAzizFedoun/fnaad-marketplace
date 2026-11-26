import React, { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { getVoiceCallHistory, resolveMediaUrl, type VoiceCall } from "../../services/api";
import { useTheme } from "../../context/ThemeContext";
import ScreenHeader from "../../components/ScreenHeader";
import Image from "../../components/MediaImage";

const formatDate = (value: string) => new Date(value).toLocaleString([], {
  day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
});

export default function CallsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const [calls, setCalls] = useState<VoiceCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    getVoiceCallHistory().then((response) => setCalls(response.data)).catch(() => undefined).finally(() => setLoading(false));
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
      ListEmptyComponent={<View style={styles.empty}><Ionicons name="call-outline" size={42} color={colors.textMuted} /><Text style={styles.emptyText}>No calls yet</Text><Text style={styles.hint}>Your recent voice calls will appear here.</Text></View>}
      renderItem={({ item }) => {
        const missed = item.status === "rejected" || item.status === "expired";
        const color = missed ? "#B0524F" : colors.accent;
        return <Pressable style={styles.row} onPress={() => router.push(`/conversation/${item.conversation}`)}>
          {item.other_user_avatar ? <Image source={{ uri: resolveMediaUrl(item.other_user_avatar)! }} style={styles.avatar} /> : <View style={[styles.avatar, styles.avatarFallback]}><Ionicons name="person" size={20} color={colors.textMuted} /></View>}
          <View style={styles.copy}><Text style={styles.name}>{item.other_user_name || "FNAAD user"}</Text><View style={styles.meta}><Ionicons name={item.direction === "outgoing" ? "arrow-up" : "arrow-down"} size={15} color={color} /><Text style={[styles.status, { color }]}>{missed ? "Missed" : item.direction === "outgoing" ? "Outgoing" : "Incoming"}</Text><Text style={styles.date}>{formatDate(item.created_at)}</Text></View></View>
          <Ionicons name="call-outline" size={21} color={colors.accent} />
        </Pressable>;
      }}
    />}
  </View>;
}

function createStyles(colors: any) { return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: colors.border },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.surface },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  copy: { flex: 1 }, name: { color: colors.text, fontWeight: "700", fontSize: 14 },
  meta: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 5 }, status: { fontSize: 12 }, date: { color: colors.textMuted, fontSize: 11, marginLeft: 5 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center" }, emptyText: { color: colors.text, fontWeight: "700", marginTop: 12 }, hint: { color: colors.textMuted, fontSize: 12, marginTop: 6 },
}); }
