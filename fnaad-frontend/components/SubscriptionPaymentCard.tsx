import { useState, useRef, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Animated, Platform, useWindowDimensions } from "react-native";
import { startSubscriptionPayment, getSubscriptionPaymentStatus, getSubscriptionPlans } from "../services/api";
import { useLanguage } from "../context/LanguageContext";
import { useTheme } from "../context/ThemeContext";
import React from "react";
import { Ionicons } from "@expo/vector-icons";

type Plan = {
  id: number;
  duration_months: number;
  price_xaf: number;
};

type PaymentMethod = "orange" | "mtn";

type Step = "plan" | "method" | "pending";

const PLANS: Plan[] = [
  { id: 1, duration_months: 1, price_xaf: 2000 },
  { id: 2, duration_months: 2, price_xaf: 4000 },
  { id: 3, duration_months: 3, price_xaf: 6500 },
];

export default function SubscriptionPaymentCard({ onSuccess }: { onSuccess?: () => void }) {
  const { t } = useLanguage();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const styles = createStyles(colors, width);
  const isWide = width >= 640;

  const [step, setStep] = useState<Step>("plan");
  const [selectedPlan, setSelectedPlan] = useState<Plan>(PLANS[1]);
  const [plans, setPlans] = useState<Plan[]>(PLANS);
  const [plansLoading, setPlansLoading] = useState(true);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [externalReference, setExternalReference] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pollingInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    getSubscriptionPlans()
      .then((res) => {
        const loadedPlans = res.data?.plans as Plan[] | undefined;
        if (loadedPlans?.length) {
          setPlans(loadedPlans);
          const chosen = loadedPlans.find((plan) => plan.id === selectedPlan.id) || loadedPlans[Math.min(1, loadedPlans.length - 1)];
          setSelectedPlan(chosen);
        }
      })
      .catch((err) => console.log("Subscription plans load error:", err.message))
      .finally(() => setPlansLoading(false));
  }, []);

  useEffect(() => () => {
    if (pollingInterval.current) clearInterval(pollingInterval.current);
  }, []);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.5, duration: 900, useNativeDriver: Platform.OS !== "web" }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: Platform.OS !== "web" }),
      ])
    ).start();
  }, [pulseAnim]);

  const animateTransition = (callback: () => void) => {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 120, useNativeDriver: Platform.OS !== "web" }),
      Animated.timing(slideAnim, { toValue: -8, duration: 120, useNativeDriver: Platform.OS !== "web" }),
    ]).start(() => {
      callback();
      slideAnim.setValue(8);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 180, useNativeDriver: Platform.OS !== "web" }),
        Animated.timing(slideAnim, { toValue: 0, duration: 180, useNativeDriver: Platform.OS !== "web" }),
      ]).start();
    });
  };

  const handleChoosePlan = (plan: Plan) => {
    setSelectedPlan(plan);
    animateTransition(() => setStep("method"));
  };

  const handleChooseMethod = (method: PaymentMethod) => {
    setSelectedMethod(method);
    setError(null);
  };

  const handleBackToPlan = () => {
    animateTransition(() => setStep("plan"));
  };

  const handleSubmitPayment = async () => {
    if (!selectedMethod) {
      setError(t("subscriptionSelectMethodError"));
      return;
    }
    if (!phoneNumber || phoneNumber.length < 9) {
      setError(t("subscriptionInvalidPhoneError"));
      return;
    }
    if (selectedPlan.price_xaf < 100) {
      setError("Fapshi requires at least 100 XAF. Update the subscription prices in the backend settings.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await startSubscriptionPayment(
        selectedPlan.id,
        phoneNumber,
        selectedMethod,
      );
      const extRef = res.data.external_reference as string;
      setExternalReference(extRef);
      animateTransition(() => setStep("pending"));
      pollPaymentStatus(extRef);
    } catch (err: any) {
      setError(err.response?.data?.detail || t("subscriptionPaymentError"));
    } finally {
      setLoading(false);
    }
  };

  const stopPolling = () => {
    if (pollingInterval.current) clearInterval(pollingInterval.current);
    pollingInterval.current = null;
  };

  const pollPaymentStatus = (externalRef: string) => {
    if (pollingInterval.current) clearInterval(pollingInterval.current);
    let attempts = 0;
    pollingInterval.current = setInterval(async () => {
      attempts += 1;
      try {
        const res = await getSubscriptionPaymentStatus(externalRef);
        const status = res.data.status;

        if (status === "SUCCESSFUL") {
          stopPolling();
          onSuccess?.();
          return;
        }
        if (status === "FAILED" || status === "EXPIRED") {
          stopPolling();
          setError(t("subscriptionPaymentFailed"));
          animateTransition(() => setStep("method"));
          return;
        }

      } catch (err) {
        console.log("Payment status poll error:", err);
      }
    }, 12000);
  };

  const formatPrice = (price: number) => price.toLocaleString();

  return (
    <View style={styles.card}>
      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ translateX: slideAnim }],
          },
        ]}
      >
        {step === "plan" && (
          <View>
            <Text style={styles.title}>{t("subscriptionChoosePlan")}</Text>
            <Text style={styles.subtitle}>
              Choose your plan duration.
            </Text>
            <View style={styles.plansColumn}>
              {plansLoading ? <ActivityIndicator color={colors.accent} style={{ marginVertical: 22 }} /> : plans.map((plan) => {
                const isSelected = selectedPlan.id === plan.id;
                const isPopular = plan.duration_months === 2;
                return (
                  <TouchableOpacity
                    key={plan.id}
                    style={[
                      styles.planOption,
                      isSelected && styles.planOptionSelected,
                    ]}
                    onPress={() => handleChoosePlan(plan)}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel={`${plan.duration_months} month plan, ${formatPrice(plan.price_xaf)} XAF`}
                  >
                    <View style={styles.planContent}>
                      {isPopular && (
                        <View style={styles.popularBadge}>
                          <Text style={styles.popularBadgeText}>{t("subscriptionPopular")}</Text>
                        </View>
                      )}
                      <View style={styles.planLeft}>
                        <View style={[styles.planIconCircle, isSelected && styles.planIconCircleSelected]}><Text style={[styles.planIcon, isSelected && styles.planIconSelected]}>{plan.duration_months}</Text></View>
                        <Text style={[styles.planMonthsLabel, isSelected && styles.planMonthsLabelSelected]}>
                          {plan.duration_months === 1 ? "month" : "months"}
                        </Text>
                      </View>
                      <View style={styles.planPriceBlock}><Text style={[styles.planPrice, isSelected && styles.planPriceSelected]}>{formatPrice(plan.price_xaf)} XAF</Text></View>
                      <Ionicons name={isSelected ? "checkmark-circle" : "chevron-forward"} size={22} color={isSelected ? colors.accent : colors.textMuted} />
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {step === "method" && (
          <View>
            <TouchableOpacity onPress={handleBackToPlan} style={styles.backButton}>
              <Text style={styles.backButtonText}>{t("subscriptionBack")}</Text>
            </TouchableOpacity>
            <Text style={styles.title}>{t("subscriptionPayWith")}</Text>
            <Text style={styles.subtitle}>Select your payment method</Text>

            <View style={[styles.methodsRow, isWide && styles.methodsRowWide]}>
              {(["orange", "mtn"] as PaymentMethod[]).map((method) => {
                const isSelected = selectedMethod === method;
                const isOrange = method === "orange";
                return (
                  <TouchableOpacity
                    key={method}
                    style={[
                      styles.methodOption,
                      isSelected && styles.methodOptionSelected,
                      isSelected && isOrange && styles.methodOptionOrange,
                      isSelected && !isOrange && styles.methodOptionMtn,
                    ]}
                    onPress={() => handleChooseMethod(method)}
                    activeOpacity={0.85}
                  >
                    <View style={styles.methodIconContainer}>
                      <View
                        style={[
                          styles.methodDot,
                          isOrange ? styles.methodDotOrange : styles.methodDotMtn,
                          isSelected && styles.methodDotSelected,
                        ]}
                      />
                      <Text style={[styles.methodLabel, isSelected && styles.methodLabelSelected]}>
                        {isOrange ? "Orange Money" : "MTN MoMo"}
                      </Text>
                    </View>
                    {isSelected && (
                      <View style={styles.methodCheck}>
                        <Text style={styles.methodCheckText}>{'\u2713'}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            {selectedMethod && (
              <View style={styles.formSection}>
                <Text style={styles.inputLabel}>{t("subscriptionPhoneNumber")}</Text>
                <View style={[styles.phoneInputRow, error && styles.phoneInputRowError]}>
                  <View style={styles.phonePrefixContainer}>
                    <Text style={styles.phonePrefix}>+237</Text>
                  </View>
                  <TextInput
                    style={styles.phoneInput}
                    value={phoneNumber}
                    onChangeText={setPhoneNumber}
                    keyboardType="phone-pad"
                    placeholder="6XX XXX XXX"
                    placeholderTextColor={colors.textMuted}
                    maxLength={9}
                    autoFocus
                  />
                </View>

                {error && (
                  <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}

                <TouchableOpacity
                  style={[styles.submitButton, loading && styles.submitButtonDisabled]}
                  onPress={handleSubmitPayment}
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  {loading ? (
                    <ActivityIndicator color={colors.background} />
                  ) : (
                    <View style={styles.submitButtonContent}>
                      <Text style={styles.submitButtonText}>{t("subscriptionSendPayment")}</Text>
                      <Text style={styles.submitButtonPrice}>· {formatPrice(selectedPlan.price_xaf)} XAF</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {step === "pending" && (
          <View style={styles.pendingContainer}>
            <Animated.View style={{ opacity: pulseAnim, transform: [{ scale: pulseAnim }] }}>
              <ActivityIndicator size="large" color={colors.accent} />
            </Animated.View>
            <Text style={styles.pendingTitle}>{t("subscriptionConfirmOnPhone")}</Text>
            <Text style={styles.pendingMessage}>
              {t("subscriptionWaitingConfirmation")}
            </Text>
            <View style={styles.pendingSteps}>
              <View style={styles.pendingStep}>
                <View style={styles.pendingStepDot} />
                <Text style={styles.pendingStepText}>Enter PIN</Text>
              </View>
              <View style={styles.pendingStepLine} />
              <View style={styles.pendingStep}>
                <View style={styles.pendingStepDot} />
                <Text style={styles.pendingStepText}>Confirm</Text>
              </View>
              <View style={styles.pendingStepLine} />
              <View style={styles.pendingStep}>
                <View style={[styles.pendingStepDot, styles.pendingStepDotActive]} />
                <Text style={[styles.pendingStepText, styles.pendingStepTextActive]}>Done</Text>
              </View>
            </View>

          </View>
        )}
      </Animated.View>
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>["colors"], width: number) {
  const isDark = colors.background === "#0B0A0C";
  const isCompact = width < 360;
  return StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: 18,
      padding: 20,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border,
      ...(isDark ? {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 12,
        elevation: 8,
      } : {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 4,
      }),
    },
    content: {
      width: "100%",
    },
    title: {
      color: colors.text,
      fontSize: 18,
      fontWeight: "700",
      marginBottom: 4,
      textAlign: "center",
      letterSpacing: 0.2,
    },
    subtitle: {
      color: colors.textMuted,
      fontSize: 13,
      marginBottom: 20,
      textAlign: "center",
      lineHeight: 18,
    },
    backButton: {
      alignSelf: "flex-start",
      marginBottom: 10,
      paddingVertical: 4,
      paddingHorizontal: 2,
    },
    backButtonText: {
      color: colors.accent,
      fontSize: 14,
      fontWeight: "600",
    },

    plansColumn: { gap: 10 },
    planOption: {
      width: "100%",
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 14,
      paddingVertical: isCompact ? 11 : 13,
      paddingHorizontal: isCompact ? 12 : 16,
      backgroundColor: colors.background,
      position: "relative",
      minHeight: 76,
    },
    planOptionSelected: {
      borderColor: colors.accent,
      backgroundColor: colors.accent + "12",
    },
    popularBadge: {
      position: "absolute",
      top: -11,
      backgroundColor: colors.accent,
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderRadius: 10,
      shadowColor: colors.accent,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.35,
      shadowRadius: 4,
      elevation: 4,
    },
    popularBadgeText: {
      color: colors.background,
      fontSize: 10,
      fontWeight: "700",
      letterSpacing: 0.3,
    },
    planContent: { flexDirection: "row", alignItems: "center", width: "100%" },
    planLeft: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
      minWidth: 0,
    },
    planIconCircle: { width: isCompact ? 38 : 42, height: isCompact ? 38 : 42, borderRadius: 21, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", marginRight: 10 },
    planIconCircleSelected: { backgroundColor: colors.accent + "22" },
    planIcon: {
      fontSize: isCompact ? 20 : 22,
      fontWeight: "800",
      color: colors.textMuted,
      lineHeight: 25,
    },
    planIconSelected: {
      color: colors.accent,
    },
    planMonthsLabel: {
      color: colors.textMuted,
      fontSize: isCompact ? 11 : 12,
      fontWeight: "600",
      textTransform: "uppercase",
      letterSpacing: 0.8,
      flexShrink: 1,
    },
    planMonthsLabelSelected: {
      color: colors.text,
      fontWeight: "700",
    },
    planPriceBlock: { alignItems: "flex-end", marginRight: 10, flexShrink: 1 },
    planPrice: {
      color: colors.textMuted,
      fontSize: isCompact ? 14 : 16,
      fontWeight: "700",
    },
    planPriceSelected: {
      color: colors.accent,
      fontWeight: "800",
      fontSize: isCompact ? 15 : 17,
    },
    methodsRow: {
      flexDirection: "row",
      gap: 10,
      marginBottom: 20,
    },
    methodsRowWide: { maxWidth: 440, alignSelf: "center", width: "100%" },
    methodOption: {
      flex: 1,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 12,
      paddingVertical: 16,
      paddingHorizontal: isCompact ? 8 : 12,
      alignItems: "center",
      backgroundColor: colors.background,
      position: "relative",
    },
    methodOptionSelected: {
      borderWidth: 2,
    },
    methodOptionOrange: {
      borderColor: "#FF6600",
      backgroundColor: "#FF660008",
    },
    methodOptionMtn: {
      borderColor: "#FFCC00",
      backgroundColor: "#FFCC0006",
    },
    methodIconContainer: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    methodDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    methodDotOrange: {
      backgroundColor: "#FF6600",
    },
    methodDotMtn: {
      backgroundColor: "#FFCC00",
    },
    methodDotSelected: {
      width: 12,
      height: 12,
      borderRadius: 6,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.2,
      shadowRadius: 2,
      elevation: 2,
    },
    methodLabel: {
      color: colors.textMuted,
      fontSize: isCompact ? 12 : 14,
      flexShrink: 1,
      textAlign: "center",
      fontWeight: "600",
    },
    methodLabelSelected: {
      color: colors.text,
      fontWeight: "700",
    },
    methodCheck: {
      position: "absolute",
      top: 8,
      right: 8,
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: colors.accent,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: colors.accent,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 3,
      elevation: 3,
    },
    methodCheckText: {
      color: colors.background,
      fontSize: 11,
      fontWeight: "700",
    },

    formSection: {
      marginTop: 4,
    },
    inputLabel: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: "600",
      marginBottom: 8,
      letterSpacing: 0.2,
    },
    phoneInputRow: {
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 12,
      backgroundColor: colors.background,
      overflow: "hidden",
    },
    phoneInputRowError: {
      borderColor: "#E7A0A0",
    },
    amountInputRow: {
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 12,
      backgroundColor: colors.background,
      marginBottom: 14,
      paddingRight: 14,
    },
    amountCurrency: {
      color: colors.textMuted,
      fontSize: 14,
      fontWeight: "600",
    },
    phonePrefixContainer: {
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRightWidth: 1,
      borderRightColor: colors.border,
      backgroundColor: colors.surface,
    },
    phonePrefix: {
      color: colors.textMuted,
      fontSize: 15,
      fontWeight: "600",
    },
    phoneInput: {
      flex: 1,
      color: colors.text,
      fontSize: 15,
      paddingVertical: 12,
      paddingHorizontal: 12,
    },
    errorContainer: {
      marginTop: 8,
      marginBottom: 12,
      paddingVertical: 10,
      paddingHorizontal: 12,
      backgroundColor: "#E7A0A012",
      borderRadius: 8,
      borderWidth: 1,
      borderColor: "#E7A0A030",
    },
    errorText: {
      color: "#E7A0A0",
      fontSize: 12,
      fontWeight: "500",
    },

    submitButton: {
      backgroundColor: colors.accent,
      borderRadius: 12,
      paddingVertical: 16,
      alignItems: "center",
      marginTop: 16,
      shadowColor: colors.accent,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 8,
      elevation: 5,
    },
    submitButtonDisabled: {
      opacity: 0.7,
    },
    submitButtonContent: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    submitButtonText: {
      color: colors.background,
      fontSize: 15,
      fontWeight: "700",
      letterSpacing: 0.2,
    },
    submitButtonPrice: {
      color: colors.background,
      fontSize: 14,
      fontWeight: "500",
      opacity: 0.9,
    },

    pendingContainer: {
      alignItems: "center",
      paddingVertical: 24,
    },
    pendingTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "700",
      marginTop: 16,
      textAlign: "center",
    },
    pendingMessage: {
      color: colors.textMuted,
      fontSize: 13,
      marginTop: 8,
      textAlign: "center",
      lineHeight: 18,
    },
    pendingSteps: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 28,
      gap: 8,
    },
    pendingStep: {
      alignItems: "center",
      gap: 8,
    },
    pendingStepDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: colors.border,
    },
    pendingStepDotActive: {
      backgroundColor: colors.accent,
      width: 12,
      height: 12,
      borderRadius: 6,
      shadowColor: colors.accent,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.4,
      shadowRadius: 4,
      elevation: 4,
    },
    pendingStepText: {
      color: colors.textMuted,
      fontSize: 10,
      fontWeight: "500",
    },
    pendingStepTextActive: {
      color: colors.accent,
      fontWeight: "700",
    },
    pendingStepLine: {
      width: 28,
      height: 2,
      backgroundColor: colors.border,
      borderRadius: 1,
      marginBottom: 16,
    },
    confirmButton: {
      backgroundColor: colors.accent,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: "center",
      marginTop: 26,
      shadowColor: colors.accent,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 8,
      elevation: 5,
    },
    confirmButtonText: {
      color: colors.background,
      fontSize: 15,
      fontWeight: "700",
      letterSpacing: 0.2,
    },
    confirmHint: {
      color: colors.textMuted,
      fontSize: 11,
      marginTop: 10,
      textAlign: "center",
      lineHeight: 16,
    },
  });
}
