import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
  Platform,
  useWindowDimensions,
} from "react-native";
import Image from "../../components/MediaImage";
import { useLocalSearchParams } from "expo-router";
import QRCode from "react-native-qrcode-svg";
import ViewShot, { captureRef } from "react-native-view-shot";
import * as Print from "expo-print";
import * as MediaLibrary from "expo-media-library/legacy";
import * as Sharing from "expo-sharing";
import { Ionicons } from "@expo/vector-icons";
import { getProductDetail, getPublicProductUrl } from "../../services/api";
import { useLanguage } from "../../context/LanguageContext";
import { useTheme } from "../../context/ThemeContext";
import ScreenHeader from "../../components/ScreenHeader";
import React from "react";

const QR_CODE_SIZE = 220;
const QR_LOGO_SIZE = 50;
const QR_LOGO = require("../../assets/logo-full-transparent.png");

type Product = {
  id: number;
  title: string;
  price_xaf: number;
  public_slug?: string;
  public_url?: string;
};

export default function ProductQrScreen() {
  const { id } = useLocalSearchParams();
  const { t } = useLanguage();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const styles = createStyles(colors, width);

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [printing, setPrinting] = useState(false);
  const viewShotRef = useRef<any>(null);

  useEffect(() => {
    getProductDetail(Number(id))
      .then((res) => setProduct(res.data))
      .catch((err) => console.log("Product QR load error:", err.response?.data || err.message))
      .finally(() => setLoading(false));
  }, [id]);

  /** Capture the label card as a data-URI (base64 PNG) */
  const captureLabel = async (): Promise<string> => {
    const uri = await captureRef(viewShotRef, {
      format: "png",
      quality: 1,
      result: "data-uri",
    });
    return uri;
  };

  /** Capture as a file URI (for saving / sharing) */
  const captureLabelFile = async (): Promise<string> => {
    const uri = await captureRef(viewShotRef, {
      format: "png",
      quality: 1,
      result: "tmpfile",
    });
    return uri;
  };

  // ── Save to gallery ───────────────────────────────────────────────
  const handleSaveImage = async () => {
    if (!viewShotRef.current) return;
    setSaving(true);
    try {
      const permission = await MediaLibrary.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(t("permissionDeniedTitle"), t("mediaPermissionDenied"));
        return;
      }

      const uri = await captureLabelFile();
      await MediaLibrary.saveToLibraryAsync(uri);
      Alert.alert(t("savedTitle"), t("qrSavedMessage"));
    } catch (err) {
      console.log("Save QR error:", err);
      Alert.alert(t("genericError"), t("qrSaveError"));
    } finally {
      setSaving(false);
    }
  };

  // ── Download QR image ─────────────────────────────────────────────
  const handleDownload = async () => {
    setSaving(true);
    try {
      if (Platform.OS === "web") {
        // Web: trigger browser download
        const dataUri = await captureLabel();
        const link = document.createElement("a");
        link.href = dataUri;
        link.download = `FNAAD-QR-${product?.title?.replace(/\s+/g, "_") || id}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        // Mobile: save to gallery
        const permission = await MediaLibrary.requestPermissionsAsync();
        if (!permission.granted) {
          Alert.alert(t("permissionDeniedTitle"), t("mediaPermissionDenied"));
          return;
        }
        const uri = await captureLabelFile();
        await MediaLibrary.saveToLibraryAsync(uri);
        Alert.alert("✅", t("qrSavedMessage"));
      }
    } catch (err) {
      console.log("Download QR error:", err);
      Alert.alert(t("genericError"), t("qrSaveError"));
    } finally {
      setSaving(false);
    }
  };

  // ── Print label ───────────────────────────────────────────────────
  const handlePrint = async () => {
    if (!product) return;
    setPrinting(true);
    try {
      const qrDataUrl = await captureLabel();

      const html = `
        <html>
          <head>
            <meta charset="utf-8"/>
            <style>
              @page { margin: 10mm; }
              body {
                margin: 0; padding: 0;
                display: flex; justify-content: center; align-items: flex-start;
                font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
              }
              .label {
                text-align: center;
                border: 2px solid #E8E4DF;
                border-radius: 12px;
                padding: 24px 20px 18px;
                width: 280px;
                box-sizing: border-box;
              }
              .qr-img {
                width: 220px; height: 220px;
                display: block; margin: 0 auto;
              }
              .title {
                font-size: 16px; font-weight: 700;
                color: #1A1720; margin: 14px 0 4px;
                line-height: 1.3;
              }
              .price {
                font-size: 15px; font-weight: 600;
                color: #8A6D1F; margin: 0;
              }
              .brand {
                font-size: 10px; color: #999;
                margin-top: 14px; letter-spacing: 1px;
                text-transform: uppercase;
              }
              .scan-text {
                font-size: 9px; color: #BBB;
                margin-top: 6px;
              }
            </style>
          </head>
          <body>
            <div class="label">
              <img class="qr-img" src="${qrDataUrl}" />
              <p class="title">${product.title}</p>
              <p class="price">${product.price_xaf.toLocaleString()} XAF</p>
              <p class="brand">FNAAD Marketplace</p>
              <p class="scan-text">Scan to view & purchase</p>
            </div>
          </body>
        </html>
      `;

      await Print.printAsync({ html });
    } catch (err) {
      console.log("Print error:", err);
      Alert.alert(t("genericError"), t("qrPrintError"));
    } finally {
      setPrinting(false);
    }
  };

  // ── Share ──────────────────────────────────────────────────────────
  const handleShare = async () => {
    if (!viewShotRef.current) return;
    try {
      const uri = await captureLabelFile();
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: "image/png",
          dialogTitle: t("shareProduct"),
        });
      }
    } catch (err) {
      console.log("Share QR error:", err);
    }
  };

  // ── Loading / Error states ─────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.container}>
        <ScreenHeader title={t("qrCodeTitle")} />
        <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
      </View>
    );
  }

  if (!product) {
    return (
      <View style={styles.container}>
        <ScreenHeader title={t("qrCodeTitle")} />
        <Text style={styles.error}>{t("productNotFound")}</Text>
      </View>
    );
  }

  const qrValue =
    product.public_slug
      ? getPublicProductUrl(product.public_slug)
      : product.public_url?.trim() || String(product.id);

  return (
    <View style={styles.container}>
      <ScreenHeader title={t("qrCodeTitle")} />

      <View style={styles.body}>
        {/* ─── Printable label card ─── */}
        <ViewShot ref={viewShotRef} options={{ format: "png", quality: 1 }} style={styles.labelCard}>
          <View collapsable={false} style={styles.qrWrap}>
            <QRCode
              value={qrValue}
              size={QR_CODE_SIZE}
              backgroundColor="#FFFFFF"
              color="#000000"
              ecl="H"
              quietZone={10}
            />
            <View pointerEvents="none" style={styles.qrLogoFrame}>
              <Image source={QR_LOGO} style={styles.qrLogo} resizeMode="contain" />
            </View>
          </View>
          <Text style={styles.labelTitle} numberOfLines={2}>{product.title}</Text>
          <Text style={styles.labelPrice}>{product.price_xaf.toLocaleString()} XAF</Text>
          <Text style={styles.labelBrand}>FNAAD Marketplace</Text>
          <Text style={styles.scanHint}>Scan to view & purchase</Text>
        </ViewShot>

        <Text style={styles.hint}>{t("qrHint")}</Text>

        {/* ─── Action buttons ─── */}
        <View style={styles.buttonRow}>
          <Pressable
            style={({ pressed }) => [styles.primaryBtn, pressed && styles.btnPressed]}
            onPress={handleDownload}
            disabled={saving}
          >
            <Ionicons name="download-outline" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.primaryBtnText}>
              {saving ? "..." : t("saveToGallery")}
            </Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.primaryBtn, styles.printBtnBg, pressed && styles.btnPressed]}
            onPress={handlePrint}
            disabled={printing}
          >
            <Ionicons name="print-outline" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.primaryBtnText}>
              {printing ? "..." : t("printLabel")}
            </Text>
          </Pressable>
        </View>

        <Pressable
          style={({ pressed }) => [styles.outlineBtn, pressed && styles.btnPressed]}
          onPress={handleShare}
        >
          <Ionicons name="share-social-outline" size={18} color={colors.text} style={{ marginRight: 8 }} />
          <Text style={styles.outlineBtnText}>{t("shareProduct")}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>["colors"], screenWidth: number) {
  const cardWidth = Math.min(300, Math.max(260, Math.round(screenWidth * 0.7)));

  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    body: { padding: 20, alignItems: "center" },
    error: { color: "#E7A0A0", fontSize: 13, textAlign: "center", marginTop: 40 },

    // ─── Label card (captured for print / download) ───
    labelCard: {
      backgroundColor: "#FFFFFF",
      borderRadius: 14,
      padding: 24,
      alignItems: "center",
      marginTop: 16,
      width: cardWidth,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 4,
    },
    qrWrap: {
      padding: 8,
      backgroundColor: "#FFFFFF",
      borderRadius: 8,
      position: "relative",
    },
    qrLogoFrame: {
      position: "absolute",
      width: QR_LOGO_SIZE + 6,
      height: QR_LOGO_SIZE + 6,
      left: (QR_CODE_SIZE + 16 - (QR_LOGO_SIZE + 6)) / 2,
      top: (QR_CODE_SIZE + 16 - (QR_LOGO_SIZE + 6)) / 2,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#FFFFFF",
      borderRadius: 12,
    },
    qrLogo: {
      width: QR_LOGO_SIZE,
      height: QR_LOGO_SIZE,
    },
    labelTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "700",
      marginTop: 14,
      textAlign: "center",
      lineHeight: 22,
    },
    labelPrice: {
      color: colors.accent,
      fontSize: 15,
      fontWeight: "600",
      marginTop: 4,
    },
    labelBrand: {
      color: colors.textMuted,
      fontSize: 10,
      marginTop: 12,
      letterSpacing: 1,
      textTransform: "uppercase",
    },
    scanHint: {
      color: colors.textMuted,
      fontSize: 9,
      marginTop: 4,
    },

    hint: {
      color: colors.textMuted,
      fontSize: 12,
      textAlign: "center",
      marginTop: 20,
      paddingHorizontal: 10,
    },

    // ─── Action buttons ───
    buttonRow: {
      flexDirection: "row",
      gap: 10,
      width: "100%",
      marginTop: 24,
    },
    primaryBtn: {
      flex: 1,
      flexDirection: "row",
      backgroundColor: colors.accent,
      borderRadius: 10,
      padding: 14,
      alignItems: "center",
      justifyContent: "center",
    },
    printBtnBg: {
      backgroundColor: "#2D2D2D",
    },
    primaryBtnText: {
      color: "#FFFFFF",
      fontWeight: "700",
      fontSize: 13,
    },
    outlineBtn: {
      flexDirection: "row",
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      padding: 14,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 10,
      width: "100%",
    },
    outlineBtnText: {
      color: colors.text,
      fontWeight: "600",
      fontSize: 13,
    },
    btnPressed: {
      opacity: 0.7,
    },
  });
}
