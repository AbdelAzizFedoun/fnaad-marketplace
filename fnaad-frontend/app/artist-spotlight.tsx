import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";
import React from "react";
import ScreenHeader from "../components/ScreenHeader";
import { approveMySpotlight, getMyProducts, getMySpotlightFeatures, requestSpotlight } from "../services/api";
import { useLanguage } from "../context/LanguageContext";
import { useTheme } from "../context/ThemeContext";

type Feature = { id: number; product_id: number; product_title: string; artist_approved: boolean; admin_approved: boolean; starts_at?: string | null; expires_at?: string | null };
type Product = { id: number; title: string; status?: string; is_public_visible?: boolean };
export default function ArtistSpotlightScreen() {
  const { t } = useLanguage(); const { colors } = useTheme(); const styles = createStyles(colors); const [items, setItems] = useState<Feature[]>([]); const [products, setProducts] = useState<Product[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const load = () => { setLoading(true); Promise.all([getMySpotlightFeatures(), getMyProducts()]).then(([features, ownProducts]) => { setItems(features.data || []); setProducts(ownProducts.data || []); }).catch(() => setError(t("dashboardLoadError"))).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);
  const request = async (productId: number) => { try { const response = await requestSpotlight(productId); setItems((current) => [...current.filter((item) => item.id !== response.data.id), response.data]); } catch { setError(t("approveError")); } };
  const approve = async (id: number) => { try { await approveMySpotlight(id); setItems((current) => current.map((item) => item.id === id ? { ...item, artist_approved: true } : item)); } catch { setError(t("approveError")); } };
  const requestedIds = new Set(items.map((item) => item.product_id));
  return <View style={styles.container}><ScreenHeader title={t("spotlightApproval")} />{loading ? <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} /> : <FlatList data={products.filter((product) => product.status === "approved" && product.is_public_visible !== false)} keyExtractor={(item) => String(item.id)} contentContainerStyle={styles.content} ListHeaderComponent={<Text style={styles.description}>{t("spotlightApprovalDescription")}</Text>} ListEmptyComponent={<Text style={styles.empty}>{error || t("noSpotlightRequests")}</Text>} renderItem={({ item }) => { const feature = items.find((entry) => entry.product_id === item.id); return <View style={styles.card}><Text style={styles.title}>{item.title}</Text>{feature ? <><Text style={styles.status}>{feature.admin_approved ? t("spotlightApproved") : feature.artist_approved ? t("spotlightApprovalDescription") : t("approveSpotlight")}</Text>{!feature.artist_approved && <Text onPress={() => approve(feature.id)} style={styles.action}>{t("approveSpotlight")}</Text>}</> : <Text onPress={() => request(item.id)} style={styles.action}>{t("requestSpotlight")}</Text>}</View>; }} />}</View>;
}
function createStyles(colors: ReturnType<typeof useTheme>["colors"]) { return StyleSheet.create({ container: { flex: 1, backgroundColor: colors.background }, content: { padding: 16, gap: 12 }, description: { color: colors.textMuted, fontSize: 13, marginBottom: 8 }, empty: { color: colors.textMuted, textAlign: "center", marginTop: 30 }, card: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 14, backgroundColor: colors.surface }, title: { color: colors.text, fontSize: 15, fontWeight: "700" }, status: { color: colors.textMuted, marginVertical: 10 }, action: { color: colors.accent, fontWeight: "700" } }); }
