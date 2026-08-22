import { useCallback, useRef, useState } from "react";
import {
  MovingAverage,
  PROCESSING_VISIBILITY_FLOOR,
  VISIBILITY_THRESHOLD,
  kneeAngleForLeg,
  kneeValgusRatio,
  lowerBodyVisibilityScore,
  pickMoreVisibleLeg,
  type Leg,
  type Point3D,
} from "../lib/angles";
import {
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
    const rawAngle = kneeAngleForLeg(landmarks, lockedLegRef.current);
    const smoothedAngle = movingAverageRef.current.add(rawAngle);
    const valgusRatio = kneeValgusRatio(landmarks);

    const { state, completedRep } = stepSquatStateMachine(
      stateRef.current,
      smoothedAngle,
      valgusRatio
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
    lockedLegRef.current = null;
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
