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
import { getAuthToken } from "@/lib/queryClient";
import { ChevronDown, ChevronUp, Loader2, Mic, MicOff, Volume2, X } from "lucide-react";
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

// Mic capture is driven by an AudioWorklet (`/mic-processor.js`,
// `class MicProcessor`). It posts ~100 ms float32 chunks to the main thread,
// which then downsamples to 16 kHz, encodes PCM16 LE, base64s, and ships
// each chunk as `input_audio_buffer.append` over the realtime WebSocket.
// Using AudioWorklet for better browser compatibility and performance
// (replaced deprecated ScriptProcessorNode).

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
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]!);
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
  const [expanded, setExpanded] = useState<boolean>(false);

  const wsRef = useRef<WebSocket | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  // Stream pre-acquired by a launcher click (preserves the user gesture on
  // browsers like Safari/iOS where a later getUserMedia would be rejected).
  const pendingStreamRef = useRef<MediaStream | null>(null);
  const autoStartedRef = useRef<boolean>(false);
  const inputCtxRef = useRef<AudioContext | null>(null);
  // AudioWorkletNode replaces the old ScriptProcessorNode-based capture.
  const inputWorkletRef = useRef<AudioWorkletNode | null>(null);
  const inputSrcRef = useRef<MediaStreamAudioSourceNode | null>(null);

  const outputCtxRef = useRef<AudioContext | null>(null);
  const outputCursorRef = useRef<number>(0); // when next chunk should start (audioCtx.currentTime)
  const playingRef = useRef<boolean>(false);

  const cleanup = useCallback(() => {
    try { wsRef.current?.close(1000, "client_close"); } catch {}
    wsRef.current = null;
    try {
      // Detach the worklet first; disconnect inputs.
      const w = inputWorkletRef.current;
      if (w) {
        try { w.port.onmessage = null; } catch {}
        try { (w.port as MessagePort).close?.(); } catch {}
        try { w.disconnect(); } catch {}
      }
      inputSrcRef.current?.disconnect();
    } catch {}
    inputWorkletRef.current = null;
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
      setExpanded(false);
      autoStartedRef.current = false;
      // Drop any pre-acquired stream so a stale gesture doesn't pollute the
      // next session.
      try { pendingStreamRef.current?.getTracks().forEach((t) => t.stop()); } catch {}
      pendingStreamRef.current = null;
    }
    return () => cleanup();
  }, [open, cleanup]);

  // Listen for direct-start launchers. The launcher captures the user gesture
  // and hands over a MediaStream so we don't have to ask permission again.
  // It also dispatches saffi:openVoice so Protected can flip `open` true.
  useEffect(() => {
    function onStart(ev: Event) {
      const ce = ev as CustomEvent<{ stream?: MediaStream }>;
      pendingStreamRef.current = ce.detail?.stream ?? null;
    }
    window.addEventListener("saffi:startVoice", onStart as EventListener);
    return () => window.removeEventListener("saffi:startVoice", onStart as EventListener);
  }, []);

  // When the pill is opened with a pending stream, auto-start the session.
  useEffect(() => {
    if (!open) return;
    if (autoStartedRef.current) return;
    if (status !== "idle") return;
    autoStartedRef.current = true;
    const stream = pendingStreamRef.current;
    pendingStreamRef.current = null;
    void start(stream ?? undefined);
    // start() depends on getAuthToken / fetch; safe to call once per open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

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

  async function start(preAcquired?: MediaStream) {
    if (status !== "idle" && status !== "error") return;
    setErrorText(null);
    setStatus("requesting");

    // 1. mic permission. If the caller (the launcher click handler) already
    // grabbed a stream synchronously inside the user gesture, reuse it — that
    // matters on Safari/iOS where async getUserMedia after navigation loses
    // the gesture.
    let stream: MediaStream;
    if (preAcquired) {
      stream = preAcquired;
    } else {
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
      // Start mic capture once the socket is open.
      // Using AudioWorklet for better browser compatibility and performance
      // (replaced deprecated ScriptProcessorNode).
      void (async () => {
        try {
          const ctx = new AudioContext();
          inputCtxRef.current = ctx;

          // Load the worklet module from /public. Vite serves anything in
          // client/public/ at the site root, so /mic-processor.js resolves
          // to the same file in dev and in the production build.
          await ctx.audioWorklet.addModule("/mic-processor.js");

          const src = ctx.createMediaStreamSource(stream);
          inputSrcRef.current = src;

          const node = new AudioWorkletNode(ctx, "mic-processor");
          inputWorkletRef.current = node;

          node.port.onmessage = (ev: MessageEvent) => {
            if (ws.readyState !== WebSocket.OPEN) return;
            const audio = (ev.data as { audio?: Float32Array })?.audio;
            if (!audio || audio.length === 0) return;
            const ds = downsampleTo16k(audio, ctx.sampleRate);
            const i16 = floatTo16BitPCM(ds);
            const b64 = int16ToBase64(i16);
            ws.send(JSON.stringify({
              type: "input_audio_buffer.append",
              audio: b64,
            }));
          };

          // Wire: mic source → worklet. The worklet does NOT need to be
          // connected to ctx.destination because process() runs on the
          // audio thread regardless.
          src.connect(node);

          setStatus("listening");
        } catch (e: any) {
          console.warn("[saffi-voice] worklet capture failed:", e?.message);
          fail("Could not start microphone capture.");
        }
      })();
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

  const orbIcon =
    isLoading || status === "thinking" ? (
      <Loader2 className="h-4 w-4 animate-spin" />
    ) : status === "speaking" ? (
      <Volume2 className="h-4 w-4" />
    ) : status === "listening" ? (
      <MicOff className="h-4 w-4" />
    ) : (
      <Mic className="h-4 w-4" />
    );

  // Non-blocking floating controller. Fixed bottom-right; the rest of the app
  // stays interactive. No backdrop, no full-screen modal.
  return (
    <div
      role="region"
      aria-label="Saffi voice"
      className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-end px-4 sm:px-6"
    >
      <div
        className={cn(
          "pointer-events-auto w-[min(22rem,calc(100vw-2rem))] rounded-2xl bg-background/95 backdrop-blur",
          "border border-[#E83A8E]/20 shadow-[0_10px_30px_rgba(0,0,0,0.18)]",
        )}
        data-testid="saffi-voice-controller"
      >
        {/* Expanded transcript (collapsible upward) */}
        {expanded && (
          <div className="border-b border-border px-4 py-3">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">
              Live transcript
            </div>
            <p className="max-h-40 overflow-y-auto text-xs leading-relaxed text-foreground/80 whitespace-pre-wrap">
              {transcript || "Saffi will show what she hears and says here."}
            </p>
            <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
              Saffi can chat, plan, and prepare drafts. Sending messages, posting,
              quotes and invoices still need your approval in the app.
            </p>
          </div>
        )}

        {/* Compact row */}
        <div className="flex items-center gap-3 px-3 py-2.5">
          {/* Status orb — visual only. The pink "Talk to Saffi" launcher
              starts the session; in this pill the mic dot is non-interactive
              so there is only ever ONE mic control to think about. */}
          <div className="relative h-11 w-11 shrink-0" aria-hidden="true">
            <div
              className={cn(
                "absolute inset-0 rounded-full border border-[#E83A8E]/25",
                ringActive && "animate-ping",
              )}
            />
            <div
              className={cn(
                "absolute inset-1 rounded-full border border-[#E83A8E]/40",
                status === "speaking" && "animate-pulse",
              )}
            />
            <div
              data-testid="saffi-voice-orb"
              className={cn(
                "absolute inset-1.5 rounded-full flex items-center justify-center",
                "shadow-[0_4px_14px_rgba(232,58,142,0.35)]",
                isLive
                  ? "bg-white text-[#E83A8E] ring-2 ring-[#E83A8E]"
                  : "bg-[#E83A8E] text-white",
              )}
            >
              {orbIcon}
            </div>
          </div>

          {/* Status + (when collapsed) latest transcript snippet */}
          <div className="min-w-0 flex-1">
            <div
              className={cn(
                "text-[13px] font-medium leading-tight truncate",
                status === "error" ? "text-[#c42d77]" : "text-foreground",
              )}
              data-testid="text-saffi-voice-status"
            >
              {statusLine}
            </div>
            {!expanded && transcript && status !== "error" && (
              <div className="text-[11px] text-muted-foreground truncate">
                {transcript.slice(-160)}
              </div>
            )}
            {!expanded && !transcript && status === "idle" && (
              <div className="text-[11px] text-muted-foreground truncate">
                Saffi · Grok voice
              </div>
            )}
          </div>

          {/* Expand transcript */}
          <button
            onClick={() => setExpanded((v) => !v)}
            className="rounded-full p-1.5 text-muted-foreground hover:bg-muted"
            aria-label={expanded ? "Hide transcript" : "Show transcript"}
            data-testid="button-saffi-voice-expand"
          >
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </button>

          {/* Close (also stops session) */}
          <button
            onClick={() => { stop(); onClose(); }}
            className="rounded-full p-1.5 text-muted-foreground hover:bg-muted"
            aria-label="Close voice"
            data-testid="button-saffi-voice-close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
