import { useEffect, useState, useRef } from "react";
import { View, Text, StyleSheet, Animated, Platform, useWindowDimensions } from "react-native";
import { getMySubscription } from "../services/api";
import { useLanguage } from "../context/LanguageContext";
import { useTheme } from "../context/ThemeContext";
import React from "react";

type Subscription = {
  status: string;
  is_active: boolean;
  effective_end_date: string;
};

type TimeLeft = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  expired: boolean;
};

function computeTimeLeft(endDate: string): TimeLeft {
  const diff = new Date(endDate).getTime() - Date.now();
  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
  }
  // Show every partial calendar day as a full remaining day. For example,
  // 2 days and 3 hours is displayed as 3 days, not 2.
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  const seconds = Math.floor((diff / 1000) % 60);
  return { days, hours, minutes, seconds, expired: false };
}

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

function formatEndDate(endDate: string, language: "en" | "fr" | "es" | "ar") {
  const locales = { en: "en-CM", fr: "fr-CM", es: "es-ES", ar: "ar-CM" };
  return new Intl.DateTimeFormat(locales[language], {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(endDate));
}

export default function SubscriptionCountdown({ refreshKey = 0, renewalSuccess = false }: { refreshKey?: number; renewalSuccess?: boolean }) {
  const { t, language } = useLanguage();
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { width } = useWindowDimensions();
  const isNarrow = width < 340;

  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(null);
  const [loadedRefreshKey, setLoadedRefreshKey] = useState<number | null>(null);

  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let isCurrentRequest = true;
    setLoadedRefreshKey(null);
    getMySubscription()
      .then((res) => {
        if (isCurrentRequest) {
          setSubscription(res.data);
          setLoadedRefreshKey(refreshKey);
        }
      })
      .catch((err) => console.log("Subscription load error:", err.response?.data || err.message));
    return () => {
      isCurrentRequest = false;
    };
  }, [refreshKey]);

  useEffect(() => {
    if (!subscription) return;

    const tick = () => setTimeLeft(computeTimeLeft(subscription.effective_end_date));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [subscription]);

  useEffect(() => {
    if (!timeLeft) return;
    const isWarning = !timeLeft.expired && timeLeft.days <= 7;
    if (isWarning) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.7, duration: 1200, useNativeDriver: Platform.OS !== "web" }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: Platform.OS !== "web" }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [timeLeft, pulseAnim]);

  if (!subscription || !timeLeft) return null;

  const isWarning = !timeLeft.expired && timeLeft.days <= 7;
  const isExpired = timeLeft.expired;
  const showRenewalSuccess = renewalSuccess && loadedRefreshKey === refreshKey;

  const countdownScale = isNarrow ? 0.85 : 1;

  return (
    <View
      style={[
        styles.card,
        isExpired && styles.cardExpired,
        isWarning && !isExpired && styles.cardWarning,
      ]}
    >
      {isExpired ? (
        <View style={styles.expiredContainer}>
          <View style={styles.expiredIconContainer}>
            <Text style={styles.expiredIcon}>{'\u26A0'}</Text>
          </View>
          <Text style={styles.expiredTitle}>{t("subscriptionExpiredTitle")}</Text>
          <Text style={styles.expiredMessage}>{t("subscriptionExpiredMessage")}</Text>
        </View>
      ) : (
        <View style={styles.activeContainer}>
          <View style={styles.headerRow}>
            <View style={[styles.statusDot, isWarning && styles.statusDotWarning]} />
            <Text style={[styles.label, isWarning && styles.labelWarning]}>
              {subscription.status === "trial" ? t("trialTimeLeft") : t("subscriptionTimeLeft")}
            </Text>
          </View>

          <Animated.View
            style={[
              styles.countdownWrapper,
              { transform: [{ scale: countdownScale }] },
              isWarning && { opacity: pulseAnim },
            ]}
          >
            <View style={styles.countdownRow}>
              <View style={styles.unit}>
                <Text style={[styles.unitValue, isWarning && styles.unitValueWarning]}>{timeLeft.days}</Text>
                <Text style={styles.unitLabel}>{t("daysShort")}</Text>
              </View>
              <Text style={[styles.separator, isWarning && styles.separatorWarning]}>:</Text>
              <View style={styles.unit}>
                <Text style={[styles.unitValue, isWarning && styles.unitValueWarning]}>{pad(timeLeft.hours)}</Text>
                <Text style={styles.unitLabel}>{t("hoursShort")}</Text>
              </View>
              <Text style={[styles.separator, isWarning && styles.separatorWarning]}>:</Text>
              <View style={styles.unit}>
                <Text style={[styles.unitValue, isWarning && styles.unitValueWarning]}>{pad(timeLeft.minutes)}</Text>
                <Text style={styles.unitLabel}>{t("minutesShort")}</Text>
              </View>
              <Text style={[styles.separator, isWarning && styles.separatorWarning]}>:</Text>
              <View style={styles.unit}>
                <Text style={[styles.unitValue, isWarning && styles.unitValueWarning]}>{pad(timeLeft.seconds)}</Text>
                <Text style={styles.unitLabel}>{t("secondsShort")}</Text>
              </View>
            </View>
          </Animated.View>

          <Text style={styles.endDate}>
            {t("subscriptionEndsOn", { date: formatEndDate(subscription.effective_end_date, language) })}
          </Text>

          {showRenewalSuccess && (
            <View style={styles.renewalSuccessContainer}>
              <Text style={styles.renewalSuccessMessage}>
                {t("subscriptionRenewalSuccess", { date: formatEndDate(subscription.effective_end_date, language) })}
              </Text>
            </View>
          )}

          {!showRenewalSuccess && isWarning && (
            <View style={styles.warningBannerContainer}>
              <Text style={styles.warningBanner}>{t("subscriptionWarningBanner")}</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>["colors"]) {
  const isDark = colors.background === "#0B0A0C";
  return StyleSheet.create({
    card: {
      borderRadius: 16,
      padding: 18,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      ...(isDark ? {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 6,
      } : {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
        elevation: 3,
      }),
    },
    cardWarning: {
      borderColor: "#B0524F",
      backgroundColor: "#B0524F0D",
    },
    cardExpired: {
      borderColor: "#B0524F",
      backgroundColor: "#B0524F12",
    },
    expiredContainer: {
      alignItems: "center",
      paddingVertical: 8,
    },
    expiredIconContainer: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: "#E7A0A020",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 12,
    },
    expiredIcon: {
      fontSize: 24,
      color: "#E7A0A0",
    },
    expiredTitle: {
      color: "#E7A0A0",
      fontSize: 16,
      fontWeight: "700",
      textAlign: "center",
      marginBottom: 6,
    },
    expiredMessage: {
      color: "#E7A0A0",
      fontSize: 13,
      textAlign: "center",
      lineHeight: 18,
      paddingHorizontal: 8,
    },
    activeContainer: {
      alignItems: "center",
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 12,
    },
    statusDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.accent,
    },
    statusDotWarning: {
      backgroundColor: "#E7A0A0",
    },
    label: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: "600",
      textTransform: "uppercase",
      letterSpacing: 0.6,
    },
    labelWarning: {
      color: "#E7A0A0",
    },
    countdownWrapper: {
      width: "100%",
      alignItems: "center",
    },
    countdownRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      justifyContent: "center",
      gap: 4,
    },
    unit: {
      alignItems: "center",
      minWidth: 44,
      paddingHorizontal: 4,
    },
    unitValue: {
      color: colors.accent,
      fontSize: 28,
      fontWeight: "800",
      lineHeight: 32,
      letterSpacing: -0.5,
    },
    unitValueWarning: {
      color: "#E7A0A0",
    },
    unitLabel: {
      color: colors.textMuted,
      fontSize: 10,
      marginTop: 4,
      fontWeight: "600",
      textTransform: "uppercase",
      letterSpacing: 0.4,
    },
    endDate: {
      color: colors.textMuted,
      fontSize: 12,
      marginTop: 12,
      textAlign: "center",
    },
    renewalSuccessContainer: {
      marginTop: 14,
      paddingVertical: 10,
      paddingHorizontal: 14,
      backgroundColor: colors.accent + "12",
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.accent + "35",
    },
    renewalSuccessMessage: {
      color: colors.accent,
      fontSize: 12,
      textAlign: "center",
      lineHeight: 18,
      fontWeight: "600",
    },
    separator: {
      color: colors.textMuted,
      fontSize: 22,
      fontWeight: "700",
      marginHorizontal: 2,
      marginBottom: 12,
      lineHeight: 32,
    },
    separatorWarning: {
      color: "#E7A0A0",
    },
    warningBannerContainer: {
      marginTop: 14,
      paddingVertical: 10,
      paddingHorizontal: 14,
      backgroundColor: "#E7A0A012",
      borderRadius: 10,
      borderWidth: 1,
      borderColor: "#E7A0A025",
    },
    warningBanner: {
      color: "#E7A0A0",
      fontSize: 12,
      textAlign: "center",
      lineHeight: 17,
      fontWeight: "600",
    },
  });
}
