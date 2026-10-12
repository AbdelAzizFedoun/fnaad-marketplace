# Real Device Testing

Use this checklist after an EAS development or preview build is installed on a physical phone.

## Build

```bash
npx eas build --profile development --platform android
```

or:

```bash
npx eas build --profile preview --platform android
```

The development build must be rebuilt after changing `EXPO_PUBLIC_API_BASE_URL` or native
network settings. For a physical phone, the API host must be the computer's LAN address
(not `localhost`), and the phone must be connected to the same network. Product media is
served by the same host as the API.

## Device Checks Screen

Open the app, sign in, then go to:

`Settings -> Tester le telephone`

Pass criteria:

- `Push token`: shows `OK` and a valid Expo push token.
- `Local notification`: shows `OK` and a notification appears on the phone.
- `Camera`: opens the camera, captures an image, and shows a preview.
- `Photo library`: opens the gallery, selects an image, and shows a preview.
- `Location`: asks for permission and shows latitude/longitude.

## Remote Push Confirmation

1. Run `Push token`.
2. Tap `Copy push token`.
3. Send a test push to that token from Expo or the backend.
4. Confirm the phone receives the notification while the app is foregrounded, backgrounded, and closed.

## Existing User Flows

- Add artwork: verify photo-library upload from `Add Product`.
- Artist profile: verify avatar selection and upload.
- Conversation: mark an order confirmed, then verify `Share Location` sends a map link message.

## Notes

- Expo Go is not enough for a final sign-off because native build config and Android notification permission behavior must be validated in an installed build.
- Remote push needs network access and a valid EAS project ID. The configured project ID is in `app.json`.
