import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import { useRouter } from "expo-router";
import { getActiveVoiceCall, getMyConversations, registerWebPushSubscription } from "../services/api";

const VAPID_PUBLIC_KEY = process.env.EXPO_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY || "";

function toUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const raw = atob((value + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

export function useWebIncomingCalls(isLoggedIn: boolean) {
  const router = useRouter();
  const notifiedCalls = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (Platform.OS !== "web" || !isLoggedIn || typeof window === "undefined" || !("Notification" in window)) return;
    let active = true;
    if (VAPID_PUBLIC_KEY && "serviceWorker" in navigator && "PushManager" in window) {
      void navigator.serviceWorker.register("/sw.js").then(async (registration) => {
        if (Notification.permission === "default") await Notification.requestPermission();
        if (Notification.permission !== "granted") return;
        const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toUint8Array(VAPID_PUBLIC_KEY) });
        await registerWebPushSubscription(subscription.toJSON());
      }).catch(() => undefined);
    }
    const poll = async () => {
      try {
        const conversations = (await getMyConversations()).data as { id: number }[];
        await Promise.all(conversations.map(async (conversation) => {
          const call = (await getActiveVoiceCall(conversation.id)).data;
          if (!active || !call || call.status !== "ringing" || notifiedCalls.current.has(call.id)) return;
          // Only the recipient should see the incoming browser notification.
          if (Notification.permission !== "granted") return;
          notifiedCalls.current.add(call.id);
          // Bring the recipient directly to the incoming-call controls, just
          // like a phone call, without requiring the Calls tab to be opened.
          router.push({ pathname: "/conversation/[id]", params: { id: String(conversation.id), incomingCall: "1" } });
          const notification = new Notification("Incoming FNAAD call", {
            body: "Someone is calling you. Click to answer.",
            tag: `fnaad-call-${call.id}`,
            requireInteraction: true,
          });
          notification.onclick = () => {
            window.focus();
            router.push({ pathname: "/conversation/[id]", params: { id: String(conversation.id), incomingCall: "1" } });
            notification.close();
          };
        }));
      } catch {
        // Background polling is best effort; the conversation screen remains authoritative.
      }
    };
    void poll();
    const timer = window.setInterval(() => void poll(), 2500);
    return () => { active = false; window.clearInterval(timer); };
  }, [isLoggedIn, router]);
}
