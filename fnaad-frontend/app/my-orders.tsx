import { useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from "react-native";
import { getMyOrders } from "../services/api";
import { useTheme } from "../context/ThemeContext";
import ScreenHeader from "../components/ScreenHeader";
import React from "react";

type Order = {
  id: number;
  product_title: string;
  artist_name: string;
  amount_xaf: number;
  status: string;
  created_at: string;
};

const STATUS_LABELS: Record<string, string> = {
  pending_payment: "Pending",
  paid: "Paid",
  failed: "Failed",
  cancelled: "Cancelled",
};

export default function MyOrdersScreen() {
  const { colors } = useTheme();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    getMyOrders()
      .then((res) => setOrders(res.data))
      .catch((err) => {
        console.log("My orders error:", err.response?.data || err.message);
        setErrorMsg("Could not load inquiries. Are you logged in as an artist?");
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="My inquiries" />
        <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="My inquiries" />

      {errorMsg ? <Text style={styles.error}>{errorMsg}</Text> : null}

      <FlatList
        data={orders}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={{ padding: 16, paddingTop: 10 }}
        ListEmptyComponent={
          !errorMsg ? <Text style={styles.empty}>No inquiries yet.</Text> : null
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{item.product_title}</Text>
            <Text style={styles.cardPrice}>{item.amount_xaf} XAF</Text>
            <Text style={styles.cardStatus}>
              {STATUS_LABELS[item.status] || item.status}
            </Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0B0A0C" },
  error: { color: "#E7A0A0", fontSize: 12, textAlign: "center", margin: 16, marginBottom: 4 },
  empty: { color: "#9C979E", fontSize: 12, textAlign: "center", marginTop: 30 },
  card: {
    borderWidth: 1, borderColor: "#2A272C", borderRadius: 10,
    padding: 14, marginBottom: 10,
  },
  cardTitle: { color: "#F0ECE4", fontSize: 15, fontWeight: "600" },
  cardPrice: { color: "#E7C878", fontSize: 13, marginTop: 4 },
  cardStatus: { color: "#9C979E", fontSize: 11, marginTop: 6, textTransform: "uppercase" },
});
