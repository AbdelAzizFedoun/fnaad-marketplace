import React, { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Image from "../components/MediaImage";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import ScreenHeader from "../components/ScreenHeader";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { useTheme } from "../context/ThemeContext";
import { useResponsiveLayout } from "../hooks/useResponsiveLayout";
import { changePassword, resolveMediaUrl, updateProfile } from "../services/api";
import { LANGUAGES, LanguageCode } from "../i18n/translations";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

function LinkRow({ icon, label, detail, onPress, danger = false, colors }: { icon: IconName; label: string; detail?: string; onPress: () => void; danger?: boolean; colors: any }) {
  return <Pressable style={[styles.linkRow, { borderColor: danger ? "#B0524F" : colors.border }]} onPress={onPress}>
    <Ionicons name={icon} size={20} color={danger ? "#B0524F" : colors.accent} />
    <View style={styles.linkText}><Text style={[styles.linkLabel, { color: danger ? "#B0524F" : colors.text }]}>{label}</Text>{detail ? <Text style={[styles.linkDetail, { color: colors.textMuted }]}>{detail}</Text> : null}</View>
    <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
  </Pressable>;
}

export default function SettingsScreen() {
  const router = useRouter();
  const { user, refreshUser, logout } = useAuth();
  const { language, setLanguage } = useLanguage();
  const { mode, setMode, colors } = useTheme();
  const { t } = useLanguage();
  const layout = useResponsiveLayout();
  const [username, setUsername] = useState(user?.username || "");
  const [email, setEmail] = useState(user?.email || "");
  const [phoneNumber, setPhoneNumber] = useState(user?.phone_number || "");
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState("");
  const [newProfilePhoto, setNewProfilePhoto] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const pageStyles = createStyles(colors, layout);

  // The account can finish loading after this screen mounts. Keep the form in
  // sync with the refreshed account data, including immediately after saving.
  useEffect(() => {
    if (!user) return;
    setUsername(user.username || "");
    setEmail(user.email || "");
    setPhoneNumber(user.phone_number || "");
  }, [user]);

  const chooseProfilePhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return Alert.alert("Photo permission needed", "Allow photo access to choose a profile picture.");
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.75,
    });
    if (!result.canceled) setNewProfilePhoto(result.assets[0]);
  };

  const saveProfile = async () => {
    if (!username.trim() || !email.trim() || !phoneNumber.trim()) return Alert.alert("Missing information", "Please complete your name, email, and phone number.");
    setSavingProfile(true);
    try {
      await updateProfile({ username: username.trim(), email: email.trim(), phone_number: phoneNumber.trim(), profilePhoto: newProfilePhoto ? { uri: newProfilePhoto.uri, fileName: newProfilePhoto.fileName, mimeType: newProfilePhoto.mimeType, file: newProfilePhoto.file } : null });
      await refreshUser();
      setNewProfilePhoto(null);
      setProfileSuccess("Profile updated successfully.");
      setTimeout(() => setProfileSuccess(""), 4500);
    }
    catch (error: any) { const data = error?.response?.data; Alert.alert("Could not update profile", data?.username?.[0] || data?.email?.[0] || data?.phone_number?.[0] || "Please try again."); }
    finally { setSavingProfile(false); }
  };

  const savePassword = async () => {
    if (!oldPassword || !newPassword) return Alert.alert("Missing password", "Enter your current and new password.");
    setSavingPassword(true);
    try { await changePassword(oldPassword, newPassword); setOldPassword(""); setNewPassword(""); Alert.alert("Password updated", "Your password has been changed."); }
    catch (error: any) { Alert.alert("Could not change password", error?.response?.data?.old_password?.[0] || "Please check your current password."); }
    finally { setSavingPassword(false); }
  };

  return <View style={pageStyles.container}>
    <ScreenHeader title={t("settingsTitle")} />
    <ScrollView contentContainerStyle={pageStyles.content} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
      <View style={[pageStyles.identityCard, { borderColor: colors.border }]}>
        <Pressable style={[pageStyles.avatar, { backgroundColor: colors.accent }]} onPress={() => void chooseProfilePhoto()}>
          {newProfilePhoto?.uri || user?.profile_photo ? <Image source={{ uri: newProfilePhoto?.uri || resolveMediaUrl(user?.profile_photo || undefined)! }} style={pageStyles.avatarImage} /> : <Text style={{ color: colors.accentText, fontWeight: "800", fontSize: 22 }}>{(user?.username || "U").slice(0, 1).toUpperCase()}</Text>}
          <View style={pageStyles.cameraBadge}><Ionicons name="camera" size={12} color="#FFFFFF" /></View>
        </Pressable>
        <View style={{ flex: 1 }}><Text style={[pageStyles.identityName, { color: colors.text }]}>{user?.username || "Your account"}</Text><Text style={[pageStyles.identityMeta, { color: colors.textMuted }]}>{user?.is_artist ? (t("artistAccount") || "Artist account") : (t("customerAccount") || "Customer account")}</Text></View>
      </View>
      <Pressable onPress={() => void chooseProfilePhoto()}><Text style={[pageStyles.changePhotoLink, { color: colors.accent }]}>{t("changeProfilePhoto") || "Change profile photo"}</Text></Pressable>

      <Text style={[pageStyles.sectionTitle, { color: colors.text }]}>{t("personalInformation") || "Personal information"}</Text>
      {profileSuccess ? <View style={pageStyles.successMessage}>
        <Ionicons name="checkmark-circle" size={20} color="#1F7A45" />
        <Text style={pageStyles.successText}>{profileSuccess}</Text>
      </View> : null}
      <TextInput style={[pageStyles.field, { color: colors.text, borderColor: colors.border }]} value={username} onChangeText={setUsername} placeholder={t("username") || "Username"} placeholderTextColor={colors.textMuted} autoCapitalize="none" />
      <TextInput style={[pageStyles.field, { color: colors.text, borderColor: colors.border }]} value={email} onChangeText={setEmail} placeholder={t("emailAddress") || "Email address"} placeholderTextColor={colors.textMuted} autoCapitalize="none" keyboardType="email-address" />
      <TextInput style={[pageStyles.field, { color: colors.text, borderColor: colors.border }]} value={phoneNumber} onChangeText={setPhoneNumber} placeholder={t("phoneNumber") || "Phone number"} placeholderTextColor={colors.textMuted} keyboardType="phone-pad" />
      <Pressable style={[pageStyles.primaryButton, { backgroundColor: colors.accent }]} onPress={saveProfile} disabled={savingProfile}><Text style={{ color: colors.accentText, fontWeight: "700" }}>{savingProfile ? (t("saving") || "Saving...") : (t("saveProfile") || "Save profile")}</Text></Pressable>

      {user?.is_artist ? <><Text style={[pageStyles.sectionTitle, { color: colors.text }]}>{t("artistProfile") || "Artist profile"}</Text><LinkRow icon="brush-outline" label={t("storefrontAndBio") || "Storefront and artist bio"} detail={t("brandNameBioPhoto") || "Brand name, bio, and profile photo"} onPress={() => router.push("/edit-artist-profile")} colors={colors} /><LinkRow icon="stats-chart-outline" label={t("artistAnalytics") || "Artist analytics"} detail={t("viewsPerformance") || "Views and storefront performance"} onPress={() => router.push("/artist-analytics")} colors={colors} /></> : null}

      <Text style={[pageStyles.sectionTitle, { color: colors.text }]}>{t("accountActivity") || "Account activity"}</Text>
      <LinkRow icon="bag-handle-outline" label={t("myOrders")} onPress={() => router.push("/my-orders")} colors={colors} />
      <LinkRow icon="heart-outline" label={t("savedArtworks")} onPress={() => router.push("/(tabs)/favorites")} colors={colors} />
      <LinkRow icon="color-palette-outline" label={t("artworkRequests") || "Artwork requests"} onPress={() => router.push("/my-commissions")} colors={colors} />
      {user?.is_artist ? <LinkRow icon="images-outline" label={t("myArtworks")} onPress={() => router.push("/my-products")} colors={colors} /> : null}

      <Text style={[pageStyles.sectionTitle, { color: colors.text }]}>{t("appearanceAndLanguage") || "Appearance and language"}</Text>
      <View style={pageStyles.chips}>{(["light", "dark"] as const).map(value => <Pressable key={value} style={[pageStyles.chip, { borderColor: colors.border }, mode === value && { backgroundColor: colors.accent, borderColor: colors.accent }]} onPress={() => setMode(value)}><Text style={{ color: mode === value ? colors.accentText : colors.text }}>{value === "light" ? (t("light") || "Light") : (t("dark") || "Dark")}</Text></Pressable>)}</View>
      <View style={pageStyles.chips}>{LANGUAGES.map(item => <Pressable key={item.code} style={[pageStyles.chip, { borderColor: colors.border }, language === item.code && { backgroundColor: colors.accent, borderColor: colors.accent }]} onPress={() => setLanguage(item.code as LanguageCode)}><Text style={{ color: language === item.code ? colors.accentText : colors.text }}>{item.flag} {item.label}</Text></Pressable>)}</View>

      <Text style={[pageStyles.sectionTitle, { color: colors.text }]}>{t("security") || "Security"}</Text>
      <LinkRow icon="ban-outline" label="Blocked conversations" detail="Review or unblock people you blocked" onPress={() => router.push("/blocked-conversations")} colors={colors} />
      <TextInput style={[pageStyles.field, { color: colors.text, borderColor: colors.border }]} value={oldPassword} onChangeText={setOldPassword} placeholder={t("currentPassword") || "Current password"} placeholderTextColor={colors.textMuted} secureTextEntry />
      <TextInput style={[pageStyles.field, { color: colors.text, borderColor: colors.border }]} value={newPassword} onChangeText={setNewPassword} placeholder={t("newPassword") || "New password (at least 6 characters)"} placeholderTextColor={colors.textMuted} secureTextEntry />
      <Pressable style={[pageStyles.secondaryButton, { borderColor: colors.border }]} onPress={savePassword} disabled={savingPassword}><Text style={{ color: colors.text, fontWeight: "700" }}>{savingPassword ? (t("updating") || "Updating...") : (t("changePassword") || "Change password")}</Text></Pressable>

      <Text style={[pageStyles.sectionTitle, { color: colors.text }]}>{t("supportAndLegal") || "Support and legal"}</Text>
      <LinkRow icon="document-text-outline" label={t("terms")} onPress={() => router.push("/terms")} colors={colors} />
      <LinkRow icon="log-out-outline" label={t("logout")} detail={t("signInAgain") || "You can sign in again at any time"} onPress={() => void logout()} colors={colors} danger />
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  linkRow: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 10, padding: 13, marginBottom: 9, gap: 12 }, linkText: { flex: 1 }, linkLabel: { fontSize: 14, fontWeight: "600" }, linkDetail: { fontSize: 12, marginTop: 2 },
});
function createStyles(colors: any, layout: ReturnType<typeof useResponsiveLayout>) { return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background }, content: { width: "100%", maxWidth: layout.formWidth, alignSelf: "center", padding: layout.horizontalPadding, paddingBottom: 42 }, identityCard: { borderWidth: 1, borderRadius: 12, padding: 16, flexDirection: "row", alignItems: "center", gap: 13, marginTop: 6 }, avatar: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", overflow: "visible" }, avatarImage: { width: 56, height: 56, borderRadius: 28 }, cameraBadge: { position: "absolute", right: -2, bottom: -2, width: 22, height: 22, borderRadius: 11, backgroundColor: "#1F7A45", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#FFFFFF" }, changePhotoLink: { fontSize: 13, fontWeight: "700", marginTop: 9 }, identityName: { fontWeight: "800", fontSize: 16 }, identityMeta: { marginTop: 3, fontSize: 12 }, sectionTitle: { fontSize: 16, fontWeight: "700", marginTop: 26, marginBottom: 10 }, successMessage: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#DCFCE7", borderColor: "#86EFAC", borderWidth: 1, borderRadius: 9, padding: 12, marginBottom: 10 }, successText: { color: "#166534", fontSize: 13, fontWeight: "700", flex: 1 }, field: { borderWidth: 1, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 12, fontSize: 14, marginBottom: 10 }, primaryButton: { borderRadius: 9, alignItems: "center", padding: 13, marginTop: 1 }, secondaryButton: { borderWidth: 1, borderRadius: 9, alignItems: "center", padding: 13, marginTop: 1 }, chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 }, chip: { borderWidth: 1, borderRadius: 20, paddingVertical: 9, paddingHorizontal: 13 },
}); }
