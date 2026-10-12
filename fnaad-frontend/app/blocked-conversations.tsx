import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import ScreenHeader from "../components/ScreenHeader";
import { getBlockedConversations, unblockConversation } from "../services/api";
import { useTheme } from "../context/ThemeContext";

type BlockedConversation = {
  id: number;
  product_title: string | null;
  customer_username: string;
  artist_name: string;
  messages: { text: string }[];
};

export default function BlockedConversationsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [items, setItems] = useState<BlockedConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    getBlockedConversations().then((res) => setItems(res.data)).catch(() => setItems([])).finally(() => setLoading(false));
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const confirmUnblock = (item: BlockedConversation) => {
    Alert.alert("Unblock conversation", "This restores the chat for both people. Either person can send messages again.", [
      { text: "Cancel", style: "cancel" },
      { text: "Unblock", onPress: async () => {
        setBusyId(item.id);
        try {
          await unblockConversation(item.id);
          setItems((current) => current.filter((entry) => entry.id !== item.id));
        } catch {
          Alert.alert("Unable to unblock", "Please try again.");
        } finally { setBusyId(null); }
      } },
    ]);
  };

  return <View style={[styles.container, { backgroundColor: colors.background }]}>
    <ScreenHeader title="Blocked conversations" />
    {loading ? <ActivityIndicator style={{ marginTop: 32 }} color={colors.accent} /> : <FlatList
      data={items}
      keyExtractor={(item) => String(item.id)}
      contentContainerStyle={items.length ? styles.list : styles.emptyWrap}
      ListEmptyComponent={<View><Text style={[styles.emptyTitle, { color: colors.text }]}>No blocked conversations</Text><Text style={[styles.emptyText, { color: colors.textMuted }]}>Conversations you block will appear here.</Text></View>}
      renderItem={({ item }) => <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surface }]}>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>{item.product_title || "Commission request"}</Text>
        <Text style={[styles.person, { color: colors.textMuted }]}>{item.artist_name} · {item.customer_username}</Text>
        <Pressable style={[styles.unblock, { borderColor: colors.accent }]} onPress={() => confirmUnblock(item)} disabled={busyId === item.id}>
          <Text style={[styles.unblockText, { color: colors.accent }]}>{busyId === item.id ? "Unblocking…" : "Unblock"}</Text>
        </Pressable>
      </View>}
    />}
  </View>;
}

const styles = StyleSheet.create({
  container: { flex: 1 }, list: { padding: 16, gap: 10 }, emptyWrap: { flexGrow: 1, justifyContent: "center", alignItems: "center", padding: 32 },
  emptyTitle: { fontSize: 17, fontWeight: "700", textAlign: "center" }, emptyText: { fontSize: 13, textAlign: "center", marginTop: 7 },
  card: { borderWidth: 1, borderRadius: 12, padding: 15 }, title: { fontSize: 15, fontWeight: "700" }, person: { fontSize: 12, marginTop: 5 },
  unblock: { alignSelf: "flex-start", borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 9, marginTop: 14 }, unblockText: { fontSize: 13, fontWeight: "700" },
});
