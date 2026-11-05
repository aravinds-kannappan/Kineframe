import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";
let tracker: HandLandmarker | null = null;
const scope = self as unknown as {
  onmessage: ((event: MessageEvent) => void) | null;
  postMessage: (message: unknown) => void;
};
scope.onmessage = async (event) => {
  const message = event.data;
  try {
    if (message.type === "init") {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm",
      );
      // MediaPipe's module loader explicitly exports ModuleFactory into the worker scope.
      // The classic loader only declares a module-local variable when dynamically imported.
      vision.wasmLoaderPath =
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm/vision_wasm_module_internal.js";
      vision.wasmBinaryPath =
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm/vision_wasm_module_internal.wasm";
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
      scope.postMessage({ type: "ready" });
    } else if (message.type === "frame") {
      try {
        if (!tracker) throw new Error("Tracker not initialized");
        scope.postMessage({
          type: "result",
          landmarks: tracker.detectForVideo(message.bitmap, message.time)
            .landmarks,
        });
      } finally {
        message.bitmap.close();
      }
    }
  } catch (error) {
    scope.postMessage({
      type: "error",
      message:
        error instanceof Error
          ? error.message.slice(0, 400)
          : "Hand tracking could not initialize or process a frame.",
    });
  }
};
