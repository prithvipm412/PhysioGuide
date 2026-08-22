import { useCallback, useRef, useState } from "react";
import {
  HEIGHT_DROP_RATIO,
  LEG_LENGTH_TOLERANCE,
  MovingAverage,
  PROCESSING_VISIBILITY_FLOOR,
  VISIBILITY_THRESHOLD,
  bodyHeightProxy,
  kneeAngleForLeg,
  kneeValgusRatio,
  legSegmentLengths,
  lowerBodyVisibilityScore,
  pickMoreVisibleLeg,
  type Leg,
  type LegSegmentLengths,
  type Point3D,
} from "../lib/angles";
import {
  THRESHOLDS,
  initialSquatState,
  stepSquatStateMachine,
  type CompletedRep,
  type SquatPhase,
} from "../lib/squatStateMachine";

export interface RepCounterState {
  phase: SquatPhase;
  kneeAngle: number;
  isBodyVisible: boolean;
  reps: CompletedRep[];
  repCount: number;
  cleanReps: number;
  flaggedReps: number;
}

export function useRepCounter() {
  const [phase, setPhase] = useState<SquatPhase>("standing");
  const [kneeAngle, setKneeAngle] = useState(180);
  const [isBodyVisible, setIsBodyVisible] = useState(false);
  const [reps, setReps] = useState<CompletedRep[]>([]);

  const stateRef = useRef(initialSquatState);
  const movingAverageRef = useRef(new MovingAverage(5));
  // Locked for the duration of a rep so a frame-to-frame visibility flicker
  // between legs can't feed the smoother two different physical angles
  // mid-rep. Only re-evaluated while at rest ("standing").
  const lockedLegRef = useRef<Leg | null>(null);
  // Established while standing (arms typically at rest, pose most stable) and
  // used to reject frames where a landmark got occluded mid-rep — e.g. an arm
  // swinging in front of the knee — since real bone length can't change.
  const referenceLegLengthRef = useRef<LegSegmentLengths | null>(null);
  // Standing-height reference (shoulder-to-ankle) for the body-height depth
  // signal, and a separate smoother so it isn't blended with the angle signal.
  const referenceHeightRef = useRef<number | null>(null);
  const heightMovingAverageRef = useRef(new MovingAverage(5));

  /**
   * `active` gates only the rep-counting logic (state machine, angle
   * smoothing, leg lock) — visibility is always measured and published so the
   * "step back" guidance works before a session starts, while movement during
   * idle/countdown (e.g. walking into position) can't corrupt the state
   * machine before the first real rep.
   */
  const processFrame = useCallback((landmarks: Point3D[], active: boolean) => {
    const visibility = lowerBodyVisibilityScore(landmarks);
    setIsBodyVisible(visibility >= VISIBILITY_THRESHOLD);
    if (!active || visibility < PROCESSING_VISIBILITY_FLOOR) return;

    if (stateRef.current.phase === "standing" || !lockedLegRef.current) {
      lockedLegRef.current = pickMoreVisibleLeg(landmarks);
    }
    const leg = lockedLegRef.current;

    const { thigh, shin } = legSegmentLengths(landmarks, leg);
    const reference = referenceLegLengthRef.current;
    if (stateRef.current.phase === "standing") {
      referenceLegLengthRef.current = reference
        ? { thigh: reference.thigh * 0.9 + thigh * 0.1, shin: reference.shin * 0.9 + shin * 0.1 }
        : { thigh, shin };
    } else if (reference) {
      const thighOff = Math.abs(thigh - reference.thigh) / reference.thigh;
      const shinOff = Math.abs(shin - reference.shin) / reference.shin;
      if (thighOff > LEG_LENGTH_TOLERANCE || shinOff > LEG_LENGTH_TOLERANCE) {
        return; // landmark almost certainly occluded/misplaced this frame — skip it
      }
    }

    const rawAngle = kneeAngleForLeg(landmarks, leg);
    const smoothedAngle = movingAverageRef.current.add(rawAngle);
    const valgusRatio = kneeValgusRatio(landmarks);

    const height = bodyHeightProxy(landmarks);
    if (stateRef.current.phase === "standing") {
      referenceHeightRef.current = referenceHeightRef.current
        ? referenceHeightRef.current * 0.9 + height * 0.1
        : height;
    }
    const heightRatio = referenceHeightRef.current ? height / referenceHeightRef.current : 1;
    const smoothedHeightRatio = heightMovingAverageRef.current.add(heightRatio);

    // Either signal reaching depth is enough — knee angle from the side,
    // body-height drop from the front, so depth detection works either way.
    const atDepth =
      smoothedAngle < THRESHOLDS.BOTTOM_ANGLE || smoothedHeightRatio < HEIGHT_DROP_RATIO;

    const { state, completedRep } = stepSquatStateMachine(
      stateRef.current,
      smoothedAngle,
      valgusRatio,
      atDepth
    );
    stateRef.current = state;

    setPhase(state.phase);
    setKneeAngle(smoothedAngle);
    if (completedRep) {
      setReps((prev) => [...prev, completedRep]);
    }
  }, []);

  const reset = useCallback(() => {
    stateRef.current = initialSquatState;
    movingAverageRef.current.reset();
    heightMovingAverageRef.current.reset();
    lockedLegRef.current = null;
    referenceLegLengthRef.current = null;
    referenceHeightRef.current = null;
    setPhase("standing");
    setKneeAngle(180);
    setReps([]);
  }, []);

  const cleanReps = reps.filter((r) => r.clean).length;

  return {
    processFrame,
    reset,
    phase,
    kneeAngle,
    isBodyVisible,
    reps,
    repCount: reps.length,
    cleanReps,
    flaggedReps: reps.length - cleanReps,
  };
}
