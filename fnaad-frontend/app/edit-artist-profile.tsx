import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Image from "../components/MediaImage";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import {
  deleteStudioPhoto,
  getMyArtistProfile,
  getMyStudioPhotos,
  resolveMediaUrl,
  updateMyArtistProfile,
  uploadStudioMedia,
  unwrapList,
} from "../services/api";
import { useTheme } from "../context/ThemeContext";
import ScreenHeader from "../components/ScreenHeader";

type StudioMedia = {
  id: number;
  image: string | null;
  video: string | null;
  media_type: "image" | "video";
  duration_seconds: number | null;
  caption: string;
};
type StudioMediaAsset = Pick<ImagePicker.ImagePickerAsset, "uri" | "fileName" | "mimeType" | "file" | "duration"> & {
  type: "image" | "video";
};

export default function EditArtistProfileScreen() {
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
  const [studioPhotos, setStudioPhotos] = useState<StudioMedia[]>([]);
  const [studioMedia, setStudioMedia] = useState<StudioMediaAsset | null>(null);
  const [studioCaption, setStudioCaption] = useState("");
  const [studioLoading, setStudioLoading] = useState(true);
  const [studioSaving, setStudioSaving] = useState(false);
  const [deletingStudioPhotoId, setDeletingStudioPhotoId] = useState<number | null>(null);

  useEffect(() => { getMyArtistProfile().then(({ data }) => {
    setBrandName(data.brand_name || ""); setPractice(data.artistic_practice || ""); setBio(data.bio || "");
    setInstagram(data.instagram_handle || ""); setPortfolioUrl(data.portfolio_url || ""); setRegion(data.region_display || data.region || ""); setCurrentAvatar(data.avatar || null); setNationalId(data.national_id_number || "");
  }).catch(() => Alert.alert("Unable to load profile", "Please try again.")).finally(() => setLoading(false)); }, []);

  useEffect(() => {
    getMyStudioPhotos()
      .then(({ data }) => setStudioPhotos(unwrapList<StudioMedia>(data)))
      .catch(() => Alert.alert("Unable to load Studio media", "Please try again."))
      .finally(() => setStudioLoading(false));
  }, []);

  const pickAvatar = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return Alert.alert("Photo permission needed", "Allow photo access to choose your storefront photo.");
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.75 });
    if (!result.canceled) setNewAvatar(result.assets[0]);
  };

  const pickStudioPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Photo permission needed", "Allow photo access to add a studio photo.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled) setStudioMedia({ ...result.assets[0], type: "image" });
  };

  const pickStudioVideo = async () => {
    if (studioPhotos.filter((media) => media.media_type === "video").length >= 3) {
      Alert.alert("Video limit reached", "You can add up to three Studio videos.");
      return;
    }
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Media permission needed", "Allow media access to add a Studio video.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["videos"],
      videoMaxDuration: 180,
      quality: 0.8,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (asset.duration != null && asset.duration > 180_000) {
      Alert.alert("Video is too long", "Studio videos must be three minutes or shorter.");
      return;
    }
    setStudioMedia({ ...asset, type: "video" });
  };

  const saveStudioMedia = async () => {
    if (!studioMedia) {
      Alert.alert("Choose media", "Select a studio photo or video first.");
      return;
    }
    setStudioSaving(true);
    try {
      const { data } = await uploadStudioMedia(studioMedia, studioCaption.trim());
      setStudioPhotos((current) => [data, ...current]);
      setStudioMedia(null);
      setStudioCaption("");
    } catch (error: any) {
      const message = error?.response?.data?.video?.[0]
        || error?.response?.data?.detail
        || "Please try again.";
      Alert.alert("Could not add Studio media", message);
    } finally {
      setStudioSaving(false);
    }
  };

  const removeStudioPhoto = (photo: StudioMedia) => {
    const remove = () => {
      setDeletingStudioPhotoId(photo.id);
      deleteStudioPhoto(photo.id)
        .then(() => setStudioPhotos((current) => current.filter((item) => item.id !== photo.id)))
        .catch((error: any) => Alert.alert("Could not remove Studio media", error?.response?.data?.detail || "Please try again."))
        .finally(() => setDeletingStudioPhotoId(null));
    };
    const mediaName = photo.media_type === "video" ? "video" : "photo";
    const confirmation = `This ${mediaName} will no longer appear on your public profile.`;
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.confirm(`Remove Studio ${mediaName}? ${confirmation}`)) remove();
      return;
    }
    Alert.alert(`Remove Studio ${mediaName}?`, confirmation, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: remove,
      },
    ]);
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
      <Text style={styles.section}>Your studio</Text>
      <Text style={styles.hint}>Share your creative space with photos and up to three videos, each no longer than three minutes.</Text>
      <View style={styles.studioPickerRow}>
        <Pressable style={styles.studioPicker} onPress={() => void pickStudioPhoto()}>
          {studioMedia?.type === "image" ? <Image source={{ uri: studioMedia.uri }} style={styles.studioPreview} /> : <Ionicons name="camera-outline" size={26} color={colors.accent} />}
          <Text style={styles.studioPickerText}>{studioMedia?.type === "image" ? "Change selected photo" : "Choose a photo"}</Text>
        </Pressable>
        <Pressable
          style={[styles.studioPicker, studioPhotos.filter((media) => media.media_type === "video").length >= 3 && styles.studioPickerDisabled]}
          onPress={() => void pickStudioVideo()}
          disabled={studioPhotos.filter((media) => media.media_type === "video").length >= 3}
        >
          <Ionicons name={studioMedia?.type === "video" ? "videocam" : "videocam-outline"} size={26} color={colors.accent} />
          <Text style={styles.studioPickerText}>
            {studioMedia?.type === "video" ? "Change selected video" : `Choose a video (${studioPhotos.filter((media) => media.media_type === "video").length}/3)`}
          </Text>
        </Pressable>
      </View>
      {studioMedia ? (
        <View>
          <Text style={styles.hint}>
            {studioMedia.type === "video"
              ? `Selected video${studioMedia.duration != null ? ` · ${Math.ceil(studioMedia.duration / 1000)} sec` : ""}`
              : "Selected studio photo"}
          </Text>
          <TextInput
            style={styles.field}
            value={studioCaption}
            onChangeText={setStudioCaption}
            placeholder="Caption (optional)"
            placeholderTextColor={colors.textMuted}
            maxLength={160}
          />
          <Pressable style={[styles.studioAddButton, studioSaving && { opacity: 0.65 }]} onPress={() => void saveStudioMedia()} disabled={studioSaving}>
            <Text style={styles.studioAddText}>{studioSaving ? "Adding..." : "Add to Studio"}</Text>
          </Pressable>
        </View>
      ) : null}
      <View style={styles.studioList}>
        {studioLoading ? <ActivityIndicator color={colors.accent} /> : studioPhotos.length ? studioPhotos.map((photo) => (
          <View key={photo.id} style={styles.studioPhotoCard}>
            {photo.media_type === "video" && photo.video
              ? <View style={[styles.studioPhotoImage, styles.studioVideoPlaceholder]}><Ionicons name="videocam" size={26} color={colors.accent} /></View>
              : photo.image ? <Image source={{ uri: resolveMediaUrl(photo.image)! }} style={styles.studioPhotoImage} /> : null}
            <View style={styles.studioPhotoDetails}>
              <Text style={styles.studioPhotoCaption} numberOfLines={2}>
                {photo.caption || (photo.media_type === "video" ? `Studio video${photo.duration_seconds != null ? ` · ${photo.duration_seconds}s` : ""}` : "Studio photo")}
              </Text>
              <Pressable onPress={() => removeStudioPhoto(photo)} disabled={deletingStudioPhotoId === photo.id} accessibilityRole="button" accessibilityLabel={`Remove studio ${photo.media_type}`}>
                {deletingStudioPhotoId === photo.id ? <ActivityIndicator size="small" color={colors.accent} /> : <Ionicons name="trash-outline" size={19} color="#B42318" />}
              </Pressable>
            </View>
          </View>
        )) : <Text style={styles.studioEmpty}>No studio media yet. Add a photo or video to share your creative space.</Text>}
      </View>
      <Pressable style={[styles.saveButton, saving && { opacity: 0.65 }]} onPress={save} disabled={saving}><Text style={styles.saveText}>{saving ? "Saving..." : "Save storefront"}</Text></Pressable>
    </ScrollView>
  </View>;
}

function createStyles(colors: any) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: 20, paddingBottom: 42, maxWidth: 680, width: "100%", alignSelf: "center" },
    intro: { color: colors.textMuted, fontSize: 13, lineHeight: 19, marginBottom: 18 },
    previewCard: { borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 15, flexDirection: "row", gap: 14, alignItems: "center" },
    avatar: { width: 70, height: 70, borderRadius: 35, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
    avatarImage: { width: 70, height: 70, borderRadius: 35 },
    camera: { position: "absolute", right: -1, bottom: -1, backgroundColor: colors.accent, width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: colors.background },
    previewName: { color: colors.text, fontSize: 16, fontWeight: "800" },
    previewMeta: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
    photoLink: { color: colors.accent, fontSize: 12, fontWeight: "700", marginTop: 8 },
    success: { flexDirection: "row", gap: 8, alignItems: "center", backgroundColor: "#DCFCE7", borderWidth: 1, borderColor: "#86EFAC", borderRadius: 9, padding: 12, marginTop: 18 },
    successText: { color: "#166534", fontSize: 13, fontWeight: "700", flex: 1 },
    section: { color: colors.text, fontSize: 16, fontWeight: "800", marginTop: 26, marginBottom: 8 },
    label: { color: colors.text, fontSize: 13, fontWeight: "700", marginBottom: 7 },
    hint: { color: colors.textMuted, fontSize: 12, lineHeight: 18, marginBottom: 12 },
    field: { borderWidth: 1, borderColor: colors.border, borderRadius: 9, padding: 12, color: colors.text, fontSize: 14, marginBottom: 14 },
    bio: { minHeight: 135 },
    count: { color: colors.textMuted, fontSize: 11, textAlign: "right", marginTop: -9 },
    studioPicker: { flex: 1, borderWidth: 1, borderStyle: "dashed", borderColor: colors.border, borderRadius: 12, minHeight: 92, padding: 12, marginBottom: 10, alignItems: "center", justifyContent: "center", gap: 8 },
    studioPickerRow: { flexDirection: "row", gap: 10 },
    studioPickerDisabled: { opacity: 0.5 },
    studioPreview: { width: 76, height: 76, borderRadius: 9 },
    studioPickerText: { color: colors.accent, fontSize: 13, fontWeight: "700" },
    studioAddButton: { backgroundColor: colors.accent, padding: 12, borderRadius: 9, alignItems: "center", marginBottom: 14 },
    studioAddText: { color: colors.accentText, fontSize: 13, fontWeight: "800" },
    studioList: { gap: 10, marginTop: 6 },
    studioPhotoCard: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 11, padding: 9 },
    studioPhotoImage: { width: 72, height: 72, borderRadius: 8, backgroundColor: colors.border },
    studioVideoPlaceholder: { alignItems: "center", justifyContent: "center" },
    studioPhotoDetails: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
    studioPhotoCaption: { flex: 1, color: colors.text, fontSize: 13 },
    studioEmpty: { color: colors.textMuted, fontSize: 12, lineHeight: 18, paddingVertical: 8 },
    saveButton: { backgroundColor: colors.accent, padding: 14, borderRadius: 9, alignItems: "center", marginTop: 24 },
    saveText: { color: colors.accentText, fontSize: 14, fontWeight: "800" },
  });
}
