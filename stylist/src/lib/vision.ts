// Загрузка моделей MediaPipe (лицо, поза + силуэт). Работают в браузере, фото никуда не отправляются.
import type { FaceLandmarker, PoseLandmarker } from "@mediapipe/tasks-vision";

const WASM = "/mediapipe/wasm";
const FACE_MODEL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const POSE_MODEL = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task";

let face: Promise<FaceLandmarker> | null = null;
let pose: Promise<PoseLandmarker> | null = null;

async function withDelegate<T>(make: (delegate: "GPU" | "CPU") => Promise<T>): Promise<T> {
  try {
    return await make("GPU");
  } catch {
    return make("CPU");
  }
}

export function getFaceLandmarker(): Promise<FaceLandmarker> {
  if (!face) {
    face = (async () => {
      const { FilesetResolver, FaceLandmarker } = await import("@mediapipe/tasks-vision");
      const fs = await FilesetResolver.forVisionTasks(WASM);
      return withDelegate((delegate) =>
        FaceLandmarker.createFromOptions(fs, {
          baseOptions: { modelAssetPath: FACE_MODEL, delegate },
          runningMode: "IMAGE",
          numFaces: 1,
          outputFacialTransformationMatrixes: true,
        }),
      );
    })();
    face.catch(() => (face = null));
  }
  return face;
}

export function getPoseLandmarker(): Promise<PoseLandmarker> {
  if (!pose) {
    pose = (async () => {
      const { FilesetResolver, PoseLandmarker } = await import("@mediapipe/tasks-vision");
      const fs = await FilesetResolver.forVisionTasks(WASM);
      return withDelegate((delegate) =>
        PoseLandmarker.createFromOptions(fs, {
          baseOptions: { modelAssetPath: POSE_MODEL, delegate },
          runningMode: "IMAGE",
          numPoses: 1,
          outputSegmentationMasks: true,
        }),
      );
    })();
    pose.catch(() => (pose = null));
  }
  return pose;
}
