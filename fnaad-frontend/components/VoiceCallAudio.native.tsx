import React from "react";
import { RTCView } from "react-native-webrtc";
import type { VoiceCallAudioProps } from "./VoiceCallAudio";

export default function VoiceCallAudio({ stream, accessibilityLabel }: VoiceCallAudioProps) {
  if (!stream) return null;

  return (
    <RTCView
      streamURL={stream.toURL()}
      style={{ position: "absolute", width: 1, height: 1, opacity: 0 }}
      objectFit="cover"
      accessibilityLabel={accessibilityLabel}
    />
  );
}
