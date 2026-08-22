/** Below this best-leg average visibility, show the "step back" guidance in the UI. */
export const VISIBILITY_THRESHOLD = 0.5;

/**
 * Below this (much lower) floor, landmarks are essentially not detected at all
 * (e.g. genuinely out of frame) and we skip rep-counting entirely to avoid
 * feeding garbage into the state machine. Above the floor but below
 * VISIBILITY_THRESHOLD, we still process frames — MediaPipe's per-landmark
 * confidence legitimately dips at extreme joint angles (e.g. ankles at the
 * bottom of a squat, viewed from a 30-40deg angle) even when the position is
 * still usable, and gating on the stricter threshold there was dropping
 * whole reps right at the bottom of the squat.
 */
export const PROCESSING_VISIBILITY_FLOOR = 0.15;

export interface Point3D {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

/** MediaPipe Pose landmark indices relevant to the squat check. */
export const POSE_LANDMARKS = {
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
} as const;

/** Angle at vertex B formed by rays B->A and B->C, in degrees. */
export function calculateAngle(a: Point3D, b: Point3D, c: Point3D): number {
  const abx = a.x - b.x;
  const aby = a.y - b.y;
  const abz = a.z - b.z;
  const cbx = c.x - b.x;
  const cby = c.y - b.y;
  const cbz = c.z - b.z;

  const dot = abx * cbx + aby * cby + abz * cbz;
  const magAB = Math.sqrt(abx * abx + aby * aby + abz * abz);
  const magCB = Math.sqrt(cbx * cbx + cby * cby + cbz * cbz);

  if (magAB === 0 || magCB === 0) return 0;

  const cosAngle = Math.min(1, Math.max(-1, dot / (magAB * magCB)));
  return (Math.acos(cosAngle) * 180) / Math.PI;
}

/** Which leg's hip/knee/ankle triplet to trust this frame, based on visibility. */
export type Leg = "left" | "right";

export function pickMoreVisibleLeg(landmarks: Point3D[]): Leg {
  const leftScore =
    (landmarks[POSE_LANDMARKS.LEFT_HIP]?.visibility ?? 0) +
    (landmarks[POSE_LANDMARKS.LEFT_KNEE]?.visibility ?? 0) +
    (landmarks[POSE_LANDMARKS.LEFT_ANKLE]?.visibility ?? 0);
  const rightScore =
    (landmarks[POSE_LANDMARKS.RIGHT_HIP]?.visibility ?? 0) +
    (landmarks[POSE_LANDMARKS.RIGHT_KNEE]?.visibility ?? 0) +
    (landmarks[POSE_LANDMARKS.RIGHT_ANKLE]?.visibility ?? 0);
  return rightScore > leftScore ? "right" : "left";
}

export function kneeAngleForLeg(landmarks: Point3D[], leg: Leg): number {
  const hip = landmarks[leg === "left" ? POSE_LANDMARKS.LEFT_HIP : POSE_LANDMARKS.RIGHT_HIP];
  const knee = landmarks[leg === "left" ? POSE_LANDMARKS.LEFT_KNEE : POSE_LANDMARKS.RIGHT_KNEE];
  const ankle = landmarks[leg === "left" ? POSE_LANDMARKS.LEFT_ANKLE : POSE_LANDMARKS.RIGHT_ANKLE];
  return calculateAngle(hip, knee, ankle);
}

/** knee-to-knee horizontal distance / ankle-to-ankle horizontal distance, in image space. */
export function kneeValgusRatio(landmarks: Point3D[]): number {
  const leftKnee = landmarks[POSE_LANDMARKS.LEFT_KNEE];
  const rightKnee = landmarks[POSE_LANDMARKS.RIGHT_KNEE];
  const leftAnkle = landmarks[POSE_LANDMARKS.LEFT_ANKLE];
  const rightAnkle = landmarks[POSE_LANDMARKS.RIGHT_ANKLE];

  const kneeDist = Math.abs(leftKnee.x - rightKnee.x);
  const ankleDist = Math.abs(leftAnkle.x - rightAnkle.x);

  if (ankleDist === 0) return 1;
  return kneeDist / ankleDist;
}

/** Simple rolling moving average, used to smooth jittery per-frame angle readings. */
export class MovingAverage {
  private values: number[] = [];
  private windowSize: number;

  constructor(windowSize: number = 5) {
    this.windowSize = windowSize;
  }

  add(value: number): number {
    this.values.push(value);
    if (this.values.length > this.windowSize) this.values.shift();
    return this.average();
  }

  average(): number {
    if (this.values.length === 0) return 0;
    return this.values.reduce((sum, v) => sum + v, 0) / this.values.length;
  }

  reset(): void {
    this.values = [];
  }
}

/** Best-leg average visibility across hip/knee/ankle, used to gate checks on pose confidence. */
export function lowerBodyVisibilityScore(landmarks: Point3D[]): number {
  // Use per-leg average visibility (rather than requiring both legs) since at a
  // 30-40deg angle the far leg is expected to read lower.
  const leftAvg =
    (landmarks[POSE_LANDMARKS.LEFT_HIP]?.visibility ?? 0) +
    (landmarks[POSE_LANDMARKS.LEFT_KNEE]?.visibility ?? 0) +
    (landmarks[POSE_LANDMARKS.LEFT_ANKLE]?.visibility ?? 0);
  const rightAvg =
    (landmarks[POSE_LANDMARKS.RIGHT_HIP]?.visibility ?? 0) +
    (landmarks[POSE_LANDMARKS.RIGHT_KNEE]?.visibility ?? 0) +
    (landmarks[POSE_LANDMARKS.RIGHT_ANKLE]?.visibility ?? 0);
  return Math.max(leftAvg, rightAvg) / 3;
}
