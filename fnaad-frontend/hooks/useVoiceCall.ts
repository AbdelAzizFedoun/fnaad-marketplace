import { useCallback, useEffect, useRef, useState } from "react";
import {
  getActiveVoiceCall,
  getVoiceCallSignals,
  sendVoiceCallSignal,
  startVoiceCall,
  updateVoiceCallStatus,
  type VoiceCall,
  type VoiceCallSignal,
} from "../services/api";
import {
  MediaStream,
  RTCIceCandidate,
  RTCPeerConnection,
  RTCSessionDescription,
  mediaDevices,
} from "react-native-webrtc";

type CallPhase = "idle" | "incoming" | "outgoing" | "connecting" | "connected" | "ended" | "error";
type RemoteDescription = { type: string | null; sdp: string };

const ICE_SERVERS = [{ urls: "stun:stun.l.google.com:19302" }];

export function useVoiceCall(conversationId: number, currentUserId?: number) {
  const [call, setCall] = useState<VoiceCall | null>(null);
  const [phase, setPhase] = useState<CallPhase>("idle");
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [muted, setMuted] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [error, setError] = useState("");
  const callRef = useRef<VoiceCall | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteDescriptionReady = useRef(false);
  const pendingCandidates = useRef<RTCIceCandidate[]>([]);
  const lastSignalId = useRef(0);
  const signalPollBusy = useRef(false);
  const handledCallId = useRef<number | null>(null);
  const callStartedAt = useRef<number | null>(null);

  const cleanupPeer = useCallback(() => {
    peerRef.current?.close();
    peerRef.current = null;
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    remoteDescriptionReady.current = false;
    pendingCandidates.current = [];
    setRemoteStream(null);
    setMuted(false);
    setElapsedSeconds(0);
    callStartedAt.current = null;
  }, []);

  const finishCall = useCallback((nextPhase: CallPhase) => {
    cleanupPeer();
    callRef.current = null;
    setCall(null);
    setPhase(nextPhase);
  }, [cleanupPeer]);

  const createPeer = useCallback(async (activeCall: VoiceCall, acquiredStream?: MediaStream) => {
    if (peerRef.current) return peerRef.current;
    const stream = acquiredStream || await mediaDevices.getUserMedia({ audio: true, video: false });
    const peer = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    localStreamRef.current = stream;
    peerRef.current = peer;

    stream.getTracks().forEach((track) => peer.addTrack(track, stream));
    peer.addEventListener("track", (event) => {
      const receivedStream = event.streams[0];
      if (receivedStream) setRemoteStream(receivedStream);
    });
    peer.addEventListener("icecandidate", (event) => {
      if (event.candidate) {
        void sendVoiceCallSignal(activeCall.id, "candidate", event.candidate.toJSON())
          .catch((signalError: unknown) => console.warn("Unable to send voice-call candidate:", signalError));
      }
    });
    peer.onconnectionstatechange = () => {
      if (peer.connectionState === "connected") {
        callStartedAt.current = Date.now();
        setPhase("connected");
      } else if (peer.connectionState === "failed") {
        setError("The call connection failed. Check your network and try again.");
        void updateVoiceCallStatus(activeCall.id, "ended").catch((statusError: unknown) =>
          console.warn("Unable to end failed voice call:", statusError)
        );
        finishCall("error");
      }
    };
    return peer;
  }, [finishCall]);

  const processSignal = useCallback(async (activeCall: VoiceCall, signal: VoiceCallSignal) => {
    const peer = peerRef.current;
    if (!peer) return;

    if (signal.signal_type === "offer") {
      await peer.setRemoteDescription(new RTCSessionDescription(signal.payload as RemoteDescription));
      remoteDescriptionReady.current = true;
      for (const candidate of pendingCandidates.current.splice(0)) {
        await peer.addIceCandidate(candidate);
      }
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      const localDescription = peer.localDescription;
      if (!localDescription) throw new Error("Unable to create the call answer.");
      await sendVoiceCallSignal(activeCall.id, "answer", { ...localDescription.toJSON() });
      setPhase("connecting");
      return;
    }

    if (signal.signal_type === "answer") {
      await peer.setRemoteDescription(new RTCSessionDescription(signal.payload as RemoteDescription));
      remoteDescriptionReady.current = true;
      for (const candidate of pendingCandidates.current.splice(0)) {
        await peer.addIceCandidate(candidate);
      }
      setPhase("connecting");
      return;
    }

    const candidate = new RTCIceCandidate(signal.payload as RTCIceCandidateInit);
    if (remoteDescriptionReady.current) {
      await peer.addIceCandidate(candidate);
    } else {
      pendingCandidates.current.push(candidate);
    }
  }, []);

  const startCall = useCallback(async () => {
    if (callRef.current || !conversationId) return;
    setError("");
    let acquiredStream: MediaStream | null = null;
    try {
      acquiredStream = await mediaDevices.getUserMedia({ audio: true, video: false });
      const response = await startVoiceCall(conversationId);
      const activeCall = response.data;
      callRef.current = activeCall;
      handledCallId.current = activeCall.id;
      lastSignalId.current = 0;
      setCall(activeCall);
      setPhase("outgoing");

      const peer = await createPeer(activeCall, acquiredStream);
      acquiredStream = null;
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      const localDescription = peer.localDescription;
      if (!localDescription) throw new Error("Unable to create the call offer.");
      await sendVoiceCallSignal(activeCall.id, "offer", { ...localDescription.toJSON() });
    } catch (callError: any) {
      acquiredStream?.getTracks().forEach((track) => track.stop());
      console.warn("Unable to start voice call:", callError.response?.data || callError.message);
      setError(callError.response?.data?.detail || callError.message || "Unable to start the call.");
      const activeCall = callRef.current;
      if (activeCall) {
        await updateVoiceCallStatus(activeCall.id, "ended").catch((statusError: unknown) =>
          console.warn("Unable to close failed voice call:", statusError)
        );
      }
      finishCall("error");
    }
  }, [conversationId, createPeer, finishCall]);

  const acceptCall = useCallback(async () => {
    const activeCall = callRef.current;
    if (!activeCall || activeCall.recipient !== currentUserId) return;
    setError("");
    try {
      await createPeer(activeCall);
      const response = await updateVoiceCallStatus(activeCall.id, "accepted");
      callRef.current = response.data;
      setCall(response.data);
      setPhase("connecting");
    } catch (callError: any) {
      console.warn("Unable to answer voice call:", callError.response?.data || callError.message);
      setError(callError.response?.data?.detail || callError.message || "Unable to answer the call.");
      await updateVoiceCallStatus(activeCall.id, "ended").catch((statusError: unknown) =>
        console.warn("Unable to close unanswered voice call:", statusError)
      );
      finishCall("error");
    }
  }, [createPeer, currentUserId, finishCall]);

  const declineCall = useCallback(async () => {
    const activeCall = callRef.current;
    if (!activeCall) return;
    try {
      await updateVoiceCallStatus(activeCall.id, "rejected");
    } catch (statusError: unknown) {
      console.warn("Unable to decline voice call:", statusError);
    } finally {
      finishCall("ended");
    }
  }, [finishCall]);

  const endCall = useCallback(async () => {
    const activeCall = callRef.current;
    if (activeCall) {
      try {
        await updateVoiceCallStatus(activeCall.id, "ended");
      } catch (statusError: unknown) {
        console.warn("Unable to end voice call:", statusError);
      }
    }
    finishCall("ended");
  }, [finishCall]);

  const toggleMute = useCallback(() => {
    const nextMuted = !muted;
    localStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = !nextMuted;
    });
    setMuted(nextMuted);
  }, [muted]);

  useEffect(() => {
    if (!conversationId || !currentUserId) return;
    let active = true;
    const pollActiveCall = async () => {
      try {
        const response = await getActiveVoiceCall(conversationId);
        if (!active) return;
        const incoming = response.data;
        if (!incoming) {
          if (callRef.current) finishCall("ended");
          return;
        }
        if (incoming.status !== "ringing" && incoming.status !== "accepted") return;
        if (handledCallId.current === incoming.id) {
          if (incoming.status === "accepted" && incoming.caller === currentUserId && phase === "outgoing") {
            setCall(incoming);
            setPhase("connecting");
          }
          return;
        }
        if (incoming.recipient !== currentUserId || incoming.status !== "ringing") return;
        handledCallId.current = incoming.id;
        callRef.current = incoming;
        setCall(incoming);
        setPhase("incoming");
      } catch (pollError: any) {
        if (active && pollError.response?.status !== 404) {
          console.warn("Unable to check for incoming voice calls:", pollError.response?.data || pollError.message);
        }
      }
    };
    void pollActiveCall();
    const interval = setInterval(() => void pollActiveCall(), 1500);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [conversationId, currentUserId, finishCall, phase]);

  useEffect(() => {
    if (!call || (phase !== "outgoing" && phase !== "connecting" && phase !== "connected")) return;
    let active = true;
    const pollSignals = async () => {
      if (signalPollBusy.current) return;
      signalPollBusy.current = true;
      try {
        const response = await getVoiceCallSignals(call.id, lastSignalId.current);
        for (const signal of response.data) {
          if (!active) return;
          lastSignalId.current = Math.max(lastSignalId.current, signal.id);
          await processSignal(call, signal);
        }
      } catch (pollError: any) {
        if (active && pollError.response?.status !== 404) {
          console.warn("Unable to receive voice-call signals:", pollError.response?.data || pollError.message);
        }
      } finally {
        signalPollBusy.current = false;
      }
    };
    void pollSignals();
    const interval = setInterval(() => void pollSignals(), 700);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [call, phase, processSignal]);

  useEffect(() => {
    if (phase !== "connected") return;
    const interval = setInterval(() => {
      if (callStartedAt.current) {
        setElapsedSeconds(Math.floor((Date.now() - callStartedAt.current) / 1000));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [phase]);

  useEffect(() => () => {
    const activeCall = callRef.current;
    if (activeCall) {
      void updateVoiceCallStatus(activeCall.id, "ended").catch((statusError: unknown) =>
        console.warn("Unable to close voice call after leaving conversation:", statusError)
      );
    }
    cleanupPeer();
  }, [cleanupPeer]);

  return {
    call,
    phase,
    remoteStream,
    muted,
    elapsedSeconds,
    error,
    startCall,
    acceptCall,
    declineCall,
    endCall,
    toggleMute,
    dismiss: () => {
      if (phase === "ended" || phase === "error") setPhase("idle");
      setError("");
    },
  };
}
