/**
 * SaffiVoiceConversation — premium, hotel-concierge-style voice UI for Saffi.
 *
 * Architecture:
 *   1. POST /api/saffi/realtime/token → short-lived signed connect token.
 *   2. Open WebSocket to /ws/saffi/realtime?token=... (server-side proxy).
 *   3. Capture mic via getUserMedia (only after click), down-sample to 16 kHz
 *      mono PCM16 LE in an AudioWorkletNode-compatible ScriptProcessor, send
 *      base64 PCM16 chunks via input_audio_buffer.append.
 *   4. Receive response.output_audio.delta (base64 PCM16 @ 24 kHz), enqueue
 *      to an AudioContext for smooth playback.
 *
 * Provider: xAI Grok realtime ONLY. No Web Speech / SpeechRecognition / TTS
 * fallbacks. If voice is not configured, show a clear unavailable state.
 *
 * Safety: spoken Saffi cannot send WhatsApps, post social, send quotes, or
 * approve queued actions — those rules are pinned server-side via
 * session.update; this component is playback + capture only.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { getAuthToken } from "@/lib/queryClient";
import { Mic, MicOff, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Status =
  | "idle"
  | "requesting"
  | "connecting"
  | "listening"
  | "thinking"
  | "speaking"
  | "error";

const INPUT_SAMPLE_RATE = 16000; // Hz, sent to xAI
const OUTPUT_SAMPLE_RATE = 24000; // Hz, returned by xAI
const FRAME_SAMPLES = 1024; // ~64 ms at 16 kHz

function floatTo16BitPCM(input: Float32Array): Int16Array {
  const out = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    let s = Math.max(-1, Math.min(1, input[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

function downsampleTo16k(buffer: Float32Array, sourceRate: number): Float32Array {
  if (sourceRate === INPUT_SAMPLE_RATE) return buffer;
  const ratio = sourceRate / INPUT_SAMPLE_RATE;
  const newLen = Math.floor(buffer.length / ratio);
  const out = new Float32Array(newLen);
  let outIdx = 0;
  let inIdx = 0;
  while (outIdx < newLen) {
    const nextInIdx = Math.floor((outIdx + 1) * ratio);
    let acc = 0;
    let count = 0;
    for (let i = inIdx; i < nextInIdx && i < buffer.length; i++) {
      acc += buffer[i];
      count++;
    }
    out[outIdx] = count > 0 ? acc / count : 0;
    outIdx++;
    inIdx = nextInIdx;
  }
  return out;
}

function int16ToBase64(buf: Int16Array): string {
  const bytes = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

function base64ToInt16(b64: string): Int16Array {
  const bin = atob(b64);
  const len = bin.length;
  const buf = new ArrayBuffer(len);
  const view = new Uint8Array(buf);
  for (let i = 0; i < len; i++) view[i] = bin.charCodeAt(i);
  return new Int16Array(buf);
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export function SaffiVoiceConversation({ open, onClose }: Props) {
  const [status, setStatus] = useState<Status>("idle");
  const [errorText, setErrorText] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<string>("");

  const wsRef = useRef<WebSocket | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const inputCtxRef = useRef<AudioContext | null>(null);
  const inputProcRef = useRef<ScriptProcessorNode | null>(null);
  const inputSrcRef = useRef<MediaStreamAudioSourceNode | null>(null);

  const outputCtxRef = useRef<AudioContext | null>(null);
  const outputCursorRef = useRef<number>(0); // when next chunk should start (audioCtx.currentTime)
  const playingRef = useRef<boolean>(false);

  const cleanup = useCallback(() => {
    try { wsRef.current?.close(1000, "client_close"); } catch {}
    wsRef.current = null;
    try {
      inputProcRef.current?.disconnect();
      inputSrcRef.current?.disconnect();
    } catch {}
    inputProcRef.current = null;
    inputSrcRef.current = null;
    try { inputCtxRef.current?.close(); } catch {}
    inputCtxRef.current = null;
    try { micStreamRef.current?.getTracks().forEach((t) => t.stop()); } catch {}
    micStreamRef.current = null;
    try { outputCtxRef.current?.close(); } catch {}
    outputCtxRef.current = null;
    outputCursorRef.current = 0;
    playingRef.current = false;
  }, []);

  // Hard cleanup on unmount or close.
  useEffect(() => {
    if (!open) {
      cleanup();
      setStatus("idle");
      setTranscript("");
      setErrorText(null);
    }
    return () => cleanup();
  }, [open, cleanup]);

  function fail(msg: string) {
    setErrorText(msg);
    setStatus("error");
    cleanup();
  }

  function playPcmDelta(b64: string) {
    if (!outputCtxRef.current) {
      outputCtxRef.current = new AudioContext({ sampleRate: OUTPUT_SAMPLE_RATE });
    }
    const ctx = outputCtxRef.current;
    const i16 = base64ToInt16(b64);
    if (i16.length === 0) return;
    const f32 = new Float32Array(i16.length);
    for (let i = 0; i < i16.length; i++) f32[i] = i16[i] / 0x8000;

    const audioBuf = ctx.createBuffer(1, f32.length, OUTPUT_SAMPLE_RATE);
    audioBuf.copyToChannel(f32, 0);
    const src = ctx.createBufferSource();
    src.buffer = audioBuf;
    src.connect(ctx.destination);

    const now = ctx.currentTime;
    const startAt = Math.max(now, outputCursorRef.current);
    src.start(startAt);
    outputCursorRef.current = startAt + audioBuf.duration;
    playingRef.current = true;
    setStatus("speaking");
    src.onended = () => {
      // When we run dry, drop back to listening.
      if (ctx.currentTime >= outputCursorRef.current - 0.02) {
        playingRef.current = false;
        setStatus((s) => (s === "speaking" ? "listening" : s));
      }
    };
  }

  async function start() {
    if (status !== "idle" && status !== "error") return;
    setErrorText(null);
    setStatus("requesting");

    // 1. mic permission
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch (e: any) {
      fail("Microphone permission was not granted.");
      return;
    }
    micStreamRef.current = stream;

    // 2. fetch connect token
    setStatus("connecting");
    const auth = getAuthToken();
    if (!auth) {
      fail("Sign in required for voice.");
      return;
    }
    let token = "";
    let wsPath = "/ws/saffi/realtime";
    try {
      const r = await fetch("/api/saffi/realtime/token", {
        method: "POST",
        headers: { Authorization: `Bearer ${auth}` },
      });
      if (r.status === 503) {
        const j = await r.json().catch(() => ({}));
        fail(j?.detail || "Saffi voice is not configured on this server.");
        return;
      }
      if (!r.ok) {
        fail(`Voice session refused (${r.status}).`);
        return;
      }
      const j = await r.json();
      token = j.token;
      wsPath = j.wsPath || wsPath;
    } catch (e: any) {
      fail("Could not request voice session.");
      return;
    }

    // 3. WebSocket
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${proto}//${window.location.host}${wsPath}?token=${encodeURIComponent(token)}`;
    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch (e: any) {
      fail("Could not open voice connection.");
      return;
    }
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus("listening");
      // Start mic capture once the socket is open.
      try {
        const ctx = new AudioContext();
        inputCtxRef.current = ctx;
        const src = ctx.createMediaStreamSource(stream);
        inputSrcRef.current = src;
        const proc = ctx.createScriptProcessor(FRAME_SAMPLES, 1, 1);
        inputProcRef.current = proc;
        proc.onaudioprocess = (ev) => {
          if (ws.readyState !== WebSocket.OPEN) return;
          const ch = ev.inputBuffer.getChannelData(0);
          const ds = downsampleTo16k(ch, ctx.sampleRate);
          const i16 = floatTo16BitPCM(ds);
          const b64 = int16ToBase64(i16);
          ws.send(JSON.stringify({
            type: "input_audio_buffer.append",
            audio: b64,
          }));
        };
        src.connect(proc);
        proc.connect(ctx.destination); // ScriptProcessor needs a sink to fire
      } catch (e: any) {
        fail("Could not start microphone capture.");
      }
    };

    ws.onmessage = (ev) => {
      if (typeof ev.data !== "string") return;
      let msg: any;
      try { msg = JSON.parse(ev.data); } catch { return; }
      const type: string = msg?.type ?? "";

      // Audio playback chunks
      if (type === "response.output_audio.delta" || type === "response.audio.delta") {
        const delta = msg.delta || msg.audio || "";
        if (typeof delta === "string" && delta.length) playPcmDelta(delta);
        return;
      }
      // Streamed transcript of Saffi's reply
      if (type === "response.output_audio_transcript.delta" || type === "response.audio_transcript.delta") {
        if (typeof msg.delta === "string") {
          setTranscript((prev) => (prev + msg.delta).slice(-600));
        }
        return;
      }
      if (type === "response.created" || type === "response.in_progress") {
        if (!playingRef.current) setStatus("thinking");
        return;
      }
      if (type === "response.completed" || type === "response.done") {
        if (!playingRef.current) setStatus("listening");
        return;
      }
      if (type === "input_audio_buffer.speech_started") {
        setStatus("listening");
        return;
      }
      if (type === "input_audio_buffer.speech_stopped") {
        if (!playingRef.current) setStatus("thinking");
        return;
      }
      if (type === "error") {
        const m = msg?.error?.message ?? "voice_provider_error";
        fail(typeof m === "string" ? m : "Voice provider error.");
        return;
      }
    };

    ws.onerror = () => {
      fail("Voice connection error.");
    };

    ws.onclose = (ev) => {
      // If we closed cleanly via cleanup, do nothing.
      if (ev.code === 1000 && (!wsRef.current || wsRef.current === ws)) {
        // graceful
      }
      cleanup();
      setStatus((s) => (s === "error" ? s : "idle"));
    };
  }

  function stop() {
    cleanup();
    setStatus("idle");
    setTranscript("");
  }

  const statusLine = useMemo(() => {
    switch (status) {
      case "idle": return "Tap the mic to talk to Saffi";
      case "requesting": return "Asking for microphone…";
      case "connecting": return "Connecting…";
      case "listening": return "Listening — go ahead";
      case "thinking": return "Thinking…";
      case "speaking": return "Saffi is speaking";
      case "error": return errorText ?? "Something went wrong";
    }
  }, [status, errorText]);

  if (!open) return null;

  const ringActive = status === "listening" || status === "speaking";
  const isLoading = status === "requesting" || status === "connecting";
  const isLive = status === "listening" || status === "thinking" || status === "speaking";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Talk to Saffi"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative w-full max-w-md rounded-3xl bg-background p-8 shadow-2xl">
        <button
          onClick={onClose}
          aria-label="Close voice"
          className="absolute right-4 top-4 rounded-full p-2 text-muted-foreground hover:bg-muted"
          data-testid="button-saffi-voice-close"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex flex-col items-center gap-6 py-2">
          <h2 className="text-base font-semibold">Talk to Saffi</h2>

          {/* Mic orb */}
          <div className="relative h-44 w-44">
            {/* animated rings */}
            <div
              className={cn(
                "absolute inset-0 rounded-full border border-[#E83A8E]/20",
                ringActive && "animate-ping",
              )}
            />
            <div
              className={cn(
                "absolute inset-3 rounded-full border border-[#E83A8E]/30",
                ringActive && "animate-pulse",
              )}
            />
            <div
              className={cn(
                "absolute inset-6 rounded-full border-2 border-[#E83A8E]/40",
                status === "speaking" && "animate-pulse",
              )}
            />

            {/* Center button */}
            <button
              onClick={isLive ? stop : start}
              disabled={isLoading}
              data-testid="button-saffi-voice-toggle"
              className={cn(
                "absolute inset-10 rounded-full flex items-center justify-center transition-all",
                "shadow-[0_8px_30px_rgba(232,58,142,0.35)]",
                isLive
                  ? "bg-white text-[#E83A8E] ring-2 ring-[#E83A8E]"
                  : "bg-[#E83A8E] text-white hover:bg-[#c42d77]",
                isLoading && "opacity-80 cursor-wait",
              )}
              aria-label={isLive ? "Stop voice" : "Start voice"}
            >
              {isLoading ? (
                <Loader2 className="h-8 w-8 animate-spin" />
              ) : isLive ? (
                <MicOff className="h-9 w-9" />
              ) : (
                <Mic className="h-10 w-10" />
              )}
            </button>
          </div>

          {/* status text */}
          <div className="min-h-[2.5rem] text-center">
            <p
              className={cn(
                "text-sm",
                status === "error" ? "text-[#c42d77]" : "text-foreground",
              )}
              data-testid="text-saffi-voice-status"
            >
              {statusLine}
            </p>
            {transcript && status !== "error" && (
              <p className="mt-2 max-w-sm text-xs text-muted-foreground line-clamp-3">
                {transcript}
              </p>
            )}
          </div>

          {/* End button when live */}
          {isLive && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => { stop(); onClose(); }}
              data-testid="button-saffi-voice-end"
            >
              End conversation
            </Button>
          )}

          <p className="max-w-sm text-center text-[11px] leading-relaxed text-muted-foreground">
            Saffi can chat, plan, and prepare drafts here. Sending messages,
            posting, quotes and invoices still need your approval in the app.
          </p>
        </div>
      </div>
    </div>
  );
}
