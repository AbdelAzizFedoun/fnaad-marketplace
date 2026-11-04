import { useEffect, useRef } from "react";
import * as Device from "expo-device";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { useRouter } from "expo-router";
import { Platform } from "react-native";
import { registerPushToken } from "../services/api";

type NotificationsModule = typeof import("expo-notifications");

const isExpoGo =
  Constants.appOwnership === "expo" ||
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

const FALLBACK_PROJECT_ID = "ff4adf27-f236-4b71-a5f5-fc66d596dcd4";

async function loadNotifications(): Promise<NotificationsModule | null> {
  if (Platform.OS === "web") return null;
  if (Platform.OS === "android" && isExpoGo) {
    console.log("[PushNotifications] Push notifications disabled in Android Expo Go.");
    return null;
  }
  try {
    const mod = await import("expo-notifications");
    // Ensure notifications trigger banners and sounds while app is active or inactive
    mod.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
    return mod;
  } catch (error) {
    console.log("[PushNotifications] Failed to load expo-notifications:", error);
    return null;
  }
}

export function usePushNotifications(isLoggedIn: boolean) {
  const router = useRouter();
  const notificationListener = useRef<any>(undefined);
  const responseListener = useRef<any>(undefined);

  useEffect(() => {
    if (!isLoggedIn || Platform.OS === "web") return;
    if (Platform.OS === "android" && isExpoGo) return;

    let active = true;

    void loadNotifications().then(async (Notifications) => {
      if (!Notifications || !active) return;

      try {
        const token = await registerForPushNotificationsAsync(Notifications);
        if (token && active) {
          console.log("[PushNotifications] Registered push token:", token);
          registerPushToken(token)
            .then(() => console.log("[PushNotifications] Token uploaded to backend successfully"))
            .catch((err: any) =>
              console.log("[PushNotifications] Failed to upload push token to backend:", err?.message || err)
            );
        }

        notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
          console.log("[PushNotifications] Foreground notification received:", notification.request.content);
        });

        responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
          const data = response.notification.request.content.data;
          console.log("[PushNotifications] Notification response/tap:", data);
          if (!data) return;

          // Conversation / Message navigation
          const convId = data.conversation_id || data.conversationId;
          if (convId) {
            router.push({
              pathname: "/conversation/[id]",
              params: { id: String(convId) },
            });
            return;
          }

          // Follower navigation
          const followerId = Number(data.follower_id);
          if (data.type === "artist_follow" && Number.isInteger(followerId) && followerId > 0) {
            router.push({
              pathname: "/follower/[id]",
              params: { id: String(followerId) },
            });
            return;
          }

          // Product navigation
          const prodId = data.product_id || data.productId;
          if (prodId) {
            router.push({
              pathname: "/product/[id]",
              params: { id: String(prodId) },
            });
            return;
          }
        });
      } catch (err) {
        console.log("[PushNotifications] Setup error:", err);
      }
    });

    return () => {
      active = false;
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, [isLoggedIn, router]);
}

async function registerForPushNotificationsAsync(Notifications: NotificationsModule): Promise<string | null> {
  if (Platform.OS === "web") return null;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#D4AF37",
      sound: "default",
      enableVibrate: true,
      showBadge: true,
    });
  }

  if (!Device.isDevice) {
    console.log("[PushNotifications] Push notifications require a physical device.");
    return null;
  }

  const existingPermission = await Notifications.getPermissionsAsync();
  let permissionGranted = existingPermission.granted;

  if (!permissionGranted) {
    const requestedPermission = await Notifications.requestPermissionsAsync();
    permissionGranted = requestedPermission.granted;
  }

  if (!permissionGranted) {
    console.log("[PushNotifications] Push notification permission was not granted by user.");
    return null;
  }

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants as any).easConfig?.projectId ??
    FALLBACK_PROJECT_ID;

  try {
    const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
    return tokenResponse.data;
  } catch (e: any) {
    console.warn("[PushNotifications] Error fetching Expo push token:", e?.message || e);
    return null;
  }
}
