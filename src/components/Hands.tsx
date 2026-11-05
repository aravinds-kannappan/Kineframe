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
import {
  gesture,
  sliderValue,
  stabilizePointer,
  zoomRatio,
} from "../../shared/gestures";
function shouldWelcome() {
  try {
    return !sessionStorage.getItem("mindscope:camera-choice");
  } catch {
    return true;
  }
}
export default function Hands({
  controlsRef,
}: {
  controlsRef: MutableRefObject<ViewControls | null>;
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
      tracker: import("@mediapipe/tasks-vision").HandLandmarker | undefined,
      video: HTMLVideoElement | undefined,
      raf = 0;
    const teardown = () => {
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
      const { FilesetResolver, HandLandmarker } =
        await import("@mediapipe/tasks-vision");
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm",
      );
      tracker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
        },
        runningMode: "VIDEO",
        numHands: 2,
        minHandDetectionConfidence: 0.6,
        minTrackingConfidence: 0.6,
      });
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
      let lastTime = -1,
        lastDetection = 0,
        wasPinching = false,
        previous: { x: number; y: number } | null = null,
        dragTarget: HTMLInputElement | null = null,
        orbiting = false,
        smooth: { x: number; y: number } | null = null,
        lastClick = 0,
        lastRange = 0,
        lastStatus = "",
        zoomDistance: number | null = null,
        lastFrame = 0;
      const report = (text: string) => {
        if (lastStatus !== text) {
          lastStatus = text;
          setStatus(text);
        }
      };
      const loop = () => {
        try {
          const now = performance.now();
          if (video!.currentTime !== lastTime && now - lastDetection > 45) {
            lastDetection = now;
            lastTime = video!.currentTime;
            const detected = tracker!.detectForVideo(video!, now).landmarks;
            const hand = detected[0];
            if (
              detected.length === 2 &&
              detected.every((h) => gesture(h, true).pinch)
            ) {
              const distance = Math.hypot(
                detected[0][9].x - detected[1][9].x,
                detected[0][9].y - detected[1][9].y,
              );
              if (
                zoomDistance !== null &&
                Math.abs(distance - zoomDistance) > 0.003
              )
                controlsRef.current?.zoom(zoomRatio(zoomDistance, distance));
              zoomDistance = distance;
              previous = null;
              wasPinching = true;
              smooth = null;
              if (pointer.current) pointer.current.style.display = "none";
              report(
                "Two-hand zoom: spread to zoom in · bring together to zoom out",
              );
              raf = requestAnimationFrame(loop);
              return;
            }
            zoomDistance = null;
            if (hand) {
              const g = gesture(hand, wasPinching);
              const next = { x: g.x * innerWidth, y: g.y * innerHeight };
              smooth = stabilizePointer(smooth, next, now - lastFrame || 45);
              lastFrame = now;
              const { x, y } = smooth;
              if (pointer.current) {
                pointer.current.style.display = "block";
                pointer.current.style.left = `${x}px`;
                pointer.current.style.top = `${y}px`;
                pointer.current.classList.toggle("pinching", g.pinch);
              }
              const target = document.elementFromPoint(
                x,
                y,
              ) as HTMLElement | null;
              if (g.scroll) {
                if (previous) {
                  const scrollable = target?.closest(".modal,.chat-log");
                  const amount = (y - previous.y) * 2.5;
                  if (target?.closest(".scene-canvas"))
                    controlsRef.current?.zoom(
                      Math.exp(
                        Math.max(
                          -0.045,
                          Math.min(0.045, (y - previous.y) * 0.008),
                        ),
                      ),
                    );
                  else if (scrollable) scrollable.scrollTop += amount;
                  else window.scrollBy(0, amount);
                }
                report(
                  target?.closest(".scene-canvas")
                    ? "Two fingers over scene: move up to zoom in, down to zoom out"
                    : "Two fingers: move up or down to scroll",
                );
              } else if (g.pinch) {
                if (!wasPinching) {
                  const range = target
                    ?.closest(".slider-field")
                    ?.querySelector(
                      "input[type=range]",
                    ) as HTMLInputElement | null;
                  dragTarget = range && !range.disabled ? range : null;
                  orbiting = !!target?.closest(".scene-canvas") && !dragTarget;
                  if (orbiting)
                    document.dispatchEvent(
                      new CustomEvent("mindscope:inspect", {
                        detail: { x, y },
                      }),
                    );
                  if (!dragTarget && !orbiting && now - lastClick > 650) {
                    const button = target?.closest(
                      "button,a",
                    ) as HTMLElement | null;
                    if (button && !button.hasAttribute("disabled")) {
                      button.click();
                      lastClick = now;
                    }
                  }
                }
                if (dragTarget && now - lastRange > 75) {
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
                  lastRange = now;
                  report("Pinch held: move sideways to adjust");
                } else if (orbiting && previous) {
                  controlsRef.current?.rotate(
                    (x - previous.x) * 0.008,
                    (y - previous.y) * 0.006,
                  );
                  report("Pinch held: move to rotate the scene");
                } else
                  report(
                    "Selected. Release your pinch before selecting again.",
                  );
              } else {
                dragTarget = null;
                orbiting = false;
                report(
                  "Point to aim · pinch to select · two fingers to scroll",
                );
              }
              previous = smooth;
              wasPinching = g.pinch;
            } else {
              if (pointer.current) pointer.current.style.display = "none";
              previous = null;
              smooth = null;
              wasPinching = false;
              dragTarget = null;
              orbiting = false;
              report("Raise one hand into view. Good lighting helps.");
            }
          }
          raf = requestAnimationFrame(loop);
        } catch {
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
                      Point to aim. Pinch to select.
                      <small>
                        Open a concept, press a button, or launch an experiment.
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
                      Pinch the scene and move.
                      <small>
                        Rotate the 3D experiment to see a new perspective.
                      </small>
                    </span>
                  </div>
                  <div>
                    <MoveVertical size={19} />
                    <span>
                      Two fingers to zoom or scroll.
                      <small>
                        Over the scene: zoom. Elsewhere: scroll. Or pinch with
                        both hands and spread.
                      </small>
                    </span>
                  </div>
                </div>
                <p className="privacy-note">
                  Camera access is optional. Frames are processed on this device
                  and never sent to the room or tutor. Tracking files download
                  on first use. You can stop the camera anytime.
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
              </section>
            </div>
          )}
        </>,
        document.body,
      )}
    </>
  );
}
