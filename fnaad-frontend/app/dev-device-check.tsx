import React, { useState } from "react";
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Image from "../components/MediaImage";
import Constants from "expo-constants";
import * as Clipboard from "expo-clipboard";
import * as Device from "expo-device";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { unwrapList } from "../services/api";
import ScreenHeader from "../components/ScreenHeader";
import { useLanguage } from "../context/LanguageContext";
import { useTheme } from "../context/ThemeContext";
import { useResponsiveLayout } from "../hooks/useResponsiveLayout";
import { api, resolveMediaUrl } from "../services/api";

type CheckState = "idle" | "running" | "ok" | "fail";

type CheckResult = {
  state: CheckState;
  detail: string;
};

type CheckKey = "push" | "localNotification" | "camera" | "photos" | "location" | "api" | "image";

const createInitialResults = (t: (key: string) => string): Record<CheckKey, CheckResult> => ({
  push: { state: "idle", detail: t("notTested") },
  localNotification: { state: "idle", detail: t("notTested") },
  camera: { state: "idle", detail: t("notTested") },
  photos: { state: "idle", detail: t("notTested") },
  location: { state: "idle", detail: t("notTested") },
  api: { state: "idle", detail: t("notTested") },
  image: { state: "idle", detail: t("notTested") },
});

export default function DevDeviceCheckScreen() {
  const { t } = useLanguage();
  const { colors } = useTheme();
  const layout = useResponsiveLayout();
  const styles = createStyles(colors, layout);
  const [results, setResults] = useState(() => createInitialResults(t));
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [previewUri, setPreviewUri] = useState<string | null>(null);

  const getErrorMessage = (error: unknown) =>
    error instanceof Error ? error.message : t("unknownError");

  const setResult = (key: CheckKey, next: CheckResult) => {
    setResults((current) => ({ ...current, [key]: next }));
  };

  const testPushToken = async () => {
    setResult("push", { state: "running", detail: t("requestingNotificationPermission") });
    try {
      const isExpoGo = Constants.appOwnership === "expo" || (Constants as any).executionEnvironment === "storeClient";
      if (Platform.OS === "android" && isExpoGo) {
        setResult("push", { state: "fail", detail: "Push notifications on Android require a development build (removed from Expo Go in SDK 53+)." });
        return;
      }
      const Notifications = await import("expo-notifications");
      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("default", {
          name: "default",
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: "#C9A24B",
        });
      }

      if (!Device.isDevice) {
        setResult("push", { state: "fail", detail: t("physicalDeviceRequired") });
        return;
      }

      const permission = await Notifications.requestPermissionsAsync();
      if (!permission.granted) {
        setResult("push", { state: "fail", detail: `${t("permissionLabel")} denied` });
        return;
      }

      const projectId = Constants.expoConfig?.extra?.eas?.projectId;
      if (!projectId) {
        setResult("push", { state: "fail", detail: t("missingEasProjectId") });
        return;
      }

      const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
      setPushToken(token);
      setResult("push", { state: "ok", detail: token });
    } catch (error) {
      setResult("push", { state: "fail", detail: getErrorMessage(error) });
    }
  };

  const testLocalNotification = async () => {
    setResult("localNotification", { state: "running", detail: t("schedulingNotification") });
    try {
      const isExpoGo = Constants.appOwnership === "expo" || (Constants as any).executionEnvironment === "storeClient";
      if (Platform.OS === "android" && isExpoGo) {
        setResult("localNotification", { state: "fail", detail: "Local notifications on Android in Expo Go require a development build." });
        return;
      }
      const Notifications = await import("expo-notifications");
      const permission = await Notifications.requestPermissionsAsync();
      if (!permission.granted) {
        setResult("localNotification", { state: "fail", detail: `${t("permissionLabel")} denied` });
        return;
      }

      await Notifications.scheduleNotificationAsync({
        content: {
          title: t("fnaadTestNotificationTitle"),
          body: t("fnaadTestNotificationBody"),
        },
        trigger: null,
      });
      setResult("localNotification", { state: "ok", detail: t("notificationScheduled") });
    } catch (error) {
      setResult("localNotification", { state: "fail", detail: getErrorMessage(error) });
    }
  };

  const testApi = async () => {
    const url = resolveMediaUrl("/api/catalog/products/")!;
    setResult("api", { state: "running", detail: `GET ${url}` });
    try {
      const res = await api.get("/catalog/products/", { skipAuth: true } as any);
      const count = unwrapList(res.data).length;
      setResult("api", { state: "ok", detail: `OK — ${count} products` });
    } catch (error: any) {
      const status = error?.response?.status ? `HTTP ${error.response.status}` : null;
      setResult("api", {
        state: "fail",
        detail: `${status ? `${status} — ` : ""}${getErrorMessage(error)}`,
      });
    }
  };

  const testImage = async () => {
    setResult("image", { state: "running", detail: "Loading a product image..." });
    try {
      const res = await api.get("/catalog/products/", { skipAuth: true } as any);
      const products: any[] = unwrapList(res.data);
      const withImage = products.find((item) => item?.images?.length);
      if (!withImage) {
        setResult("image", { state: "fail", detail: "The API returned no product with an image." });
        return;
      }
      const primary = withImage.images.find((img: any) => img.is_primary) || withImage.images[0];
      const url = resolveMediaUrl(primary.image)!;
      const response = await fetch(url);
      setResult("image", {
        state: response.ok ? "ok" : "fail",
        detail: response.ok ? `OK — ${response.status}` : `HTTP ${response.status} — ${url}`,
      });
    } catch (error) {
      setResult("image", { state: "fail", detail: getErrorMessage(error) });
    }
  };

  const testCamera = async () => {
    setResult("camera", { state: "running", detail: t("openingCamera") });
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        setResult("camera", { state: "fail", detail: t("cameraPermissionDenied") });
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        quality: 0.4,
      });

      if (result.canceled) {
        setResult("camera", { state: "idle", detail: t("canceled") });
        return;
      }

      setPreviewUri(result.assets[0].uri);
      setResult("camera", { state: "ok", detail: t("cameraImageCaptured") });
    } catch (error) {
      setResult("camera", { state: "fail", detail: getErrorMessage(error) });
    }
  };

  const testPhotos = async () => {
    setResult("photos", { state: "running", detail: t("openingPhotoLibrary") });
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setResult("photos", { state: "fail", detail: t("photoPermissionDenied") });
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.4,
      });

      if (result.canceled) {
        setResult("photos", { state: "idle", detail: t("canceled") });
        return;
      }

      setPreviewUri(result.assets[0].uri);
      setResult("photos", { state: "ok", detail: t("photoSelected") });
    } catch (error) {
      setResult("photos", { state: "fail", detail: getErrorMessage(error) });
    }
  };

  const testLocation = async () => {
    setResult("location", { state: "running", detail: t("gettingCurrentPosition") });
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setResult("location", { state: "fail", detail: t("locationPermissionDenied") });
        return;
      }

      const position = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = position.coords;
      setResult("location", {
        state: "ok",
        detail: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
      });
    } catch (error) {
      setResult("location", { state: "fail", detail: getErrorMessage(error) });
    }
  };

  const copyPushToken = async () => {
    if (!pushToken) {
      Alert.alert(t("noTokenTitle"), t("noTokenMessage"));
      return;
    }

    await Clipboard.setStringAsync(pushToken);
    Alert.alert(t("copiedTitle"), t("pushTokenCopied"));
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title={t("deviceChecksTitle")} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.caption}>{t("deviceChecksCaption")}</Text>

        <CheckRow title={t("pushToken")} result={results.push} onPress={testPushToken} />
        <CheckRow title={t("localNotification")} result={results.localNotification} onPress={testLocalNotification} />
        <CheckRow title={t("camera")} result={results.camera} onPress={testCamera} />
        <CheckRow title={t("photoLibrary")} result={results.photos} onPress={testPhotos} />
        <CheckRow title={t("location")} result={results.location} onPress={testLocation} />
        <CheckRow title="API (catalogue)" result={results.api} onPress={testApi} />
        <CheckRow title="Product image URL" result={results.image} onPress={testImage} />

        {pushToken ? (
          <Pressable style={styles.secondaryButton} onPress={copyPushToken}>
            <Text style={styles.secondaryButtonText}>{t("copyPushToken")}</Text>
          </Pressable>
        ) : null}

        {previewUri ? <Image source={{ uri: previewUri }} style={styles.preview} /> : null}
      </ScrollView>
    </View>
  );
}

function CheckRow({
  title,
  result,
  onPress,
}: {
  title: string;
  result: CheckResult;
  onPress: () => void;
}) {
  const { t } = useLanguage();
  const { colors } = useTheme();
  const layout = useResponsiveLayout();
  const styles = createStyles(colors, layout);
  const statusLabel = result.state === "running" ? "..." : result.state.toUpperCase();

  return (
    <View style={styles.checkRow}>
      <View style={styles.checkText}>
        <Text style={styles.checkTitle}>{title}</Text>
        <Text style={styles.checkDetail} numberOfLines={3}>
          {result.detail}
        </Text>
      </View>
      <Pressable style={styles.testButton} onPress={onPress} disabled={result.state === "running"}>
        <Text style={styles.testButtonText}>{statusLabel === "IDLE" ? t("test") : statusLabel}</Text>
      </Pressable>
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
    caption: { color: colors.textMuted, fontSize: 12, lineHeight: 18, marginBottom: 16 },
    checkRow: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 12,
      marginBottom: 10,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    checkText: { flex: 1 },
    checkTitle: { color: colors.text, fontSize: 14, fontWeight: "700", marginBottom: 4 },
    checkDetail: { color: colors.textMuted, fontSize: 11, lineHeight: 16 },
    testButton: {
      width: 74,
      minHeight: 38,
      borderRadius: 8,
      backgroundColor: colors.accent,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 10,
    },
    testButtonText: { color: colors.accentText, fontSize: 11, fontWeight: "700" },
    secondaryButton: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 12,
      alignItems: "center",
      marginTop: 8,
    },
    secondaryButtonText: { color: colors.text, fontSize: 12, fontWeight: "700" },
    preview: {
      width: "100%",
      height: 220,
      borderRadius: 8,
      marginTop: 16,
      backgroundColor: colors.surface,
    },
  });
}
