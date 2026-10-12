import { DeviceEventEmitter } from "react-native";

const APP_DATA_REFRESHED = "fnaad:app-data-refreshed";

export function publishAppDataRefresh() {
  DeviceEventEmitter.emit(APP_DATA_REFRESHED);
}

export function subscribeAppDataRefresh(listener: () => void) {
  const subscription = DeviceEventEmitter.addListener(APP_DATA_REFRESHED, listener);
  return () => subscription.remove();
}