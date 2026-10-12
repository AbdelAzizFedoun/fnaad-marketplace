import { useEffect, useRef } from "react";
import * as Device from "expo-device";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { Platform } from "react-native";
import { registerPushToken } from "../services/api";

type NotificationsModule = typeof import("expo-notifications");

const isExpoGo =
  Constants.appOwnership === "expo" ||
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

async function loadNotifications(): Promise<NotificationsModule | null> {
  // Expo Go no longer includes Android remote-push support (removed in SDK 53+).
  // Attempting to import or use it on Android in Expo Go throws an uncatchable exception.
  if (Platform.OS === "android" && isExpoGo) {
    console.log("Push notifications are disabled in Android Expo Go (requires a development build).");
    return null;
  }
  try {
    return await import("expo-notifications");
  } catch (error) {
    console.log("Push notifications are unavailable in this runtime:", error);
    return null;
  }
}

export function usePushNotifications(isLoggedIn: boolean) {
  const notificationListener = useRef<any>(undefined);
  const responseListener = useRef<any>(undefined);

  useEffect(() => {
    if (!isLoggedIn || Platform.OS === "web") return;
    if (Platform.OS === "android" && isExpoGo) return;

    let active = true;

    void loadNotifications().then(async (Notifications) => {
      if (!Notifications || !active) return;

      try {
        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: false,
            shouldShowBanner: true,
            shouldShowList: true,
          }),
        });

        const token = await registerForPushNotificationsAsync(Notifications);
        if (token && active) {
          registerPushToken(token).catch((err: any) =>
            console.log("Failed to register push token:", err)
          );
        }

        notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
          console.log("Notification received:", notification);
        });

        responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
          console.log("Notification tapped:", response.notification.request.content.data);
        });
      } catch (err) {
        console.log("Notification setup error:", err);
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
  }, [isLoggedIn]);
}

async function registerForPushNotificationsAsync(Notifications: NotificationsModule): Promise<string | null> {
  if (Platform.OS === "web") return null;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#FF231F7C",
    });
  }

  if (!Device.isDevice) {
    console.log("Push notifications require a physical device.");
    return null;
  }

  const existingPermission = await Notifications.getPermissionsAsync();
  let permissionGranted = existingPermission.granted;

  if (!permissionGranted) {
    const requestedPermission = await Notifications.requestPermissionsAsync();
    permissionGranted = requestedPermission.granted;
  }

  if (!permissionGranted) {
    console.log("Push notification permission denied.");
    return null;
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) {
    console.log("No EAS project ID found in app.json.");
    return null;
  }

  try {
    const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
    return tokenResponse.data;
  } catch (e: any) {
    if (e?.message?.includes("googleServicesFile") || e?.message?.includes("FirebaseApp")) {
      console.warn(
        "[PushNotifications] Firebase is not configured (missing googleServicesFile in app.json). Android remote push notifications require google-services.json from Firebase."
      );
    } else {
      console.log("Error getting push token:", e);
    }
    return null;
  }
}
