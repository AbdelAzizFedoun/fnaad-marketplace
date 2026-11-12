import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Platform, Alert } from "react-native";
import { subscribeToNetworkStatus, emitNetworkStatus, api } from "../services/api";
import { useLanguage } from "./LanguageContext";

type NetworkContextType = {
  isOnline: boolean;
  isOffline: boolean;
  setOnline: (status: boolean) => void;
  checkConnection: () => Promise<boolean>;
  notifyOffline: (actionName?: string) => void;
};

const NetworkContext = createContext<NetworkContextType | undefined>(undefined);

export function NetworkProvider({ children }: { children: ReactNode }) {
  const { t } = useLanguage();
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    if (Platform.OS === "web" && typeof navigator !== "undefined" && typeof navigator.onLine === "boolean") {
      return navigator.onLine;
    }
    return true;
  });

  useEffect(() => {
    // 1. Listen to axios network status changes (both native & web)
    const unsubscribeApi = subscribeToNetworkStatus((status) => {
      setIsOnline(status);
    });

    // 2. Browser online / offline events (when running on web)
    const handleWebOnline = () => {
      setIsOnline(true);
      emitNetworkStatus(true);
    };
    const handleWebOffline = () => {
      setIsOnline(false);
      emitNetworkStatus(false);
    };

    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.addEventListener("online", handleWebOnline);
      window.addEventListener("offline", handleWebOffline);
    }

    return () => {
      unsubscribeApi();
      if (Platform.OS === "web" && typeof window !== "undefined") {
        window.removeEventListener("online", handleWebOnline);
        window.removeEventListener("offline", handleWebOffline);
      }
    };
  }, []);

  const checkConnection = async (): Promise<boolean> => {
    if (Platform.OS === "web" && typeof navigator !== "undefined" && !navigator.onLine) {
      setIsOnline(false);
      return false;
    }
    try {
      await api.get("/catalog/categories/", { timeout: 5000, skipAuth: true } as any);
      setIsOnline(true);
      emitNetworkStatus(true);
      return true;
    } catch (err: any) {
      if (!err.response || err.code === "ERR_NETWORK" || err.message?.toLowerCase().includes("network")) {
        setIsOnline(false);
        emitNetworkStatus(false);
        return false;
      }
      setIsOnline(true);
      emitNetworkStatus(true);
      return true;
    }
  };

  const notifyOffline = (actionName?: string) => {
    const title = t("offlineTitle") || "Vous êtes hors ligne";
    const desc = actionName
      ? t("offlineActionNotice", { action: actionName }) ||
        `Vous êtes hors ligne. Une connexion Internet est requise pour ${actionName}.`
      : t("offlineDesc") || "Vérifiez votre connexion Internet et réessayez.";

    Alert.alert(title, desc, [{ text: "OK" }]);
  };

  return (
    <NetworkContext.Provider
      value={{
        isOnline,
        isOffline: !isOnline,
        setOnline: setIsOnline,
        checkConnection,
        notifyOffline,
      }}
    >
      {children}
    </NetworkContext.Provider>
  );
}

export function useNetwork() {
  const context = useContext(NetworkContext);
  if (!context) {
    throw new Error("useNetwork must be used within a NetworkProvider");
  }
  return context;
}
