import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import { useRouter } from "expo-router";
import { getActiveVoiceCall, getMyConversations } from "../services/api";

export function useWebIncomingCalls(isLoggedIn: boolean) {
  const router = useRouter();
  const notifiedCalls = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (Platform.OS !== "web" || !isLoggedIn || typeof window === "undefined" || !("Notification" in window)) return;
    let active = true;
    const poll = async () => {
      try {
        const conversations = (await getMyConversations()).data as { id: number }[];
        await Promise.all(conversations.map(async (conversation) => {
          const call = (await getActiveVoiceCall(conversation.id)).data;
          if (!active || !call || call.status !== "ringing" || notifiedCalls.current.has(call.id)) return;
          // Only the recipient should see the incoming browser notification.
          if (Notification.permission !== "granted") return;
          notifiedCalls.current.add(call.id);
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
