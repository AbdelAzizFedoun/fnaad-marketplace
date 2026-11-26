import React, { useEffect, useRef } from "react";

export type VoiceCallAudioProps = {
  stream: { toURL?: () => string } | MediaStream | null;
  accessibilityLabel: string;
};

export default function VoiceCallAudio({ stream }: VoiceCallAudioProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !stream || typeof (stream as any).toURL === "function") return;
    audio.srcObject = stream as MediaStream;
    void audio.play().catch(() => undefined);
    return () => { audio.srcObject = null; };
  }, [stream]);
  return <audio ref={audioRef} autoPlay playsInline style={{ display: "none" }} />;
}
