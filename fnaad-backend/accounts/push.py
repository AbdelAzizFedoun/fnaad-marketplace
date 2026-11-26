import requests
import json
import os
from pywebpush import webpush, WebPushException
from .models import Notification

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"

def send_web_push(subscription, title, body, data=None):
    if not subscription or not os.getenv("WEB_PUSH_VAPID_PRIVATE_KEY") or not os.getenv("WEB_PUSH_VAPID_EMAIL"):
        return
    try:
        webpush(subscription_info=subscription, data=json.dumps({"title": title, "body": body, "data": data or {}}), vapid_private_key=os.environ["WEB_PUSH_VAPID_PRIVATE_KEY"], vapid_claims={"sub": os.environ["WEB_PUSH_VAPID_EMAIL"]})
    except WebPushException as exc:
        print(f"[web-push] failed: {exc}")


def send_push_notification(token, title, body, data=None):
    """
    Sends a push notification via Expo's push service.
    `token` should be an Expo push token like ExponentPushToken[xxxxxxxx].
    Fails silently (logs) so a notification failure never breaks the calling view.
    """
    print(f"[push] attempting to send: token={token}, title={title}, body={body}")
    
    if not token:
        print("[push] no token, skipping")
        return

    payload = {
        "to": token,
        "title": title,
        "body": body,
        "sound": "default",
        "channelId": "default",
        "priority": "high",
        "_displayInForeground": True,
        "data": data or {},
    }
    if data and data.get("type") == "voice_call":
        payload["categoryId"] = "voice_call"

    try:
        print(f"[push] posting to {EXPO_PUSH_URL} with title='{title}'")
        response = requests.post(
            EXPO_PUSH_URL,
            json=payload,
            headers={
                "Accept": "application/json",
                "Content-Type": "application/json",
            },
            timeout=5,
        )
        response.raise_for_status()
        print(f"[push] success! response status: {response.status_code}, response: {response.text}")
    except requests.RequestException as e:
        print(f"[push] failed to send to {token}: {e}")


def create_notification(user, title, body, notification_type, data=None):
    notification = Notification.objects.create(
        user=user, title=title, body=body, notification_type=notification_type, data=data or {}
    )
    if user and getattr(user, "expo_push_token", None):
        send_push_notification(user.expo_push_token, title, body, {"type": notification_type, **(data or {})})
    if user and getattr(user, "web_push_subscription", None):
        send_web_push(user.web_push_subscription, title, body, {"type": notification_type, **(data or {})})
    return notification
