import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Image from "../components/MediaImage";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import {
  deleteStudioPhoto,
  getMyArtistProfile,
  getMyStudioPhotos,
  getMyStudioStoryAnalytics,
  resolveMediaUrl,
  updateMyArtistProfile,
  uploadStudioMedia,
  unwrapList,
} from "../services/api";
import { useTheme } from "../context/ThemeContext";
import { useLanguage } from "../context/LanguageContext";
import ScreenHeader from "../components/ScreenHeader";

type StudioMedia = {
  id: number;
  image: string | null;
  video: string | null;
  media_type: "image" | "video";
  duration_seconds: number | null;
  caption: string;
  created_at: string;
};
type StoryAnalytics = {
  id: number;
  image: string | null;
  video: string | null;
  media_type: "image" | "video";
  duration_seconds: number | null;
  caption: string;
  created_at: string;
  views_count: number;
  like_count: number;
  comments_count: number;
};
type StoryAnalyticsSummary = {
  views_count: number;
  like_count: number;
  comments_count: number;
  stories: StoryAnalytics[];
};
type StudioMediaAsset = Pick<ImagePicker.ImagePickerAsset, "uri" | "fileName" | "mimeType" | "file" | "duration"> & {
  type: "image" | "video";
};

export default function EditArtistProfileScreen() {
  const { colors } = useTheme();
  const { t } = useLanguage();
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
  const [storyAnalytics, setStoryAnalytics] = useState<StoryAnalyticsSummary | null>(null);
  const [storyAnalyticsLoading, setStoryAnalyticsLoading] = useState(true);
  const [storyAnalyticsError, setStoryAnalyticsError] = useState("");

  const refreshStoryAnalytics = () => {
    setStoryAnalyticsLoading(true);
    getMyStudioStoryAnalytics()
      .then(({ data }) => {
        setStoryAnalytics(data);
        setStoryAnalyticsError("");
      })
      .catch((error) => {
        setStoryAnalyticsError(error?.response?.data?.detail || t("genericError"));
      })
      .finally(() => setStoryAnalyticsLoading(false));
  };

  useEffect(() => {
    getMyArtistProfile()
      .then(({ data }) => {
        setBrandName(data.brand_name || "");
        setPractice(data.artistic_practice || "");
        setBio(data.bio || "");
        setInstagram(data.instagram_handle || "");
        setPortfolioUrl(data.portfolio_url || "");
        setRegion(data.region_display || data.region || "");
        setCurrentAvatar(data.avatar || null);
        setNationalId(data.national_id_number || "");
      })
      .catch(() => Alert.alert(t("genericError"), t("reviewDetailsHint")))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    getMyStudioPhotos()
      .then(({ data }) => setStudioPhotos(unwrapList<StudioMedia>(data)))
      .catch(() => Alert.alert(t("couldNotAddStudioMedia"), t("reviewDetailsHint")))
      .finally(() => setStudioLoading(false));
  }, []);

  useEffect(() => {
    refreshStoryAnalytics();
  }, []);

  const pickAvatar = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return Alert.alert(t("photoPermissionNeeded"), t("photoPermissionStorefrontHint"));
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.75 });
    if (!result.canceled) setNewAvatar(result.assets[0]);
  };

  const pickStudioPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t("photoPermissionNeeded"), t("photoPermissionStudioHint"));
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
      Alert.alert(t("videoLimitReached"), t("videoLimitHint"));
      return;
    }
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t("mediaPermissionNeeded"), t("mediaPermissionStudioVideoHint"));
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
      Alert.alert(t("videoTooLong"), t("videoTooLongHint"));
      return;
    }
    setStudioMedia({ ...asset, type: "video" });
  };

  const saveStudioMedia = async () => {
    if (!studioMedia) {
      Alert.alert(t("chooseMediaFirst"), t("chooseMediaFirstHint"));
      return;
    }
    setStudioSaving(true);
    try {
      const { data } = await uploadStudioMedia(studioMedia, studioCaption.trim());
      setStudioPhotos((current) => [data, ...current]);
      refreshStoryAnalytics();
      setStudioMedia(null);
      setStudioCaption("");
    } catch (error: any) {
      const message = error?.response?.data?.video?.[0]
        || error?.response?.data?.detail
        || t("reviewDetailsHint");
      Alert.alert(t("couldNotAddStudioMedia"), message);
    } finally {
      setStudioSaving(false);
    }
  };

  const removeStudioPhoto = (photo: StudioMedia) => {
    const remove = () => {
      setDeletingStudioPhotoId(photo.id);
      deleteStudioPhoto(photo.id)
        .then(() => {
          setStudioPhotos((current) => current.filter((item) => item.id !== photo.id));
          refreshStoryAnalytics();
        })
        .catch((error: any) => Alert.alert(t("couldNotRemoveStudioMedia"), error?.response?.data?.detail || t("reviewDetailsHint")))
        .finally(() => setDeletingStudioPhotoId(null));
    };
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.confirm(`${t("removeStudioMediaTitle")} ${t("removeStudioMediaConfirm")}`)) remove();
      return;
    }
    Alert.alert(t("removeStudioMediaTitle"), t("removeStudioMediaConfirm"), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("remove"),
        style: "destructive",
        onPress: remove,
      },
    ]);
  };

  const save = async () => {
    if (!brandName.trim()) return Alert.alert(t("storefrontNameRequired"), t("storefrontNameRequiredHint"));
    if (portfolioUrl.trim() && !/^https?:\/\//i.test(portfolioUrl.trim())) return Alert.alert(t("portfolioLinkInvalid"), t("portfolioLinkInvalidHint"));
    setSaving(true);
    try {
      await updateMyArtistProfile({ brand_name: brandName.trim(), artistic_practice: practice.trim(), bio: bio.trim(), instagram_handle: instagram.trim().replace(/^@/, ""), portfolio_url: portfolioUrl.trim(), avatarUri: newAvatar?.uri || null, national_id_number: nationalId.trim() });
      setNewAvatar(null);
      setSuccess(t("storefrontUpdatedSuccess"));
      setTimeout(() => setSuccess(""), 4500);
    } catch (error: any) {
      Alert.alert(t("couldNotSaveStorefront"), error?.response?.data?.detail || t("reviewDetailsHint"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <View style={styles.container}><ScreenHeader title={t("storefrontAndBioTitle")} /><ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} /></View>;
  const avatarUri = newAvatar?.uri || resolveMediaUrl(currentAvatar || undefined);
  return (
    <View style={styles.container}>
      <ScreenHeader title={t("storefrontAndBioTitle")} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
        <Text style={styles.intro}>{t("storefrontIntro")}</Text>
        <View style={styles.previewCard}>
          <Pressable style={styles.avatar} onPress={() => void pickAvatar()}>
            {avatarUri ? <Image source={{ uri: avatarUri }} style={styles.avatarImage} /> : <Ionicons name="image-outline" size={28} color={colors.textMuted} />}
            <View style={styles.camera}><Ionicons name="camera" size={13} color="#fff" /></View>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.previewName}>{brandName || t("yourStudioName")}</Text>
            <Text style={styles.previewMeta}>{practice || t("yourArtisticPractice")}{region ? ` · ${region}` : ""}</Text>
            <Pressable onPress={() => void pickAvatar()}><Text style={styles.photoLink}>{t("changeStorefrontPhoto")}</Text></Pressable>
          </View>
        </View>
        {success ? <View style={styles.success}><Ionicons name="checkmark-circle" size={20} color="#1F7A45" /><Text style={styles.successText}>{success}</Text></View> : null}

        <Text style={styles.section}>{t("yourIdentity")}</Text>
        <Text style={styles.label}>{t("storefrontNameLabel")}</Text>
        <TextInput style={styles.field} value={brandName} onChangeText={setBrandName} placeholder={t("storefrontNamePlaceholder")} placeholderTextColor={colors.textMuted} maxLength={120} />

        <Text style={styles.label}>{t("artisticPracticeLabel")}</Text>
        <TextInput style={styles.field} value={practice} onChangeText={setPractice} placeholder={t("artisticPracticePlaceholder")} placeholderTextColor={colors.textMuted} maxLength={120} />

        <Text style={styles.label}>{t("nationalIdLabel")}</Text>
        <TextInput style={styles.field} value={nationalId} onChangeText={setNationalId} placeholder={t("nationalIdPlaceholder")} placeholderTextColor={colors.textMuted} maxLength={20} keyboardType="number-pad" />

        <Text style={styles.section}>{t("artistStatementLabel")}</Text>
        <Text style={styles.hint}>{t("artistStatementHint")}</Text>
        <TextInput style={[styles.field, styles.bio]} value={bio} onChangeText={setBio} placeholder={t("artistStatementPlaceholder")} placeholderTextColor={colors.textMuted} multiline maxLength={600} textAlignVertical="top" />
        <Text style={styles.count}>{bio.length}/600</Text>

        <Text style={styles.section}>{t("findMeOnline")}</Text>
        <Text style={styles.hint}>{t("findMeOnlineHint")}</Text>
        <Text style={styles.label}>{t("instagramLabel")}</Text>
        <TextInput style={styles.field} value={instagram} onChangeText={setInstagram} placeholder="yourhandle" placeholderTextColor={colors.textMuted} autoCapitalize="none" maxLength={60} />

        <Text style={styles.label}>{t("portfolioWebsiteLabel")}</Text>
        <TextInput style={styles.field} value={portfolioUrl} onChangeText={setPortfolioUrl} placeholder="https://yourportfolio.com" placeholderTextColor={colors.textMuted} autoCapitalize="none" keyboardType="url" />

        <Text style={styles.section}>{t("yourStudioSection")}</Text>
        <Text style={styles.hint}>{t("yourStudioHint")}</Text>

        <Text style={styles.section}>{t("storyAnalyticsTitle")}</Text>
        {storyAnalyticsLoading ? <ActivityIndicator color={colors.accent} /> : storyAnalyticsError ? (
          <View style={styles.analyticsError}>
            <Text style={styles.analyticsErrorText}>{storyAnalyticsError}</Text>
            <Pressable onPress={refreshStoryAnalytics}><Text style={styles.analyticsRetry}>{t("retry")}</Text></Pressable>
          </View>
        ) : (
          <View style={styles.analyticsCard}>
            <View style={styles.analyticsSummaryRow}>
              <View style={styles.analyticsMetric}><Text style={styles.analyticsValue}>{storyAnalytics?.views_count || 0}</Text><Text style={styles.analyticsLabel}>{t("storyViews")}</Text></View>
              <View style={styles.analyticsMetric}><Text style={styles.analyticsValue}>{storyAnalytics?.like_count || 0}</Text><Text style={styles.analyticsLabel}>{t("storyLikes")}</Text></View>
              <View style={styles.analyticsMetric}><Text style={styles.analyticsValue}>{storyAnalytics?.comments_count || 0}</Text><Text style={styles.analyticsLabel}>{t("storyComments")}</Text></View>
            </View>
            {storyAnalytics?.stories.map((story) => (
              <View key={story.id} style={styles.analyticsStoryRow}>
                <Text style={styles.analyticsStoryTitle} numberOfLines={1}>
                  {story.caption || (story.media_type === "video" ? t("selectedVideo") : t("selectedStudioPhoto"))}
                </Text>
                <Text style={styles.analyticsStoryCounts}>
                  {story.views_count} {t("storyViews").toLowerCase()} · {story.like_count} {t("storyLikes").toLowerCase()} · {story.comments_count} {t("storyComments").toLowerCase()}
                </Text>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.hint}>{t("studioPickerHint")}</Text>
        <View style={styles.studioPickerRow}>
          <Pressable style={styles.studioPicker} onPress={() => void pickStudioPhoto()}>
            {studioMedia?.type === "image" ? <Image source={{ uri: studioMedia.uri }} style={styles.studioPreview} /> : <Ionicons name="camera-outline" size={26} color={colors.accent} />}
            <Text style={styles.studioPickerText}>{studioMedia?.type === "image" ? t("changeSelectedPhoto") : t("chooseStudioPhoto")}</Text>
          </Pressable>
          <Pressable
            style={[styles.studioPicker, studioPhotos.filter((media) => media.media_type === "video").length >= 3 && styles.studioPickerDisabled]}
            onPress={() => void pickStudioVideo()}
            disabled={studioPhotos.filter((media) => media.media_type === "video").length >= 3}
          >
            <Ionicons name={studioMedia?.type === "video" ? "videocam" : "videocam-outline"} size={26} color={colors.accent} />
            <Text style={styles.studioPickerText}>
              {studioMedia?.type === "video" ? t("changeSelectedVideo") : `${t("chooseStudioVideo")} (${studioPhotos.filter((media) => media.media_type === "video").length}/3)`}
            </Text>
          </Pressable>
        </View>
        {studioMedia ? (
          <View>
            <Text style={styles.hint}>
              {studioMedia.type === "video"
                ? `${t("selectedVideo")}${studioMedia.duration != null ? ` · ${Math.ceil(studioMedia.duration / 1000)}s` : ""}`
                : t("selectedStudioPhoto")}
            </Text>
            <TextInput
              style={styles.field}
              value={studioCaption}
              onChangeText={setStudioCaption}
              placeholder={t("captionOptional")}
              placeholderTextColor={colors.textMuted}
              maxLength={160}
            />
            <Pressable style={[styles.studioAddButton, studioSaving && { opacity: 0.65 }]} onPress={() => void saveStudioMedia()} disabled={studioSaving}>
              <Text style={styles.studioAddText}>{studioSaving ? t("addingStudioMedia") : t("addToStudio")}</Text>
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
                  {photo.caption || (photo.media_type === "video" ? `${t("selectedVideo")}${photo.duration_seconds != null ? ` · ${photo.duration_seconds}s` : ""}` : t("selectedStudioPhoto"))}
                  {"\n"}
                  {Date.now() - new Date(photo.created_at).getTime() < 24 * 60 * 60 * 1000 ? t("storyExpiresHint") : t("permanentStudioArchive")}
                </Text>
                <Pressable onPress={() => removeStudioPhoto(photo)} disabled={deletingStudioPhotoId === photo.id} accessibilityRole="button" accessibilityLabel={t("remove")}>
                  {deletingStudioPhotoId === photo.id ? <ActivityIndicator size="small" color={colors.accent} /> : <Ionicons name="trash-outline" size={19} color="#B42318" />}
                </Pressable>
              </View>
            </View>
          )) : <Text style={styles.studioEmpty}>{t("noStudioMedia")}</Text>}
        </View>
        <Pressable style={[styles.saveButton, saving && { opacity: 0.65 }]} onPress={save} disabled={saving}><Text style={styles.saveText}>{saving ? t("savingStorefront") : t("saveStorefrontBtn")}</Text></Pressable>
      </ScrollView>
    </View>
  );
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
    studioPreview: { width: "100%", height: 70, borderRadius: 8 },
    studioPickerText: { color: colors.textMuted, fontSize: 12, fontWeight: "600", textAlign: "center" },
    studioAddButton: { backgroundColor: colors.accent, borderRadius: 8, padding: 12, alignItems: "center", marginTop: 6, marginBottom: 14 },
    studioAddText: { color: colors.accentText, fontWeight: "700", fontSize: 13 },
    studioList: { gap: 10, marginTop: 6 },
    studioPhotoCard: { flexDirection: "row", gap: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10, alignItems: "center" },
    studioPhotoImage: { width: 60, height: 60, borderRadius: 8 },
    studioVideoPlaceholder: { backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
    studioPhotoDetails: { flex: 1, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    studioPhotoCaption: { color: colors.text, fontSize: 12, flex: 1, marginRight: 8, lineHeight: 17 },
    studioEmpty: { color: colors.textMuted, fontSize: 12, fontStyle: "italic", textAlign: "center", paddingVertical: 14 },
    analyticsCard: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, backgroundColor: colors.surface, marginBottom: 14 },
    analyticsSummaryRow: { flexDirection: "row", justifyContent: "space-around", paddingBottom: 10 },
    analyticsMetric: { alignItems: "center", gap: 3 },
    analyticsValue: { color: colors.accent, fontSize: 20, fontWeight: "800" },
    analyticsLabel: { color: colors.textMuted, fontSize: 11 },
    analyticsStoryRow: { paddingVertical: 9, borderTopWidth: 1, borderTopColor: colors.border, gap: 3 },
    analyticsStoryTitle: { color: colors.text, fontSize: 12, fontWeight: "700" },
    analyticsStoryCounts: { color: colors.textMuted, fontSize: 11 },
    analyticsError: { padding: 14, alignItems: "center", gap: 8 },
    analyticsErrorText: { color: "#E7A0A0", fontSize: 12 },
    analyticsRetry: { color: colors.accent, fontWeight: "700", fontSize: 12 },
    saveButton: { backgroundColor: colors.accent, borderRadius: 12, padding: 16, alignItems: "center", marginTop: 24 },
    saveText: { color: colors.accentText, fontWeight: "800", fontSize: 15 },
  });
}
