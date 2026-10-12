import { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, ScrollView, Alert } from "react-native";
import Image from "../../components/MediaImage";
import { useRouter, useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { getProductDetail, updateProduct, uploadProductImage, deleteProductImage, resolveMediaUrl } from "../../services/api";
import { useLanguage } from "../../context/LanguageContext";
import { useTheme } from "../../context/ThemeContext";
import { useResponsiveLayout } from "../../hooks/useResponsiveLayout";
import ScreenHeader from "../../components/ScreenHeader";
import { shadow, RADIUS } from "../../components/shadow";
import { Ionicons } from "@expo/vector-icons";
import React from "react";

type ExistingImage = { id: number; image: string; is_primary: boolean };

const CATEGORIES = [
  { value: "painting", label: "Peinture" },
  { value: "drawing", label: "Dessin" },
  { value: "abstract", label: "Art abstrait" },
  { value: "sculpture", label: "Sculpture" },
  { value: "portrait", label: "Portrait" },
  { value: "home_design", label: "Home Design" },
  { value: "contemporary", label: "Contemporary Art" },
  { value: "calligraphy", label: "Calligraphy" },
  { value: "artisan_crafts", label: "Artisan Crafts" },
  { value: "hall_of_fame", label: "Hall of Fame" },
  { value: "other", label: "Autre" },
];

const MAX_TOTAL_IMAGES = 6;

export default function EditProductScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { t } = useLanguage();
  const { colors } = useTheme();
  const layout = useResponsiveLayout();
  const styles = createStyles(colors);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("other");
  const [existingImages, setExistingImages] = useState<ExistingImage[]>([]);
  const [newImageUris, setNewImageUris] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    getProductDetail(Number(id))
      .then((res) => {
        setTitle(res.data.title);
        setDescription(res.data.description);
        setPrice(String(res.data.price_xaf));
        setCategory(res.data.category || "other");
        setExistingImages(res.data.images || []);
      })
      .catch((err) => {
        console.log("Load product error:", err.response?.data || err.message);
        setErrorMsg(t("productNotFound"));
      })
      .finally(() => setLoading(false));
  }, [id]);

  const totalImageCount = existingImages.length + newImageUris.length;
  const hasExistingPrimary = existingImages.some((img) => img.is_primary);

  const pickImages = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setErrorMsg(t("photoPermissionDenied"));
      return;
    }

    const remainingSlots = MAX_TOTAL_IMAGES - totalImageCount;
    if (remainingSlots <= 0) {
      setErrorMsg(t("maxPhotosError").replace("{count}", String(MAX_TOTAL_IMAGES)));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
      allowsMultipleSelection: true,
      selectionLimit: remainingSlots,
    });

    if (!result.canceled) {
      const newUris = result.assets.map((a) => a.uri);
      setNewImageUris((prev) => [...prev, ...newUris].slice(0, remainingSlots + prev.length));
    }
  };

  const removeNewImage = (index: number) => {
    setNewImageUris((prev) => prev.filter((_, i) => i !== index));
  };

  const handleRemoveExistingImage = async (imageId: number) => {
    try {
      await deleteProductImage(imageId);
      setExistingImages((prev) => prev.filter((img) => img.id !== imageId));
    } catch (err: any) {
      console.log("Delete image error:", err.response?.data || err.message);
      setErrorMsg(t("deletePhotoError"));
    }
  };

  const handleSave = async () => {
    setErrorMsg("");
    const priceNumber = parseInt(price, 10);
    if (!title.trim() || isNaN(priceNumber) || priceNumber < 500) {
      setErrorMsg(t("priceValidation"));
      return;
    }

    setSaving(true);
    try {
      await updateProduct(Number(id), {
        title: title.trim(),
        description: description.trim(),
        price_xaf: priceNumber,
        category: category,
      });

      for (let i = 0; i < newImageUris.length; i++) {
        const order = existingImages.length + i;
        const isPrimary = !hasExistingPrimary && i === 0;
        try {
          await uploadProductImage(Number(id), { uri: newImageUris[i] }, order, isPrimary);
        } catch (imgErr: any) {
          console.log("Image upload error:", imgErr.response?.data || imgErr.message);
        }
      }

      router.push("/my-products");
    } catch (err: any) {
      console.log("Update product error:", err.response?.data || err.message);
      setErrorMsg(t("genericError"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ScreenHeader title={t("editArtworkTitle")} />
        <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title={t("editArtworkTitle")} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
        {errorMsg ? <Text style={styles.error}>{errorMsg}</Text> : null}
        <Text style={styles.hint}>{t("editHint")}</Text>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>{t("titleField")}</Text>
          <TextInput
            style={styles.field}
            placeholder={t("titleField")}
            placeholderTextColor={colors.textMuted}
            value={title}
            onChangeText={setTitle}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>{t("descriptionField")}</Text>
          <TextInput
            style={[styles.field, styles.multiline]}
            placeholder={t("descriptionField")}
            placeholderTextColor={colors.textMuted}
            value={description}
            onChangeText={setDescription}
            multiline
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>{t("priceField")}</Text>
          <TextInput
            style={styles.field}
            placeholder={t("priceField")}
            placeholderTextColor={colors.textMuted}
            value={price}
            onChangeText={setPrice}
            keyboardType="numeric"
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>{t("categoryField")}</Text>
          <View style={styles.chipsWrap}>
            {CATEGORIES.map((c) => (
              <Pressable
                key={c.value}
                style={[styles.chip, category === c.value && styles.chipSelected]}
                onPress={() => setCategory(c.value)}
              >
                <Text style={[styles.chipText, category === c.value && styles.chipTextSelected]}>
                  {c.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.sectionLabel}>{t("currentPhotos")}</Text>
          {existingImages.length === 0 ? (
            <Text style={styles.noImages}>{t("noPhotos")}</Text>
          ) : (
            <View style={styles.imagesRow}>
              {existingImages.map((img) => (
                <View key={img.id} style={styles.imageWrapper}>
                  <Image source={{ uri: resolveMediaUrl(img.image)! }} style={styles.existingImage} />
                  {img.is_primary && (
                    <View style={styles.primaryBadge}>
                      <Text style={styles.primaryBadgeText}>{t("primaryLabel")}</Text>
                    </View>
                  )}
                  <Pressable style={styles.removeImageBtn} onPress={() => handleRemoveExistingImage(img.id)}>
                    <Ionicons name="close" size={12} color="#FFFFFF" />
                  </Pressable>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.sectionLabel}>
            {t("addNewPhoto")} ({totalImageCount}/{MAX_TOTAL_IMAGES})
          </Text>

          {newImageUris.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              {newImageUris.map((uri, index) => (
                <View key={uri} style={styles.thumbWrapper}>
                  <Image source={{ uri }} style={styles.existingImage} />
                  <Pressable style={styles.removeImageBtn} onPress={() => removeNewImage(index)}>
                    <Ionicons name="close" size={12} color="#FFFFFF" />
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          )}

          {totalImageCount < MAX_TOTAL_IMAGES && (
            <Pressable style={styles.imagePicker} onPress={pickImages}>
              <Ionicons name="camera-outline" size={26} color={colors.textMuted} style={{ marginBottom: 6 }} />
              <Text style={styles.imagePickerText}>{t("choosePhoto")}</Text>
            </Pressable>
          )}
        </View>

        <Pressable style={styles.btn} onPress={handleSave} disabled={saving}>
          <Text style={styles.btnText}>{saving ? "..." : t("saveBtn")}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>["colors"]) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: 20, paddingBottom: 40 },
    error: { color: "#E7A0A0", fontSize: 12, marginBottom: 14, textAlign: "center", fontWeight: "500" },
    hint: { color: colors.textMuted, fontSize: 12, textAlign: "center", marginBottom: 20, lineHeight: 18 },
    fieldGroup: { marginBottom: 18 },
    label: { color: colors.text, fontSize: 13, fontWeight: "700", marginBottom: 8 },
    field: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, color: colors.text, fontSize: 14, backgroundColor: colors.surface },
    multiline: { height: 100, textAlignVertical: "top" },
    sectionLabel: { color: colors.textMuted, fontSize: 12, marginBottom: 10, fontWeight: "600" },
    chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: {
      borderWidth: 1, borderColor: colors.border, borderRadius: 20,
      paddingVertical: 9, paddingHorizontal: 15, backgroundColor: colors.surface,
    },
    chipSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
    chipText: { color: colors.textMuted, fontSize: 12 },
    chipTextSelected: { color: colors.accentText, fontWeight: "700" },
    noImages: { color: colors.textMuted, fontSize: 12, marginBottom: 8, opacity: 0.7 },
    imagesRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 8 },
    imageWrapper: { alignItems: "center", position: "relative" },
    thumbWrapper: { marginRight: 10, alignItems: "center", position: "relative" },
    existingImage: { width: 80, height: 80, borderRadius: 10, backgroundColor: colors.surface },
    primaryBadge: {
      position: "absolute", bottom: 6, left: 6, right: 6,
      backgroundColor: colors.accent, borderRadius: 5, paddingVertical: 2,
    },
    primaryBadgeText: { color: colors.accentText, fontSize: 8, fontWeight: "700", textAlign: "center" },
    removeImageBtn: { marginTop: 5, backgroundColor: "#B0524F", borderRadius: 10, width: 22, height: 22, alignItems: "center", justifyContent: "center" },
    imagePicker: {
      borderWidth: 1.5, borderColor: colors.border, borderRadius: 12, height: 120,
      justifyContent: "center", alignItems: "center", marginBottom: 16, backgroundColor: colors.surface,
    },
    imagePickerText: { color: colors.textMuted, fontSize: 13, fontWeight: "600" },
    btn: { backgroundColor: colors.accent, borderRadius: 12, padding: 15, alignItems: "center", marginTop: 8, ...shadow(3) },
    btnText: { color: colors.accentText, fontWeight: "700", fontSize: 14, letterSpacing: 0.3 },
  });
}
