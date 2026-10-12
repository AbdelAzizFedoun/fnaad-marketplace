import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, Alert } from "react-native";
import Image from "../components/MediaImage";
import { useRouter } from "expo-router";
import { useState } from "react";
import * as ImagePicker from "expo-image-picker";
import { createProduct, uploadProductImage } from "../services/api";
import { useLanguage } from "../context/LanguageContext";
import { useTheme } from "../context/ThemeContext";
import { useResponsiveLayout } from "../hooks/useResponsiveLayout";
import ScreenHeader from "../components/ScreenHeader";
import { shadow, RADIUS } from "../components/shadow";
import { Ionicons } from "@expo/vector-icons";
import React from "react";

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

const MAX_IMAGES = 6;
type SelectedImage = Pick<ImagePicker.ImagePickerAsset, "uri" | "fileName" | "mimeType" | "file">;

export default function AddProductScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { colors } = useTheme();
  const layout = useResponsiveLayout();
  const styles = createStyles(colors, layout);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("other");
  const [images, setImages] = useState<SelectedImage[]>([]);
  const [createdProductId, setCreatedProductId] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const pickImages = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setErrorMsg(t("photoPermissionDenied"));
      return;
    }

    const remainingSlots = MAX_IMAGES - images.length;
    if (remainingSlots <= 0) {
      setErrorMsg(t("maxPhotosError").replace("{count}", String(MAX_IMAGES)));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
      allowsMultipleSelection: true,
      selectionLimit: remainingSlots,
    });

    if (!result.canceled) {
      const newImages = result.assets.map(({ uri, fileName, mimeType, file }) => ({ uri, fileName, mimeType, file }));
      setImages((prev) => [...prev, ...newImages].slice(0, MAX_IMAGES));
    }
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    setErrorMsg("");

    const priceNumber = parseInt(price, 10);
    if (!title.trim() || isNaN(priceNumber) || priceNumber < 500) {
      setErrorMsg(t("priceValidation"));
      return;
    }
    if (images.length === 0) {
      setErrorMsg(t("addPhotoValidation"));
      return;
    }

    setLoading(true);
    try {
      let productId = createdProductId;
      if (!productId) {
        const res = await createProduct({
          title: title.trim(),
          description: description.trim(),
          price_xaf: priceNumber,
          category,
        });
        productId = res.data.id;
        setCreatedProductId(productId);
      }

      await Promise.all(images.map((image, index) => uploadProductImage(productId!, image, index, index === 0)));
      router.push("/");
    } catch (err: any) {
      console.log("Product or image upload error:", err.response?.data || err.message);
      Alert.alert(t("genericError"), t("genericError"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title={t("newArtworkTitle")} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
        {errorMsg ? <Text style={styles.error}>{errorMsg}</Text> : null}

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
          <Text style={styles.sectionLabel}>
            {t("choosePhoto")} ({images.length}/{MAX_IMAGES})
          </Text>

          {images.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
              {images.map((image, index) => (
                <View key={`${image.uri}-${index}`} style={styles.thumbWrapper}>
                  <Image source={{ uri: image.uri }} style={styles.thumb} />
                  {index === 0 && (
                    <View style={styles.primaryBadge}>
                      <Text style={styles.primaryBadgeText}>{t("primaryLabel")}</Text>
                    </View>
                  )}
                  <Pressable style={styles.removeThumbBtn} onPress={() => removeImage(index)}>
                    <Ionicons name="close" size={12} color="#FFFFFF" />
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          )}

          {images.length < MAX_IMAGES && (
            <Pressable style={styles.imagePicker} onPress={pickImages}>
              <Ionicons name="camera-outline" size={28} color={colors.textMuted} style={{ marginBottom: 6 }} />
              <Text style={styles.imagePickerText}>
                {images.length === 0 ? t("choosePhoto") : t("addMorePhotos")}
              </Text>
            </Pressable>
          )}
        </View>

        <Pressable style={styles.btn} onPress={handleSubmit} disabled={loading}>
          <Text style={styles.btnText}>{loading ? "..." : t("publishBtn")}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function createStyles(
  colors: ReturnType<typeof useTheme>["colors"],
  layout: ReturnType<typeof useResponsiveLayout>
) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: {
      width: "100%",
      maxWidth: layout.formWidth,
      alignSelf: "center",
      padding: layout.horizontalPadding,
      paddingBottom: 40,
    },
    error: { color: "#E7A0A0", fontSize: 12, marginBottom: 16, textAlign: "center", fontWeight: "500" },
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
    thumbWrapper: { marginRight: 12, position: "relative" },
    thumb: { width: 100, height: 100, borderRadius: 12, backgroundColor: colors.surface },
    primaryBadge: {
      position: "absolute", bottom: 6, left: 6, right: 6,
      backgroundColor: colors.accent, borderRadius: 6, paddingVertical: 3,
    },
    primaryBadgeText: { color: colors.accentText, fontSize: 9, fontWeight: "700", textAlign: "center" },
    removeThumbBtn: {
      position: "absolute", top: -8, right: -8, backgroundColor: "#B0524F",
      borderRadius: 12, width: 22, height: 22, alignItems: "center", justifyContent: "center",
      borderWidth: 2, borderColor: colors.background,
    },
    imagePicker: {
      borderWidth: 1.5, borderColor: colors.border, borderRadius: 12, height: 120,
      justifyContent: "center", alignItems: "center", marginBottom: 16, backgroundColor: colors.surface,
    },
    imagePickerText: { color: colors.textMuted, fontSize: 13, fontWeight: "600" },
    btn: { backgroundColor: colors.accent, borderRadius: 12, padding: 16, alignItems: "center", marginTop: 8, ...shadow(3) },
    btnText: { color: colors.accentText, fontWeight: "700", fontSize: 15, letterSpacing: 0.3 },
  });
}
