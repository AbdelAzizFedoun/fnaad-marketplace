import { useCallback, useState } from "react";

type CallPhase = "idle" | "incoming" | "outgoing" | "connecting" | "connected" | "ended" | "error";

export function useVoiceCall(_conversationId: number, _currentUserId?: number) {
  const [phase, setPhase] = useState<CallPhase>("idle");

  const startCall = useCallback(async () => {
    setPhase("error");
  }, []);
  const dismiss = useCallback(() => setPhase("idle"), []);
  const noAction = useCallback(async () => {}, []);

  return {
    call: null,
    phase,
    remoteStream: null,
    muted: false,
    elapsedSeconds: 0,
    error: "",
    startCall,
    acceptCall: noAction,
    declineCall: noAction,
    endCall: noAction,
    toggleMute: () => {},
    dismiss,
  };
}
