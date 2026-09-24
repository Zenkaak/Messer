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
  initialStream?: MediaStream | null;
}

interface SignalPayload {
  kind?: "join" | "offer" | "answer" | "ice";
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
}

interface SignalMessage {
  id: number;
  senderRole: string;
  payload: SignalPayload;
}

export async function requestMicrophoneAccess(): Promise<MediaStream> {
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    throw new Error("Microphone access is only available from a secure browser or the GSM World app.");
  }
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    });
  } catch (error) {
    // Some Android WebView microphone implementations reject the optional
    // audio constraints with NotReadableError even though plain audio capture
    // is available. Retry once with the WebView-compatible minimal request.
    if (error instanceof DOMException && ["NotReadableError", "OverconstrainedError"].includes(error.name)) {
      return navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    }
    throw error;
  }
}

export function microphoneErrorMessage(error: unknown) {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
      return "Microphone access was denied. Allow microphone access for GSM World, then try the call again.";
    }
    if (error.name === "NotFoundError") {
      return "No microphone was found on this device.";
    }
    if (error.name === "NotReadableError") {
      return "The microphone could not be opened. Close any other app using the microphone, then try the call again.";
    }
    if (error.name === "SecurityError") {
      return "Microphone access is blocked by the browser. Open site permissions and allow the microphone.";
    }
  }
  return error instanceof Error ? error.message : "Microphone permission is required for voice calls.";
}

function apiBase() {
  return (import.meta.env.BASE_URL as string).replace(/\/$/, "");
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
  initialStream,
}: VoiceCallProps) {
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const offerStartedRef = useRef(false);
  const remoteDescriptionRef = useRef(false);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const [status, setStatus] = useState(role === "admin" ? "Waiting for the user to answer…" : "Connecting to GSM UNLOCK…");
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [connected, setConnected] = useState(false);
  const base = apiBase();

  const requestHeaders = useCallback(() => {
    const headers: Record<string, string> = {};
    if (authToken) headers.Authorization = `Bearer ${authToken}`;
    if (adminPassword) headers["x-admin-password"] = adminPassword;
    return headers;
  }, [adminPassword, authToken]);

  const sendSignal = useCallback(async (payload: SignalPayload) => {
    const response = await fetch(`${base}/api/calls/${callId}/signals`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...requestHeaders() },
      body: JSON.stringify({ role, payload, visitorId, signalToken }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({})) as { error?: string };
      throw new Error(body.error || "The call signaling service is unavailable.");
    }
  }, [base, callId, requestHeaders, role, signalToken, visitorId]);

  const createOffer = useCallback(async () => {
    const peer = peerRef.current;
    if (!peer || offerStartedRef.current) return;
    offerStartedRef.current = true;
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    await sendSignal({ kind: "offer", sdp: offer });
    setStatus("Ringing the other participant…");
  }, [sendSignal]);

  useEffect(() => {
    let disposed = false;
    let cursor = 0;
    const peer = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun.cloudflare.com:3478" },
      ],
    });
    peerRef.current = peer;

    const flushCandidates = async () => {
      if (!remoteDescriptionRef.current) return;
      const pending = pendingCandidatesRef.current.splice(0);
      for (const candidate of pending) {
        try {
          await peer.addIceCandidate(candidate);
        } catch {
          // A late ICE candidate can be safely ignored after a peer disconnects.
        }
      }
    };

    peer.onicecandidate = (event) => {
      if (event.candidate) {
        void sendSignal({ kind: "ice", candidate: event.candidate.toJSON() }).catch((err) => {
          if (!disposed) setError(err instanceof Error ? err.message : "Could not send call signal.");
        });
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
    peer.oniceconnectionstatechange = () => {
      if (peer.iceConnectionState === "failed") {
        setConnected(false);
        setError("The network could not connect the two devices. Check the internet connection and try again.");
      }
    };
    peer.ontrack = (event) => {
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = event.streams[0];
        void remoteAudioRef.current.play().catch(() => undefined);
      }
    };

    const handleSignal = async (message: SignalMessage) => {
      if (message.senderRole === role) return;
      const payload = message.payload;
      if (payload.kind === "join") {
        if (role === "admin") await createOffer();
        return;
      }
      try {
        if (payload.kind === "offer" && payload.sdp) {
          await peer.setRemoteDescription(payload.sdp);
          remoteDescriptionRef.current = true;
          await flushCandidates();
          const answer = await peer.createAnswer();
          await peer.setLocalDescription(answer);
          await sendSignal({ kind: "answer", sdp: answer });
          setStatus("Connecting audio…");
        } else if (payload.kind === "answer" && payload.sdp) {
          await peer.setRemoteDescription(payload.sdp);
          remoteDescriptionRef.current = true;
          await flushCandidates();
          setStatus("Connecting audio…");
        } else if (payload.kind === "ice" && payload.candidate) {
          if (remoteDescriptionRef.current) await peer.addIceCandidate(payload.candidate);
          else pendingCandidatesRef.current.push(payload.candidate);
        }
      } catch {
        if (!disposed) setError("The audio connection could not be established.");
      }
    };

    const pollSignals = async () => {
      try {
        const query = new URLSearchParams({ after: String(cursor) });
        if (visitorId) query.set("visitorId", visitorId);
        query.set("signalToken", signalToken);
        const response = await fetch(`${base}/api/calls/${callId}/signals?${query.toString()}`, {
          headers: requestHeaders(),
        });
        if (!response.ok) throw new Error("The call signaling service is unavailable.");
        const signals = await response.json() as SignalMessage[];
        for (const signal of signals) {
          cursor = Math.max(cursor, signal.id);
          await handleSignal(signal);
        }
      } catch (err) {
        if (!disposed) setError(err instanceof Error ? err.message : "Could not connect the call.");
      }
    };

    const start = async () => {
      try {
        if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
          throw new Error("Microphone access is only available from a secure browser or the GSM World app.");
        }
        const stream = initialStream ?? await requestMicrophoneAccess();
        if (disposed) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        stream.getTracks().forEach((track) => peer.addTrack(track, stream));
        await sendSignal({ kind: "join" });
        setStatus(role === "admin" ? "Calling the user…" : "Ringing GSM UNLOCK…");
      } catch (err) {
        if (!disposed) {
          setError(microphoneErrorMessage(err));
          setStatus("Call setup failed");
        }
      }
    };

    void start();
    const timer = window.setInterval(() => void pollSignals(), 600);
    void pollSignals();

    return () => {
      disposed = true;
      window.clearInterval(timer);
      peer.close();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      peerRef.current = null;
    };
  }, [base, callId, createOffer, initialStream, requestHeaders, role, sendSignal, visitorId]);

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