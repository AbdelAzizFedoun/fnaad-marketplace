import { useCallback, useEffect, useRef, useState } from "react";
import {
  getActiveVoiceCall, getVoiceCallSignals, sendVoiceCallSignal,
  startVoiceCall, updateVoiceCallStatus, type VoiceCall, type VoiceCallSignal,
} from "../services/api";

type CallPhase = "idle" | "incoming" | "outgoing" | "connecting" | "connected" | "ended" | "error";
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
  const pendingCandidates = useRef<RTCIceCandidateInit[]>([]);
  const lastSignalId = useRef(0);
  const signalPollBusy = useRef(false);
  const handledCallId = useRef<number | null>(null);
  const startedAt = useRef<number | null>(null);

  const cleanup = useCallback(() => {
    peerRef.current?.close(); peerRef.current = null;
    localStreamRef.current?.getTracks().forEach((track) => track.stop()); localStreamRef.current = null;
    remoteDescriptionReady.current = false; pendingCandidates.current = [];
    setRemoteStream(null); setMuted(false); setElapsedSeconds(0); startedAt.current = null;
  }, []);
  const finish = useCallback((next: CallPhase) => { cleanup(); callRef.current = null; setCall(null); setPhase(next); }, [cleanup]);

  const createPeer = useCallback(async (active: VoiceCall, stream?: MediaStream) => {
    if (peerRef.current) return peerRef.current;
    const local = stream || await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    const peer = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    localStreamRef.current = local; peerRef.current = peer;
    local.getTracks().forEach((track) => peer.addTrack(track, local));
    peer.ontrack = (event) => { if (event.streams[0]) setRemoteStream(event.streams[0]); };
    peer.onicecandidate = (event) => { if (event.candidate) void sendVoiceCallSignal(active.id, "candidate", event.candidate.toJSON() as any); };
    peer.onconnectionstatechange = () => {
      if (peer.connectionState === "connected") { startedAt.current = Date.now(); setPhase("connected"); }
      if (peer.connectionState === "failed") { setError("The call connection failed. Check your network and try again."); void updateVoiceCallStatus(active.id, "ended"); finish("error"); }
    };
    return peer;
  }, [finish]);

  const processSignal = useCallback(async (active: VoiceCall, signal: VoiceCallSignal) => {
    const peer = peerRef.current; if (!peer) return;
    if (signal.signal_type === "offer") {
      await peer.setRemoteDescription(signal.payload as unknown as RTCSessionDescriptionInit); remoteDescriptionReady.current = true;
      for (const candidate of pendingCandidates.current.splice(0)) await peer.addIceCandidate(candidate);
      const answer = await peer.createAnswer(); await peer.setLocalDescription(answer);
      if (peer.localDescription) await sendVoiceCallSignal(active.id, "answer", peer.localDescription.toJSON() as any);
      setPhase("connecting"); return;
    }
    if (signal.signal_type === "answer") {
      await peer.setRemoteDescription(signal.payload as unknown as RTCSessionDescriptionInit); remoteDescriptionReady.current = true;
      for (const candidate of pendingCandidates.current.splice(0)) await peer.addIceCandidate(candidate);
      setPhase("connecting"); return;
    }
    const candidate = signal.payload as RTCIceCandidateInit;
    if (remoteDescriptionReady.current) await peer.addIceCandidate(candidate); else pendingCandidates.current.push(candidate);
  }, []);

  const startCall = useCallback(async () => {
    if (callRef.current || !conversationId) return;
    setError(""); let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      const active = (await startVoiceCall(conversationId)).data; callRef.current = active; setCall(active); setPhase("outgoing");
      handledCallId.current = active.id; lastSignalId.current = 0;
      const peer = await createPeer(active, stream); stream = null;
      const offer = await peer.createOffer(); await peer.setLocalDescription(offer);
      if (peer.localDescription) await sendVoiceCallSignal(active.id, "offer", peer.localDescription.toJSON() as any);
    } catch (e: any) { stream?.getTracks().forEach((track) => track.stop()); setError(e.message || "Unable to start the call."); if (callRef.current) await updateVoiceCallStatus(callRef.current.id, "ended").catch(() => undefined); finish("error"); }
  }, [conversationId, createPeer, finish]);
  const acceptCall = useCallback(async () => { const active = callRef.current; if (!active || active.recipient !== currentUserId) return; try { await createPeer(active); const updated = (await updateVoiceCallStatus(active.id, "accepted")).data; callRef.current = updated; setCall(updated); setPhase("connecting"); } catch (e: any) { setError(e.message || "Unable to answer the call."); await updateVoiceCallStatus(active.id, "ended").catch(() => undefined); finish("error"); } }, [createPeer, currentUserId, finish]);
  const declineCall = useCallback(async () => { if (callRef.current) await updateVoiceCallStatus(callRef.current.id, "rejected").catch(() => undefined); finish("ended"); }, [finish]);
  const endCall = useCallback(async () => { if (callRef.current) await updateVoiceCallStatus(callRef.current.id, "ended").catch(() => undefined); finish("ended"); }, [finish]);
  const toggleMute = useCallback(() => { const next = !muted; localStreamRef.current?.getAudioTracks().forEach((track) => { track.enabled = !next; }); setMuted(next); }, [muted]);

  useEffect(() => { if (!conversationId || !currentUserId) return; let active = true; const poll = async () => { try { const incoming = (await getActiveVoiceCall(conversationId)).data; if (!active) return; if (!incoming) { if (callRef.current) finish("ended"); return; } if (!["ringing", "accepted"].includes(incoming.status) || handledCallId.current === incoming.id) return; if (incoming.recipient === currentUserId && incoming.status === "ringing") { handledCallId.current = incoming.id; callRef.current = incoming; setCall(incoming); setPhase("incoming"); } } catch { /* polling is best effort */ } }; void poll(); const timer = setInterval(() => void poll(), 1500); return () => { active = false; clearInterval(timer); }; }, [conversationId, currentUserId, finish]);
  useEffect(() => { if (!call || !["outgoing", "connecting", "connected"].includes(phase)) return; let active = true; const poll = async () => { if (signalPollBusy.current) return; signalPollBusy.current = true; try { for (const signal of (await getVoiceCallSignals(call.id, lastSignalId.current)).data) { if (!active) return; lastSignalId.current = Math.max(lastSignalId.current, signal.id); await processSignal(call, signal); } } finally { signalPollBusy.current = false; } }; void poll(); const timer = setInterval(() => void poll(), 700); return () => { active = false; clearInterval(timer); }; }, [call, phase, processSignal]);
  useEffect(() => { if (phase !== "connected") return; const timer = setInterval(() => { if (startedAt.current) setElapsedSeconds(Math.floor((Date.now() - startedAt.current) / 1000)); }, 1000); return () => clearInterval(timer); }, [phase]);
  useEffect(() => () => { if (callRef.current) void updateVoiceCallStatus(callRef.current.id, "ended"); cleanup(); }, [cleanup]);
  return { call, phase, remoteStream, muted, elapsedSeconds, error, startCall, acceptCall, declineCall, endCall, toggleMute, dismiss: () => { if (phase === "ended" || phase === "error") setPhase("idle"); setError(""); } };
}
