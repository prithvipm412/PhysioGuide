import { useCallback, useRef, useState } from "react";
import {
  MovingAverage,
  VISIBILITY_THRESHOLD,
  kneeAngleForLeg,
  kneeValgusRatio,
  lowerBodyVisibilityScore,
  pickMoreVisibleLeg,
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

  const processFrame = useCallback((landmarks: Point3D[]) => {
    const visibility = lowerBodyVisibilityScore(landmarks);
    const visible = visibility >= VISIBILITY_THRESHOLD;
    setIsBodyVisible(visible);
    if (!visible) return;

    const leg = pickMoreVisibleLeg(landmarks);
    const rawAngle = kneeAngleForLeg(landmarks, leg);
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
