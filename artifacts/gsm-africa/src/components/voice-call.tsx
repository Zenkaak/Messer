import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Mic, MicOff, PhoneCall, PhoneOff, Radio, Volume2 } from "lucide-react";

type VoiceRole = "admin" | "user";

interface VoiceCallProps {
  callId: number;
  signalToken: string;
  role: VoiceRole;
  onHangUp: () => void;
  compact?: boolean;
  authToken?: string | null;
  adminPassword?: string;
  visitorId?: string;
}

interface SignalMessage {
  type?: string;
  payload?: {
    kind?: "offer" | "answer" | "ice";
    sdp?: RTCSessionDescriptionInit;
    candidate?: RTCIceCandidateInit;
  };
}

function socketUrl() {
  const base = (import.meta.env.BASE_URL as string).replace(/\/$/, "");
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}${base}/api/ws`;
}

export function VoiceCallPanel({
  callId,
  signalToken,
  role,
  onHangUp,
  compact = false,
  authToken,
  adminPassword,
  visitorId,
}: VoiceCallProps) {
  const socketRef = useRef<WebSocket | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const [status, setStatus] = useState("Connecting securely…");
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [connected, setConnected] = useState(false);

  const send = useCallback((message: Record<string, unknown>) => {
    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
  }, []);

  const createOffer = useCallback(async () => {
    const peer = peerRef.current;
    if (!peer) return;
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    send({ type: "call-signal", callId, payload: { kind: "offer", sdp: offer } });
    setStatus("Ringing the other participant…");
  }, [callId, send]);

  useEffect(() => {
    let disposed = false;
    const peer = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun.cloudflare.com:3478" },
      ],
    });
    peerRef.current = peer;

    peer.onicecandidate = (event) => {
      if (event.candidate) {
        send({ type: "call-signal", callId, payload: { kind: "ice", candidate: event.candidate.toJSON() } });
      }
    };
    peer.onconnectionstatechange = () => {
      if (["connected", "completed"].includes(peer.connectionState)) {
        setConnected(true);
        setStatus("Connected — your call is live");
      } else if (["failed", "disconnected"].includes(peer.connectionState)) {
        setConnected(false);
        setStatus("Connection interrupted");
      }
    };
    peer.ontrack = (event) => {
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = event.streams[0];
        void remoteAudioRef.current.play().catch(() => undefined);
      }
    };

    const socket = new WebSocket(socketUrl());
    socketRef.current = socket;
    socket.onopen = async () => {
      send({ type: "call-join", callId, signalToken, role, authToken, adminPassword, visitorId });
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        if (disposed) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        stream.getTracks().forEach((track) => peer.addTrack(track, stream));
        setStatus(role === "admin" ? "Waiting for the user to answer…" : "Waiting for GSM UNLOCK…");
      } catch {
        setError("Microphone permission is required for voice calls.");
        setStatus("Microphone unavailable");
      }
    };
    socket.onmessage = async (event) => {
      const message = JSON.parse(event.data) as SignalMessage;
      if (message.type === "call-peer-joined" && role === "admin") {
        await createOffer();
        return;
      }
      if (message.type === "call-ended" || message.type === "call-peer-left") {
        setStatus("The other participant ended the call");
        setConnected(false);
        return;
      }
      if (message.type === "call-error") {
        setError("This call is no longer available.");
        return;
      }
      if (message.type !== "call-signal" || !message.payload) return;
      const payload = message.payload;
      try {
        if (payload.kind === "offer" && payload.sdp) {
          await peer.setRemoteDescription(payload.sdp);
          const answer = await peer.createAnswer();
          await peer.setLocalDescription(answer);
          send({ type: "call-signal", callId, payload: { kind: "answer", sdp: answer } });
          setStatus("Connecting audio…");
        } else if (payload.kind === "answer" && payload.sdp) {
          await peer.setRemoteDescription(payload.sdp);
          setStatus("Connecting audio…");
        } else if (payload.kind === "ice" && payload.candidate) {
          await peer.addIceCandidate(payload.candidate);
        }
      } catch {
        setError("The audio connection could not be established.");
      }
    };
    socket.onerror = () => setError("The call signaling connection failed.");

    return () => {
      disposed = true;
      send({ type: "call-leave", callId });
      socket.close();
      peer.close();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      socketRef.current = null;
      peerRef.current = null;
    };
  }, [adminPassword, authToken, callId, createOffer, role, send, signalToken, visitorId]);

  function toggleMute() {
    const next = !muted;
    streamRef.current?.getAudioTracks().forEach((track) => { track.enabled = !next; });
    setMuted(next);
  }

  return (
    <section className={`rounded-3xl border border-[#d7e9ec] bg-white shadow-[0_18px_48px_rgba(18,70,82,0.12)] ${compact ? "p-4" : "p-6"}`}>
      <audio ref={remoteAudioRef} autoPlay />
      <div className="flex items-center gap-3">
        <div className="relative grid h-12 w-12 place-items-center rounded-2xl bg-[#087f8c] text-white">
          {connected && <span className="absolute inset-0 animate-ping rounded-2xl bg-[#087f8c]/30" />}
          <PhoneCall className="relative h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#087f8c]">GSM UNLOCK</p>
          <p className="truncate text-base font-extrabold text-[#163642]">{status}</p>
        </div>
        <Radio className={connected ? "h-5 w-5 animate-pulse text-emerald-500" : "h-5 w-5 text-[#9eb9bf]"} />
      </div>
      {error ? (
        <p className="mt-4 rounded-2xl bg-rose-50 px-3 py-2.5 text-xs font-semibold text-rose-700">{error}</p>
      ) : (
        <p className="mt-4 flex items-center gap-2 text-xs text-[#66838b]">
          {connected ? <Volume2 className="h-4 w-4 text-emerald-600" /> : <Loader2 className="h-4 w-4 animate-spin text-[#087f8c]" />}
          Voice only · encrypted peer-to-peer audio
        </p>
      )}
      <div className="mt-5 flex gap-2">
        <button type="button" onClick={toggleMute} className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-[#d7e9ec] px-4 py-3 text-sm font-bold text-[#52717a] hover:border-[#087f8c] hover:text-[#087f8c]">
          {muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          {muted ? "Unmute" : "Mute"}
        </button>
        <button type="button" onClick={onHangUp} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#b9474f] px-4 py-3 text-sm font-bold text-white hover:bg-[#a43b43]">
          <PhoneOff className="h-4 w-4" /> End call
        </button>
      </div>
    </section>
  );
}