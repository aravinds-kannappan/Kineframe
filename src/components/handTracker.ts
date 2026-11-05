import type { Landmark } from "../../shared/gestures";
export type HandTracker = {
  detect: (video: ImageBitmapSource, time: number) => Promise<Landmark[][]>;
  close: () => void;
};
/** One transferred frame in flight; inference never blocks Three.js or pointer input. */
export async function createHandTracker(): Promise<HandTracker> {
  const worker = new Worker(
    new URL("./handTracking.worker.ts", import.meta.url),
    { type: "module" },
  );
  let closed = false,
    pending: {
      resolve: (hands: Landmark[][]) => void;
      reject: (error: Error) => void;
    } | null = null;
  let readyResolve: () => void = () => {},
    readyReject: (error: Error) => void = () => {};
  const ready = new Promise<void>((resolve, reject) => {
    readyResolve = resolve;
    readyReject = reject;
  });
  const timeout = setTimeout(() => {
    readyReject(
      new Error(
        "Hand tracking download timed out. Check your connection and try again.",
      ),
    );
  }, 45000);
  worker.onmessage = (e) => {
    if (e.data.type === "ready") {
      clearTimeout(timeout);
      readyResolve();
    } else if (e.data.type === "result") {
      pending?.resolve(e.data.landmarks);
      pending = null;
    } else if (e.data.type === "error") {
      const error = new Error(e.data.message);
      readyReject(error);
      pending?.reject(error);
      pending = null;
    }
  };
  worker.onerror = () => {
    const error = new Error(
      "This browser could not start background hand tracking. Mouse controls remain available.",
    );
    readyReject(error);
    pending?.reject(error);
    pending = null;
  };
  worker.postMessage({ type: "init" });
  try {
    await ready;
  } catch (error) {
    clearTimeout(timeout);
    worker.terminate();
    throw error;
  }
  return {
    async detect(video, time) {
      if (closed) throw new Error("Tracker closed");
      if (pending) throw new Error("Frame already pending");
      const bitmap = await createImageBitmap(video);
      if (closed) {
        bitmap.close();
        throw new Error("Tracker closed");
      }
      return new Promise<Landmark[][]>((resolve, reject) => {
        pending = { resolve, reject };
        worker.postMessage({ type: "frame", bitmap, time }, [bitmap]);
      });
    },
    close() {
      closed = true;
      worker.terminate();
      pending?.reject(new Error("Tracker closed"));
      pending = null;
      clearTimeout(timeout);
    },
  };
}
