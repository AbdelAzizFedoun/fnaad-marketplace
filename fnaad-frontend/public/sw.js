self.addEventListener("push", (event) => {
  const payload = event.data ? event.data.json() : {};
  const data = payload.data || {};
  event.waitUntil(self.registration.showNotification(payload.title || "FNAAD", {
    body: payload.body || "You have a new notification.",
    icon: "/assets/logo-icon.png",
    badge: "/assets/logo-icon.png",
    tag: data.type === "voice_call" ? `fnaad-call-${data.call_id}` : "fnaad-notification",
    requireInteraction: data.type === "voice_call",
    data,
    actions: data.type === "voice_call" ? [{ action: "answer", title: "Answer" }, { action: "decline", title: "Decline" }] : [],
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  if (data.type === "voice_call" && data.conversation_id) {
    event.waitUntil(self.clients.openWindow(`/conversation/${data.conversation_id}?incomingCall=1`));
  }
});
