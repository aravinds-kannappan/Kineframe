import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { createPortal } from "react-dom";
import {
  Camera,
  Hand,
  LoaderCircle,
  MousePointer2,
  Move,
  MoveVertical,
  SlidersHorizontal,
  X,
} from "lucide-react";
import type { ViewControls } from "./Scene";
import { sliderValue } from "../../shared/gestures";
import { HandInput } from "../../shared/handInput";
function shouldWelcome() {
  try {
    return !sessionStorage.getItem("mindscope:camera-choice");
  } catch {
    return true;
  }
}
export default function Hands({
  controlsRef,
  mode = "orbit",
}: {
  controlsRef: MutableRefObject<ViewControls | null>;
  mode?: "orbit" | "circuit";
}) {
  const [active, setActive] = useState(false),
    [loading, setLoading] = useState(false),
    [message, setMessage] = useState(""),
    [welcome, setWelcome] = useState(shouldWelcome),
    [status, setStatus] = useState("Looking for your hand…");
  const cleanup = useRef<() => void>(() => {}),
    generation = useRef(0),
    pointer = useRef<HTMLDivElement>(null),
    videoPreview = useRef<HTMLVideoElement>(null),
    streamRef = useRef<MediaStream | null>(null);
  useEffect(
    () => () => {
      generation.current++;
      cleanup.current();
    },
    [],
  );
  async function checkTracking() {
    setLoading(true);
    setMessage(
      "Checking background tracking support without using your camera…",
    );
    let testTracker: import("./handTracker").HandTracker | undefined;
    try {
      const { createHandTracker } = await import("./handTracker");
      testTracker = await createHandTracker();
      const canvas = document.createElement("canvas");
      canvas.width = 256;
      canvas.height = 256;
      canvas.getContext("2d")!.fillRect(0, 0, 256, 256);
      await testTracker.detect(canvas, performance.now());
      setMessage(
        "Tracking engine ready. Your camera was not accessed. Enable webcam to begin.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Tracking is unavailable in this browser.",
      );
    } finally {
      testTracker?.close();
      setLoading(false);
    }
  }
  function dismiss() {
    try {
      sessionStorage.setItem("mindscope:camera-choice", "seen");
    } catch {}
    setWelcome(false);
  }
  function stop() {
    generation.current++;
    cleanup.current();
    streamRef.current = null;
    setActive(false);
    setLoading(false);
    setMessage("");
  }
  async function start() {
    const request = ++generation.current;
    setLoading(true);
    setMessage("Requesting camera access…");
    let stream: MediaStream | undefined,
      tracker: import("./handTracker").HandTracker | undefined,
      video: HTMLVideoElement | undefined,
      raf = 0;
    const teardown = () => {
      controlsRef.current?.interact?.("end", 0, 0);
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
      tracker?.close();
      tracker = undefined;
      if (video) video.srcObject = null;
    };
    cleanup.current = teardown;
    try {
      if (!navigator.mediaDevices?.getUserMedia)
        throw new Error(
          "Camera access requires HTTPS or localhost. You can still use all mouse controls.",
        );
      stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" },
        audio: false,
      });
      if (request !== generation.current) {
        teardown();
        return;
      }
      streamRef.current = stream;
      setMessage(
        "Loading hand tracking. The first download may take a moment…",
      );
      const { createHandTracker } = await import("./handTracker");
      tracker = await createHandTracker();
      if (request !== generation.current) {
        teardown();
        return;
      }
      video = document.createElement("video");
      video.muted = true;
      video.playsInline = true;
      video.srcObject = stream;
      await video.play();
      if (request !== generation.current) {
        teardown();
        return;
      }
      const input = new HandInput();
      let lastTime = -1,
        lastDetection = 0,
        lastStatus = "";
      let contact: { x: number; y: number } | null = null;
      let previous: { x: number; y: number } | null = null;
      let dragTarget: HTMLInputElement | null = null;
      let button: HTMLElement | null = null;
      let scrollTarget: HTMLElement | null = null;
      let surface = false,
        manipulating = false,
        moved = false;
      const release = (cancelled: boolean) => {
        if (manipulating) controlsRef.current?.interact?.("end", 0, 0);
        if (
          !cancelled &&
          !moved &&
          button?.isConnected &&
          !button.hasAttribute("disabled")
        )
          button.click();
        contact = previous = null;
        dragTarget = null;
        button = scrollTarget = null;
        manipulating = surface = moved = false;
      };
      const loop = async () => {
        try {
          const now = performance.now();
          if (video!.currentTime !== lastTime && now - lastDetection > 30) {
            lastDetection = now;
            lastTime = video!.currentTime;
            const detected = await tracker!.detect(video!, now);
            if (request !== generation.current) return;
            const frame = input.update(
              detected,
              performance.now(),
              innerWidth,
              innerHeight,
            );
            if (lastStatus !== frame.status) {
              lastStatus = frame.status;
              setStatus(frame.status);
            }
            if (pointer.current) {
              pointer.current.style.display = frame.point ? "block" : "none";
              if (frame.point) {
                pointer.current.style.left = `${frame.point.x}px`;
                pointer.current.style.top = `${frame.point.y}px`;
              }
              pointer.current.classList.toggle("pinching", frame.held);
            }
            for (const event of frame.events) {
              if (event.type === "zoom") {
                controlsRef.current?.zoom(event.factor);
                continue;
              }
              if (event.type === "end") {
                release(event.cancelled);
                continue;
              }
              const { x, y } = event.point;
              if (event.type === "start") {
                contact = previous = event.point;
                moved = false;
                const target = document.elementFromPoint(
                  x,
                  y,
                ) as HTMLElement | null;
                const range = target
                  ?.closest(".slider-field")
                  ?.querySelector(
                    "input[type=range]",
                  ) as HTMLInputElement | null;
                dragTarget = range && !range.disabled ? range : null;
                button = target?.closest("button,a") as HTMLElement | null;
                surface =
                  !!target?.closest(".scene-canvas") && !dragTarget && !button;
                if (surface) {
                  manipulating = !!controlsRef.current?.interact?.(
                    "start",
                    x,
                    y,
                  );
                  if (!manipulating && mode !== "circuit")
                    document.dispatchEvent(
                      new CustomEvent("mindscope:inspect", {
                        detail: { x, y },
                      }),
                    );
                }
                scrollTarget = target?.closest(
                  ".modal,.chat-log,.sandbox-side",
                ) as HTMLElement | null;
                continue;
              }
              moved ||=
                !!contact && Math.hypot(x - contact.x, y - contact.y) > 10;
              if (manipulating) controlsRef.current?.interact?.("move", x, y);
              else if (dragTarget) {
                const r = dragTarget.getBoundingClientRect();
                const value = sliderValue(
                  x,
                  r.left,
                  r.width,
                  Number(dragTarget.min),
                  Number(dragTarget.max),
                  Number(dragTarget.step) || 1,
                );
                document.dispatchEvent(
                  new CustomEvent("mindscope:hand-range", {
                    detail: { key: dragTarget.dataset.parameter, value },
                  }),
                );
              } else if (surface && previous) {
                if (controlsRef.current?.pan)
                  controlsRef.current.pan(x - previous.x, y - previous.y);
                else
                  controlsRef.current?.rotate(
                    (x - previous.x) * 0.008,
                    (y - previous.y) * 0.006,
                  );
              } else if (!button && previous) {
                const amount = previous.y - y;
                if (
                  scrollTarget &&
                  scrollTarget.scrollHeight > scrollTarget.clientHeight
                )
                  scrollTarget.scrollTop += amount;
                else window.scrollBy(0, amount);
              }
              previous = event.point;
            }
          }
          raf = requestAnimationFrame(loop);
        } catch {
          if (request !== generation.current) return;
          release(true);
          teardown();
          setActive(false);
          setMessage(
            "Tracking stopped. Try enabling the camera again, or continue with your mouse.",
          );
        }
      };
      setActive(true);
      setMessage("");
      dismiss();
      loop();
    } catch (error) {
      teardown();
      streamRef.current = null;
      if (request === generation.current)
        setMessage(
          error instanceof Error && error.name === "NotAllowedError"
            ? "Camera permission was declined. Allow it in your browser settings to try again, or continue with your mouse."
            : error instanceof Error
              ? error.message
              : "Camera or tracking unavailable. Continue with your mouse.",
        );
    } finally {
      if (request === generation.current) setLoading(false);
    }
  }
  useEffect(() => {
    if (active && videoPreview.current && streamRef.current) {
      videoPreview.current.srcObject = streamRef.current;
      videoPreview.current.play().catch(() => {});
    }
  }, [active, welcome]);
  return (
    <>
      <div className="hands">
        <button
          className={`small-button ${active ? "selected" : ""}`}
          onClick={() => setWelcome(true)}
        >
          <Hand size={15} />
          {active ? "Hands on" : "Hand controls"}
        </button>
        {message && !welcome && <span role="status">{message}</span>}
      </div>
      {createPortal(
        <>
          {active && (
            <>
              <div
                ref={pointer}
                className="hand-pointer"
                style={{ display: "none" }}
              />
              <div className="hand-status">
                <Hand size={17} />
                <span aria-live="polite">{status}</span>
                <button onClick={() => setWelcome(true)}>Help</button>
                <button onClick={stop}>Stop camera</button>
              </div>
            </>
          )}
          {welcome && (
            <div className="modal-backdrop">
              <section
                className="modal camera-choice"
                role="dialog"
                aria-modal="true"
                aria-label="Choose how to explore"
              >
                <button
                  className="modal-close icon-button"
                  aria-label="Close camera introduction"
                  disabled={loading}
                  onClick={dismiss}
                >
                  <X size={20} />
                </button>
                <span className="modal-symbol">
                  <Hand size={28} />
                </span>
                <div className="eyebrow">IDEAS YOU CAN MOVE. LITERALLY.</div>
                <h2>Your hands are the controls.</h2>
                <p>
                  Want to explore with your webcam? Move through the lab, open
                  concepts, and shape experiments with a gesture.
                </p>
                <div className="gesture-list">
                  <div>
                    <MousePointer2 size={19} />
                    <span>
                      Point to aim. Pinch and release to tap.
                      <small>
                        Keep one hand in view. A tap stays on the target you
                        aimed at.
                      </small>
                    </span>
                  </div>
                  <div>
                    <SlidersHorizontal size={19} />
                    <span>
                      Pinch a slider, then move sideways.
                      <small>
                        Change speed, gravity, resistance, and learning rate.
                      </small>
                    </span>
                  </div>
                  <div>
                    <Move size={19} />
                    <span>
                      {mode === "circuit"
                        ? "Pinch a component and move."
                        : "Pinch the scene and move."}
                      <small>
                        {mode === "circuit"
                          ? "Hold to drag a component. Tap two terminals to wire them. Drag empty space to pan."
                          : "Rotate the 3D experiment to see a new perspective."}
                      </small>
                    </span>
                  </div>
                  <div>
                    <MoveVertical size={19} />
                    <span>
                      Pinch with both hands to zoom.
                      <small>
                        Spread your hands to zoom in; bring them together to
                        zoom out. Open both hands before the next gesture.
                      </small>
                    </span>
                  </div>
                </div>
                <p className="privacy-note">
                  Like touch controls: hold to drag, release to stop. Drag a
                  panel to scroll. If tracking pauses, open your fingers to
                  resume. Camera access is optional. Frames are processed on
                  this device and never sent to the room or tutor. Tracking
                  files download on first use. You can stop the camera anytime.
                </p>
                {message && (
                  <p className="camera-error" role="status">
                    {message}
                  </p>
                )}
                {active && (
                  <video
                    className="camera-video"
                    ref={videoPreview}
                    muted
                    playsInline
                  />
                )}
                <button
                  className="button primary wide"
                  disabled={loading}
                  onClick={active ? dismiss : start}
                >
                  {loading ? (
                    <LoaderCircle size={17} className="spin" />
                  ) : (
                    <Camera size={17} />
                  )}{" "}
                  {loading
                    ? "Setting up hand controls…"
                    : active
                      ? "Continue with hand controls"
                      : "Enable webcam & explore"}
                </button>
                <button
                  className="button secondary wide"
                  onClick={() => {
                    if (loading) stop();
                    if (active) stop();
                    dismiss();
                  }}
                >
                  Continue with mouse & keyboard
                </button>
                {!active && (
                  <button
                    type="button"
                    className="text-button"
                    style={{ margin: "16px auto 0" }}
                    disabled={loading}
                    onClick={checkTracking}
                  >
                    Check tracking compatibility (no camera)
                  </button>
                )}
              </section>
            </div>
          )}
        </>,
        document.body,
      )}
    </>
  );
}
