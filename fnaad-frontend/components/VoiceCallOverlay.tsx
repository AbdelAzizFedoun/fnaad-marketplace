import React, { useEffect, useRef, useState } from "react";
import { Animated, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View, Vibration, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import VoiceCallAudio from "./VoiceCallAudio";
import Image from "./MediaImage";
import { setAudioModeAsync } from "expo-audio";

type CallPhase = "idle" | "incoming" | "outgoing" | "connecting" | "connected" | "ended" | "error";

type Props = {
  phase: CallPhase;
  remoteName: string;
  remoteAvatar?: string | null;
  remoteStream: any;
  muted: boolean;
  elapsedSeconds: number;
  error: string;
  colors: { accent: string; accentText: string; background: string; text: string; textMuted: string; surface: string };
  t: (key: string) => string;
  onAccept: () => void;
  onDecline: () => void;
  onEnd: () => void;
  onToggleMute: () => void;
  onDismiss: () => void;
};

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const remainder = (seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainder}`;
}

export default function VoiceCallOverlay({
  phase,
  remoteName,
  remoteAvatar,
  remoteStream,
  muted,
  elapsedSeconds,
  error,
  colors,
  t,
  onAccept,
  onDecline,
  onEnd,
  onToggleMute,
  onDismiss,
}: Props) {
  const { width } = useWindowDimensions();
  const visible = phase !== "idle";
  const terminal = phase === "ended" || phase === "error";
  const serverFailure = phase === "error" && /status code 5\d{2}/i.test(error);
  const avatarSize = Math.min(132, Math.max(92, width * 0.32));
  const actionSize = Math.min(68, Math.max(58, width * 0.17));
  const actionGap = Math.min(44, width * 0.12);
  const [speaker, setSpeaker] = useState(true);
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (phase !== "incoming" && phase !== "outgoing") { pulse.stopAnimation(); pulse.setValue(1); return; }
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1.12, duration: 850, useNativeDriver: Platform.OS !== "web" }),
      Animated.timing(pulse, { toValue: 1, duration: 850, useNativeDriver: Platform.OS !== "web" }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [phase, pulse]);
  useEffect(() => {
    if (phase !== "incoming") return;
    let audioContext: AudioContext | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    const ring = () => {
      Vibration.vibrate([0, 350, 250]);
      if (Platform.OS === "web" && typeof window !== "undefined") {
        try {
          audioContext = new window.AudioContext();
          const oscillator = audioContext.createOscillator();
          const gain = audioContext.createGain();
          oscillator.frequency.value = 740;
          gain.gain.value = 0.035;
          oscillator.connect(gain); gain.connect(audioContext.destination);
          oscillator.start(); oscillator.stop(audioContext.currentTime + 0.18);
        } catch { /* Browser may require a prior user gesture for audio. */ }
      }
    };
    ring(); timer = setInterval(ring, 1800);
    return () => { if (timer) clearInterval(timer); Vibration.cancel(); void audioContext?.close(); };
  }, [phase]);
  useEffect(() => {
    if (phase !== "connected" && phase !== "connecting") return;
    void setAudioModeAsync({ playsInSilentMode: true, interruptionMode: "doNotMix", allowsRecording: true, shouldRouteThroughEarpiece: !speaker }).catch(() => undefined);
  }, [phase, speaker]);
  const title = phase === "incoming"
    ? t("voiceCallIncoming")
    : phase === "outgoing"
      ? t("voiceCallCalling")
      : phase === "connected"
        ? formatDuration(elapsedSeconds)
        : phase === "error"
          ? serverFailure
            ? t("voiceCallServerError")
            : error || t("voiceCallFailed")
          : phase === "ended"
            ? t("voiceCallEnded")
            : t("voiceCallConnecting");

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={phase === "incoming" ? onDecline : onEnd}>
      <View style={[styles.backdrop, { backgroundColor: colors.background }]}>
        {remoteStream && <VoiceCallAudio stream={remoteStream} accessibilityLabel={t("voiceCallRemoteAudio")} />}
        <SafeAreaView style={styles.safeArea}>
          <ScrollView contentContainerStyle={styles.content} bounces={false}>
            <View style={styles.identity}>
              <Animated.View
                style={[{ transform: [{ scale: pulse }] },
                  styles.avatarHalo,
                  {
                    width: avatarSize + 24,
                    height: avatarSize + 24,
                    backgroundColor: colors.surface,
                    borderColor: colors.accent,
                  },
                ]}
              >
                <View
                  style={[
                    styles.avatar,
                    {
                      width: avatarSize,
                      height: avatarSize,
                      borderRadius: avatarSize / 2,
                      backgroundColor: colors.background,
                    },
                  ]}
                >
                  {remoteAvatar ? <Image source={{ uri: remoteAvatar }} style={{ width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2 }} /> : <Ionicons name="person" size={avatarSize * 0.42} color={colors.accent} />}
                </View>
              </Animated.View>
              <Text style={[styles.name, { color: colors.text }]} numberOfLines={2}>
                {remoteName}
              </Text>
              <View style={[styles.statusPill, { backgroundColor: colors.surface }]}>
                <View
                  style={[
                    styles.statusDot,
                    { backgroundColor: phase === "error" ? "#B0524F" : phase === "connected" ? "#39835A" : colors.accent },
                  ]}
                />
                <Text style={[styles.status, { color: colors.textMuted }]}>{title}</Text>
              </View>
              {phase === "error" && Platform.OS !== "web" && (
                <View style={[styles.errorCard, { backgroundColor: colors.surface }]}>
                  <Ionicons name="alert-circle-outline" size={20} color="#B0524F" />
                  <Text style={[styles.errorHint, { color: colors.textMuted }]}>
                    {t(serverFailure ? "voiceCallServerHint" : "voiceCallNetworkHint")}
                  </Text>
                </View>
              )}
            </View>
            <View style={[styles.actions, { columnGap: actionGap }]}>
              {phase === "incoming" ? (
                <>
                  <CallButton icon="close" label={t("voiceCallDecline")} color="#B0524F" size={actionSize} textColor={colors.text} onPress={onDecline} />
                  <CallButton icon="call" label={t("voiceCallAnswer")} color="#39835A" size={actionSize} textColor={colors.text} onPress={onAccept} />
                </>
              ) : terminal ? (
                <CallButton icon="close" label={t("voiceCallClose")} color={colors.surface} iconColor={colors.text} size={actionSize} textColor={colors.text} onPress={onDismiss} />
              ) : (
                <>
                  {(phase === "connected" || phase === "connecting") && (
                    <>
                      <CallButton icon={muted ? "mic-off" : "mic"} label={muted ? t("voiceCallUnmute") : t("voiceCallMute")} color={colors.surface} iconColor={colors.text} size={actionSize} textColor={colors.text} onPress={onToggleMute} />
                      <CallButton icon={speaker ? "volume-high" : "volume-mute"} label={speaker ? t("voiceCallSpeaker") : t("voiceCallEarpiece")} color={colors.surface} iconColor={colors.text} size={actionSize} textColor={colors.text} onPress={() => setSpeaker((value) => !value)} />
                    </>
                  )}
                  <CallButton icon="call" label={t("voiceCallEnd")} color="#B0524F" size={actionSize} textColor={colors.text} onPress={onEnd} />
                </>
              )}
            </View>
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

function CallButton({
  icon,
  label,
  color,
  iconColor = "#FFFFFF",
  size,
  textColor,
  onPress,
}: {
  icon: "close" | "call" | "mic" | "mic-off" | "volume-high" | "volume-mute";
  label: string;
  color: string;
  iconColor?: string;
  size: number;
  textColor: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={[styles.actionIcon, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }]}>
        <Ionicons name={icon} size={24} color={iconColor} />
      </View>
      <Text style={[styles.actionLabel, { color: textColor }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1 },
  safeArea: { flex: 1 },
  content: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "space-between",
    alignSelf: "center",
    width: "100%",
    maxWidth: 480,
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  identity: { flex: 1, minHeight: 260, width: "100%", alignItems: "center", justifyContent: "center" },
  avatarHalo: { borderWidth: 1, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  avatar: { alignItems: "center", justifyContent: "center" },
  name: { fontSize: 26, fontWeight: "700", marginTop: 24, textAlign: "center", maxWidth: "100%" },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginTop: 14,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4, marginRight: 8 },
  status: { fontSize: 15, textAlign: "center" },
  errorCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 18,
    maxWidth: 360,
  },
  errorHint: { flex: 1, fontSize: 13, marginLeft: 8, textAlign: "center" },
  actions: { width: "100%", flexDirection: "row", alignItems: "center", justifyContent: "center", paddingTop: 24 },
  action: { alignItems: "center", justifyContent: "center", minWidth: 76, minHeight: 84 },
  actionPressed: { opacity: 0.72 },
  actionIcon: { alignItems: "center", justifyContent: "center" },
  actionLabel: { fontSize: 12, marginTop: 10, textAlign: "center" },
});
