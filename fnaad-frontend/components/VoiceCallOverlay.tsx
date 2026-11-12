import React from "react";
import { Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { MediaStream } from "react-native-webrtc";
import VoiceCallAudio from "./VoiceCallAudio";

type CallPhase = "idle" | "incoming" | "outgoing" | "connecting" | "connected" | "ended" | "error";

type Props = {
  phase: CallPhase;
  remoteName: string;
  remoteStream: MediaStream | null;
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
  const visible = phase !== "idle";
  const terminal = phase === "ended" || phase === "error";
  const title = phase === "incoming"
    ? t("voiceCallIncoming")
    : phase === "outgoing"
      ? t("voiceCallCalling")
      : phase === "connected"
        ? formatDuration(elapsedSeconds)
        : phase === "error"
          ? error || t("voiceCallFailed")
          : phase === "ended"
            ? t("voiceCallEnded")
            : t("voiceCallConnecting");

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={phase === "incoming" ? onDecline : onEnd}>
      <View style={[styles.backdrop, { backgroundColor: colors.background }]}>
        {remoteStream && <VoiceCallAudio stream={remoteStream} accessibilityLabel={t("voiceCallRemoteAudio")} />}
        <View style={[styles.avatar, { backgroundColor: colors.surface, borderColor: colors.accent }]}>
          <Ionicons name="person" size={48} color={colors.accent} />
        </View>
        <Text style={[styles.name, { color: colors.text }]}>{remoteName}</Text>
        <Text style={[styles.status, { color: colors.textMuted }]}>{title}</Text>
        {phase === "error" && Platform.OS !== "web" && (
          <Text style={[styles.errorHint, { color: colors.textMuted }]}>{t("voiceCallNetworkHint")}</Text>
        )}
        <View style={styles.actions}>
          {phase === "incoming" ? (
            <>
              <CallButton icon="close" label={t("voiceCallDecline")} color="#B0524F" onPress={onDecline} />
              <CallButton icon="call" label={t("voiceCallAnswer")} color="#39835A" onPress={onAccept} />
            </>
          ) : terminal ? (
            <CallButton icon="close" label={t("voiceCallClose")} color={colors.surface} iconColor={colors.text} onPress={onDismiss} />
          ) : (
            <>
              {(phase === "connected" || phase === "connecting") && (
                <CallButton
                  icon={muted ? "mic-off" : "mic"}
                  label={muted ? t("voiceCallUnmute") : t("voiceCallMute")}
                  color={colors.surface}
                  iconColor={colors.text}
                  onPress={onToggleMute}
                />
              )}
              <CallButton icon="call" label={t("voiceCallEnd")} color="#B0524F" onPress={onEnd} />
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

function CallButton({
  icon,
  label,
  color,
  iconColor = "#FFFFFF",
  onPress,
}: {
  icon: "close" | "call" | "mic" | "mic-off";
  label: string;
  color: string;
  iconColor?: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.action} onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      <View style={[styles.actionIcon, { backgroundColor: color }]}>
        <Ionicons name={icon} size={24} color={iconColor} />
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28 },
  avatar: { width: 112, height: 112, borderRadius: 56, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  name: { fontSize: 24, fontWeight: "700", marginTop: 24, textAlign: "center" },
  status: { fontSize: 15, marginTop: 10, textAlign: "center" },
  errorHint: { fontSize: 13, marginTop: 8, textAlign: "center" },
  actions: { flexDirection: "row", justifyContent: "center", gap: 48, marginTop: 68 },
  action: { alignItems: "center", minWidth: 72 },
  actionIcon: { width: 60, height: 60, borderRadius: 30, alignItems: "center", justifyContent: "center" },
  actionLabel: { color: "#FFFFFF", fontSize: 12, marginTop: 10, textAlign: "center" },
});
