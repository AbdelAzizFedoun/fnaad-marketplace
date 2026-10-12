import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Image from "../components/MediaImage";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { getMyArtistProfile, resolveMediaUrl, updateMyArtistProfile } from "../services/api";
import { useTheme } from "../context/ThemeContext";
import ScreenHeader from "../components/ScreenHeader";

export default function EditArtistProfileScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const [brandName, setBrandName] = useState("");
  const [practice, setPractice] = useState("");
  const [bio, setBio] = useState("");
  const [instagram, setInstagram] = useState("");
  const [portfolioUrl, setPortfolioUrl] = useState("");
  const [region, setRegion] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [currentAvatar, setCurrentAvatar] = useState<string | null>(null);
  const [newAvatar, setNewAvatar] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");

  useEffect(() => { getMyArtistProfile().then(({ data }) => {
    setBrandName(data.brand_name || ""); setPractice(data.artistic_practice || ""); setBio(data.bio || "");
    setInstagram(data.instagram_handle || ""); setPortfolioUrl(data.portfolio_url || ""); setRegion(data.region_display || data.region || ""); setCurrentAvatar(data.avatar || null); setNationalId(data.national_id_number || "");
  }).catch(() => Alert.alert("Unable to load profile", "Please try again.")).finally(() => setLoading(false)); }, []);

  const pickAvatar = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return Alert.alert("Photo permission needed", "Allow photo access to choose your storefront photo.");
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.75 });
    if (!result.canceled) setNewAvatar(result.assets[0]);
  };

  const save = async () => {
    if (!brandName.trim()) return Alert.alert("Storefront name required", "Add the name customers will see for your art.");
    if (portfolioUrl.trim() && !/^http?:\/\//i.test(portfolioUrl.trim())) return Alert.alert("Portfolio link", "Start your portfolio link with http://");
    setSaving(true);
    try {
      await updateMyArtistProfile({ brand_name: brandName.trim(), artistic_practice: practice.trim(), bio: bio.trim(), instagram_handle: instagram.trim().replace(/^@/, ""), portfolio_url: portfolioUrl.trim(), avatarUri: newAvatar?.uri || null, national_id_number: nationalId.trim() });
      setNewAvatar(null); setSuccess("Your storefront has been updated successfully."); setTimeout(() => setSuccess(""), 4500);
    } catch (error: any) { Alert.alert("Could not save storefront", error?.response?.data?.detail || "Please review your details and try again."); }
    finally { setSaving(false); }
  };

  if (loading) return <View style={styles.container}><ScreenHeader title="Storefront & artist bio" /><ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} /></View>;
  const avatarUri = newAvatar?.uri || resolveMediaUrl(currentAvatar || undefined);
  return <View style={styles.container}><ScreenHeader title="Storefront & artist bio" />
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
      <Text style={styles.intro}>Build the public profile collectors see before they discover your work.</Text>
      <View style={styles.previewCard}><Pressable style={styles.avatar} onPress={() => void pickAvatar()}>{avatarUri ? <Image source={{ uri: avatarUri }} style={styles.avatarImage} /> : <Ionicons name="image-outline" size={28} color={colors.textMuted} />}<View style={styles.camera}><Ionicons name="camera" size={13} color="#fff" /></View></Pressable><View style={{ flex: 1 }}><Text style={styles.previewName}>{brandName || "Your studio name"}</Text><Text style={styles.previewMeta}>{practice || "Your artistic practice"}{region ? ` · ${region}` : ""}</Text><Pressable onPress={() => void pickAvatar()}><Text style={styles.photoLink}>Change storefront photo</Text></Pressable></View></View>
      {success ? <View style={styles.success}><Ionicons name="checkmark-circle" size={20} color="#1F7A45" /><Text style={styles.successText}>{success}</Text></View> : null}
      <Text style={styles.section}>Your identity</Text>
      <Text style={styles.label}>Storefront name *</Text><TextInput style={styles.field} value={brandName} onChangeText={setBrandName} placeholder="e.g. Atelier Ndam" placeholderTextColor={colors.textMuted} maxLength={120} />
      <Text style={styles.label}>Artistic practice</Text><TextInput style={styles.field} value={practice} onChangeText={setPractice} placeholder="e.g. Contemporary painter and illustrator" placeholderTextColor={colors.textMuted} maxLength={120} />
      <Text style={styles.label}>National ID Number (CNI)</Text><TextInput style={styles.field} value={nationalId} onChangeText={setNationalId} placeholder="At least 9 digits" placeholderTextColor={colors.textMuted} maxLength={20} keyboardType="number-pad" />
      <Text style={styles.section}>Artist statement</Text><Text style={styles.hint}>Share your medium, inspiration, and what makes your work distinctive. Keep it clear and personal.</Text><TextInput style={[styles.field, styles.bio]} value={bio} onChangeText={setBio} placeholder="I create..." placeholderTextColor={colors.textMuted} multiline maxLength={600} textAlignVertical="top" /><Text style={styles.count}>{bio.length}/600</Text>
      <Text style={styles.section}>Find me online</Text><Text style={styles.hint}>Optional links help collectors learn more about your work.</Text>
      <Text style={styles.label}>Instagram</Text><TextInput style={styles.field} value={instagram} onChangeText={setInstagram} placeholder="yourhandle" placeholderTextColor={colors.textMuted} autoCapitalize="none" maxLength={60} />
      <Text style={styles.label}>Portfolio website</Text><TextInput style={styles.field} value={portfolioUrl} onChangeText={setPortfolioUrl} placeholder="http://yourportfolio.com" placeholderTextColor={colors.textMuted} autoCapitalize="none" keyboardType="url" />
      <Pressable style={[styles.saveButton, saving && { opacity: 0.65 }]} onPress={save} disabled={saving}><Text style={styles.saveText}>{saving ? "Saving..." : "Save storefront"}</Text></Pressable>
    </ScrollView>
  </View>;
}

function createStyles(colors: any) { return StyleSheet.create({ container: { flex: 1, backgroundColor: colors.background }, content: { padding: 20, paddingBottom: 42, maxWidth: 680, width: "100%", alignSelf: "center" }, intro: { color: colors.textMuted, fontSize: 13, lineHeight: 19, marginBottom: 18 }, previewCard: { borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 15, flexDirection: "row", gap: 14, alignItems: "center" }, avatar: { width: 70, height: 70, borderRadius: 35, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" }, avatarImage: { width: 70, height: 70, borderRadius: 35 }, camera: { position: "absolute", right: -1, bottom: -1, backgroundColor: colors.accent, width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: colors.background }, previewName: { color: colors.text, fontSize: 16, fontWeight: "800" }, previewMeta: { color: colors.textMuted, fontSize: 12, marginTop: 4 }, photoLink: { color: colors.accent, fontSize: 12, fontWeight: "700", marginTop: 8 }, success: { flexDirection: "row", gap: 8, alignItems: "center", backgroundColor: "#DCFCE7", borderWidth: 1, borderColor: "#86EFAC", borderRadius: 9, padding: 12, marginTop: 18 }, successText: { color: "#166534", fontSize: 13, fontWeight: "700", flex: 1 }, section: { color: colors.text, fontSize: 16, fontWeight: "800", marginTop: 26, marginBottom: 8 }, label: { color: colors.text, fontSize: 13, fontWeight: "700", marginBottom: 7 }, hint: { color: colors.textMuted, fontSize: 12, lineHeight: 18, marginBottom: 12 }, field: { borderWidth: 1, borderColor: colors.border, borderRadius: 9, padding: 12, color: colors.text, fontSize: 14, marginBottom: 14 }, bio: { minHeight: 135 }, count: { color: colors.textMuted, fontSize: 11, textAlign: "right", marginTop: -9 }, saveButton: { backgroundColor: colors.accent, padding: 14, borderRadius: 9, alignItems: "center", marginTop: 24 }, saveText: { color: colors.accentText, fontSize: 14, fontWeight: "800" } }); }
