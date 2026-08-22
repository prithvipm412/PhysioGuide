import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";

// Loaded from jsdelivr/Google's CDN for now. If venue wifi is a risk before a
// demo, download these into /public and point these paths at local files instead.
const WASM_BASE_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm";
const MODEL_ASSET_PATH =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

let landmarkerPromise: Promise<PoseLandmarker> | null = null;

async function createPoseLandmarker(): Promise<PoseLandmarker> {
  const vision = await FilesetResolver.forVisionTasks(WASM_BASE_URL);

  try {
    return await PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: MODEL_ASSET_PATH,
        delegate: "GPU",
      },
      runningMode: "VIDEO",
      numPoses: 1,
    });
  } catch (err) {
    // GPU delegate isn't available on every device/browser combo — fall back to CPU.
    console.warn("GPU delegate failed for PoseLandmarker, falling back to CPU", err);
    return PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: MODEL_ASSET_PATH,
        delegate: "CPU",
      },
      runningMode: "VIDEO",
      numPoses: 1,
    });
  }
}

/** Lazily creates (once) and returns the shared PoseLandmarker instance. */
export function getPoseLandmarker(): Promise<PoseLandmarker> {
  if (!landmarkerPromise) {
    landmarkerPromise = createPoseLandmarker();
  }
  return landmarkerPromise;
}
