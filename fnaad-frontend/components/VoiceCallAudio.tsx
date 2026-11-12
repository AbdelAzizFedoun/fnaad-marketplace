import React from "react";

export type VoiceCallAudioProps = {
  stream: { toURL: () => string } | null;
  accessibilityLabel: string;
};

export default function VoiceCallAudio(_props: VoiceCallAudioProps) {
  return null;
}
