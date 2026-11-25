import React, { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import ScreenHeader from "../components/ScreenHeader";
import { deleteAccount } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

export default function DeleteAccountScreen() {
  const router = useRouter();
  const { logout } = useAuth();
  const { colors } = useTheme();
  const [confirmation, setConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const canDelete = confirmation.trim().toUpperCase() === "DELETE";

  const removeAccount = async () => {
    if (!canDelete || deleting) return;
    setDeleting(true);
    setErrorMessage("");
    try {
      await deleteAccount();
      await logout();
    } catch (error: any) {
      const detail = error?.response?.data?.detail;
      setErrorMessage(typeof detail === "string" ? detail : "The account could not be deleted. Please try again.");
      setDeleting(false);
    }
  };

  return <View style={[styles.container, { backgroundColor: colors.background }]}>
    <ScreenHeader title="Delete account" />
    <View style={styles.content}>
      <View style={[styles.icon, { backgroundColor: "#B0524F22" }]}><Ionicons name="warning-outline" size={34} color="#B0524F" /></View>
      <Text style={[styles.title, { color: colors.text }]}>Are you sure?</Text>
      <Text style={[styles.body, { color: colors.textMuted }]}>This permanently removes your profile, products, messages, and personal information. If you have order history, the account is anonymized so the order records can remain valid.</Text>
      <Text style={[styles.label, { color: colors.text }]}>Type DELETE to confirm</Text>
      <TextInput value={confirmation} onChangeText={setConfirmation} autoCapitalize="characters" placeholder="DELETE" placeholderTextColor={colors.textMuted} style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]} />
      {errorMessage ? <Text accessibilityRole="alert" style={styles.error}>{errorMessage}</Text> : null}
      <Pressable style={[styles.deleteButton, { backgroundColor: canDelete ? "#B0524F" : colors.border }]} onPress={() => void removeAccount()} disabled={!canDelete || deleting}>{deleting ? <ActivityIndicator color="#FFF" /> : <><Ionicons name="trash-outline" size={18} color={canDelete ? "#FFF" : colors.textMuted} /><Text style={{ color: canDelete ? "#FFF" : colors.textMuted, fontWeight: "800" }}>Delete permanently</Text></>}</Pressable>
      <Pressable style={styles.cancel} onPress={() => router.back()} disabled={deleting}><Text style={{ color: colors.accent, fontWeight: "700" }}>Cancel</Text></Pressable>
    </View>
  </View>;
}

const styles = StyleSheet.create({ container: { flex: 1 }, content: { width: "100%", maxWidth: 520, alignSelf: "center", padding: 22, alignItems: "center" }, icon: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center", marginTop: 28 }, title: { fontSize: 24, fontWeight: "800", marginTop: 18 }, body: { fontSize: 14, lineHeight: 21, textAlign: "center", marginTop: 10, marginBottom: 25 }, label: { alignSelf: "stretch", fontSize: 13, fontWeight: "700", marginBottom: 7 }, input: { alignSelf: "stretch", borderWidth: 1, borderRadius: 10, padding: 13, fontSize: 16, marginBottom: 14 }, error: { alignSelf: "stretch", color: "#B0524F", fontSize: 13, marginBottom: 12 }, deleteButton: { width: "100%", minHeight: 48, borderRadius: 24, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }, cancel: { padding: 16 } });
