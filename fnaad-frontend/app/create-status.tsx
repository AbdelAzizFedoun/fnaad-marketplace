import React, { useState } from "react";
import { ActivityIndicator, Alert, Image as NativeImage, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useVideoPlayer, VideoView } from "expo-video";
import ScreenHeader from "../components/ScreenHeader";
import { deleteStudioPhoto, getMyStudioPhotos, uploadStudioMedia, unwrapList } from "../services/api";
import { useTheme } from "../context/ThemeContext";

type SelectedMedia = { uri: string; fileName?: string | null; mimeType?: string | null; file?: File | null; type: "image" | "video" };
type ActiveStatus = { id: number; image: string | null; video: string | null; media_type: "image" | "video" | "text"; caption: string; created_at: string };

function VideoStatusPreview({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri);
  return <VideoView player={player} style={styles.previewImage} nativeControls contentFit="cover" />;
}

export default function CreateStatusScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [media, setMedia] = useState<SelectedMedia | null>(null);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState(0);
  const [activeStatuses, setActiveStatuses] = useState<ActiveStatus[]>([]);
  const [publishError, setPublishError] = useState("");

  React.useEffect(() => { getMyStudioPhotos().then(({ data }) => setActiveStatuses(unwrapList<ActiveStatus>(data).filter((item) => Date.now() - new Date(item.created_at).getTime() < 24 * 60 * 60 * 1000))).catch(() => undefined); }, []);

  const pick = async (type: "image" | "video") => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return Alert.alert("Permission needed", "Allow access to your photos and videos to create a status.");
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: type === "video" ? ["videos"] : ["images"], allowsEditing: type === "image", quality: 0.85, videoMaxDuration: 180 });
    if (!result.canceled) {
      const asset = result.assets[0];
      if (type === "video" && asset.duration != null && asset.duration > 180_000) return Alert.alert("Video too long", "Status videos must be 180 seconds or shorter.");
      setMedia({ uri: asset.uri, fileName: asset.fileName, mimeType: asset.mimeType, file: asset.file, type });
    }
  };

  const publish = async () => {
    if (!media && !message.trim()) return Alert.alert("Add something first", "Choose a photo/video or write a status message.");
    setSaving(true);
    setPublishError("");
    try {
      const { data } = await uploadStudioMedia(media || { uri: "", type: "text" }, message.trim(), setProgress);
      setActiveStatuses((current) => [data, ...current]);
      Alert.alert("Status published", "Your status is now visible for 24 hours.", [{ text: "Done", onPress: () => router.back() }]);
    } catch (error: any) {
      setPublishError(error?.response?.data?.detail || error?.response?.data?.caption?.[0] || error?.response?.data?.video?.[0] || "Could not publish status. Please try again.");
    } finally { setSaving(false); setProgress(0); }
  };

  return <View style={[styles.container, { backgroundColor: colors.background }]}>
    <ScreenHeader title="Create status" />
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={[styles.heading, { color: colors.text }]}>Share with your audience</Text>
      <Text style={[styles.subheading, { color: colors.textMuted }]}>Create a photo, video, or text status. It will appear in your Studio stories for 24 hours.</Text>
      <View style={styles.choices}>
        <Pressable style={[styles.choice, { borderColor: colors.border }]} onPress={() => void pick("image")}><Ionicons name="image-outline" size={25} color={colors.accent} /><Text style={[styles.choiceText, { color: colors.text }]}>Photo</Text></Pressable>
        <Pressable style={[styles.choice, { borderColor: colors.border }]} onPress={() => void pick("video")}><Ionicons name="videocam-outline" size={25} color={colors.accent} /><Text style={[styles.choiceText, { color: colors.text }]}>Video</Text></Pressable>
        <Pressable style={[styles.choice, { borderColor: colors.border }]} onPress={() => setMedia(null)}><Ionicons name="text-outline" size={25} color={colors.accent} /><Text style={[styles.choiceText, { color: colors.text }]}>Text</Text></Pressable>
      </View>
      {media ? <View style={styles.preview}>{media.type === "video" ? <VideoStatusPreview uri={media.uri} /> : <NativeImage source={{ uri: media.uri }} style={styles.previewImage} resizeMode="cover" />}<View style={styles.previewBadge}><Ionicons name={media.type === "video" ? "videocam" : "image"} size={14} color="#FFF" /><Text style={styles.previewBadgeText}>{media.type === "video" ? "Video selected" : "Photo selected"}</Text></View><Pressable style={styles.remove} onPress={() => setMedia(null)}><Ionicons name="close" size={18} color="#FFF" /></Pressable></View> : <View style={[styles.textPreview, { backgroundColor: colors.surface, borderColor: colors.border }]}><Ionicons name="chatbubble-ellipses-outline" size={30} color={colors.accent} /><Text style={[styles.textPreviewLabel, { color: colors.textMuted }]}>Write a text status below</Text></View>}
      <TextInput style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]} value={message} onChangeText={setMessage} placeholder="Write a caption or status message…" placeholderTextColor={colors.textMuted} multiline maxLength={160} />
      <Text style={[styles.counter, { color: colors.textMuted }]}>{message.length}/160</Text>
      <Pressable style={[styles.publish, { backgroundColor: colors.accent }]} onPress={() => void publish()} disabled={saving}><Text style={{ color: colors.accentText, fontWeight: "800" }}>{saving ? "Publishing…" : "Publish status"}</Text>{saving ? <ActivityIndicator color={colors.accentText} /> : <Ionicons name="send" size={17} color={colors.accentText} />}</Pressable>
      {saving ? <Text style={[styles.uploadProgress, { color: colors.textMuted }]}>Uploading… {progress}%</Text> : null}
      {publishError ? <Text accessibilityRole="alert" style={styles.publishError}>{publishError}</Text> : null}
      <Text style={[styles.activeHeading, { color: colors.text }]}>Active statuses</Text>
      {activeStatuses.length ? activeStatuses.map((status) => <View key={status.id} style={[styles.activeRow, { borderColor: colors.border, backgroundColor: colors.surface }]}><View style={{ flex: 1 }}><Text style={[styles.activeTitle, { color: colors.text }]}>{status.media_type === "video" ? "Video status" : status.media_type === "image" ? "Photo status" : "Text status"}</Text><Text style={[styles.activeMeta, { color: colors.textMuted }]}>Expires in {Math.max(0, 24 - Math.floor((Date.now() - new Date(status.created_at).getTime()) / 3600000))}h</Text></View><Pressable onPress={() => { deleteStudioPhoto(status.id).then(() => setActiveStatuses((current) => current.filter((item) => item.id !== status.id))).catch(() => Alert.alert("Could not delete status", "Please try again.")); }}><Ionicons name="trash-outline" size={20} color="#B0524F" /></Pressable></View>) : <Text style={[styles.activeEmpty, { color: colors.textMuted }]}>Your published statuses will appear here.</Text>}
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({ container: { flex: 1 }, content: { maxWidth: 620, width: "100%", alignSelf: "center", padding: 18, paddingBottom: 40 }, heading: { fontSize: 23, fontWeight: "800", marginTop: 10 }, subheading: { fontSize: 13, lineHeight: 19, marginTop: 7, marginBottom: 20 }, choices: { flexDirection: "row", gap: 9, marginBottom: 16 }, choice: { flex: 1, minHeight: 82, borderWidth: 1, borderRadius: 14, alignItems: "center", justifyContent: "center", gap: 6 }, choiceText: { fontSize: 12, fontWeight: "700" }, preview: { height: 300, borderRadius: 18, overflow: "hidden", position: "relative", backgroundColor: "#111" }, previewImage: { width: "100%", height: "100%" }, previewBadge: { position: "absolute", left: 12, bottom: 12, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 16, backgroundColor: "rgba(0,0,0,.65)" }, previewBadgeText: { color: "#FFF", fontSize: 11, fontWeight: "700" }, remove: { position: "absolute", top: 10, right: 10, width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,.65)" }, textPreview: { height: 130, borderWidth: 1, borderRadius: 18, alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 14 }, textPreviewLabel: { fontSize: 13 }, input: { minHeight: 105, borderWidth: 1, borderRadius: 14, padding: 13, textAlignVertical: "top", fontSize: 14 }, counter: { textAlign: "right", fontSize: 11, marginTop: 5 }, publish: { marginTop: 18, minHeight: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 9 }, uploadProgress: { textAlign: "center", marginTop: 8, fontSize: 12 }, publishError: { color: "#B0524F", fontSize: 13, marginTop: 10 }, activeHeading: { fontSize: 18, fontWeight: "800", marginTop: 32, marginBottom: 10 }, activeRow: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 14, padding: 13, marginBottom: 8 }, activeTitle: { fontSize: 13, fontWeight: "700" }, activeMeta: { fontSize: 11, marginTop: 3 }, activeEmpty: { fontSize: 12 } });
