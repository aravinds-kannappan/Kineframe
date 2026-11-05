import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, X } from "lucide-react";
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  abort: () => void;
  onresult:
    | ((e: {
        results: { isFinal: boolean; 0: { transcript: string } }[];
        resultIndex: number;
      }) => void)
    | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}
export default function Voice({
  onQuestion,
  onStatus,
  disabled,
  triggerRef,
}: {
  onQuestion: (q: string) => void;
  onStatus: (s: string) => void;
  disabled: boolean;
  triggerRef?: React.MutableRefObject<HTMLButtonElement | null>;
}) {
  const [listening, setListening] = useState(false),
    [consent, setConsent] = useState(false),
    [accepted, setAccepted] = useState(false);
  const recognition = useRef<Recognition | null>(null),
    current = useRef({ onQuestion, onStatus });
  current.current = { onQuestion, onStatus };
  const Constructor =
    (
      window as unknown as {
        SpeechRecognition?: new () => Recognition;
        webkitSpeechRecognition?: new () => Recognition;
      }
    ).SpeechRecognition ||
    (window as unknown as { webkitSpeechRecognition?: new () => Recognition })
      .webkitSpeechRecognition;
  useEffect(
    () => () => {
      if (recognition.current) {
        recognition.current.onresult = null;
        recognition.current.onend = null;
        recognition.current.onerror = null;
        recognition.current.abort();
      }
    },
    [],
  );
  function start() {
    if (listening) {
      recognition.current?.abort();
      setListening(false);
      return;
    }
    if (!Constructor) {
      onStatus(
        "Voice recognition is not supported here. Open in a browser with Web Speech recognition, or type your question.",
      );
      return;
    }
    if (!accepted) {
      setConsent(true);
      return;
    }
    listen();
  }
  function listen() {
    if (!Constructor) return;
    recognition.current?.abort();
    const r = new Constructor();
    recognition.current = r;
    r.lang = "en-US";
    r.continuous = false;
    r.interimResults = false;
    r.onresult = (e) => {
      const text = Array.from(e.results)
        .filter((x) => x.isFinal)
        .map((x) => x[0].transcript)
        .join(" ");
      if (text.trim()) current.current.onQuestion(text);
    };
    r.onerror = (e) => {
      setListening(false);
      current.current.onStatus(
        e.error === "not-allowed"
          ? "Microphone permission was declined. Use the text field or enable it in browser settings."
          : e.error === "no-speech"
            ? "No speech detected. Try again."
            : e.error === "aborted"
              ? "Voice stopped."
              : "Voice recognition could not connect. You can still type your question.",
      );
    };
    r.onend = () => setListening(false);
    try {
      r.start();
      setListening(true);
    } catch {
      onStatus(
        "The microphone could not start. Try again or type your question.",
      );
    }
  }
  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        className={listening ? "voice listening" : "voice"}
        disabled={disabled && !listening}
        aria-label={listening ? "Stop voice input" : "Ask by voice"}
        title={
          Constructor
            ? "Ask by voice"
            : "Voice may be unavailable in this browser"
        }
        onClick={start}
      >
        {listening ? <MicOff size={18} /> : <Mic size={18} />}
      </button>
      {listening && (
        <span className="voice-status" role="status">
          Listening… speak one question.{" "}
          <button
            type="button"
            onClick={() => {
              recognition.current?.abort();
              setListening(false);
            }}
          >
            Cancel
          </button>
        </span>
      )}
      {consent && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="Voice input permission"
          >
            <button
              type="button"
              className="modal-close"
              aria-label="Close voice permission"
              onClick={() => setConsent(false)}
            >
              <X size={18} />
            </button>
            <Mic size={30} />
            <h2>Talk to your workspace.</h2>
            <p>
              Your browser may send audio to its speech recognition provider.
              Kineframe receives the transcript and, if hosted AI is configured,
              sends it with the demo source, evidence, conversation and saved
              preferences to the AI service. No audio is saved by this app.
            </p>
            <p>
              Speak one question at a time. You can interrupt the agent and
              redirect it. Source changes wait for your review. Enable voice
              here before entering VR.
            </p>
            <button
              type="button"
              className="button primary wide"
              onClick={() => {
                setAccepted(true);
                setConsent(false);
                listen();
              }}
            >
              Enable voice and listen
            </button>
            <button
              type="button"
              className="button wide"
              onClick={() => setConsent(false)}
            >
              Keep typing
            </button>
          </section>
        </div>
      )}
    </>
  );
}
