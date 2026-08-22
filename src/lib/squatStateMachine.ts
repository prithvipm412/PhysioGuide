export type SquatPhase = "standing" | "descending" | "bottom" | "ascending";

export const THRESHOLDS = {
  /** Angle above which the leg is considered fully extended / "standing". */
  STANDING_ANGLE: 160,
  /** Angle below which a rep is considered to have reached full depth. Provisional — tune from real human-test feedback only. */
  BOTTOM_ANGLE: 100,
  /** knee-to-knee / ankle-to-ankle horizontal distance ratio below which knees are "caving in". Provisional. */
  KNEE_VALGUS_RATIO: 0.8,
};

export type RepErrorType = "insufficient_depth" | "knee_valgus";

export interface CompletedRep {
  clean: boolean;
  errors: RepErrorType[];
  minAngle: number;
}

export interface SquatState {
  phase: SquatPhase;
  reachedBottom: boolean;
  kneeValgusFlagged: boolean;
  minAngleThisRep: number;
}

export const initialSquatState: SquatState = {
  phase: "standing",
  reachedBottom: false,
  kneeValgusFlagged: false,
  minAngleThisRep: 180,
};

export interface SquatStepResult {
  state: SquatState;
  completedRep: CompletedRep | null;
}

/**
 * One state-machine step. `kneeValgusRatio` should be the current frame's
 * knee-to-knee / ankle-to-ankle ratio; it's only consulted while at depth
 * (the check is defined "at the bottom of the rep"). `atDepth` is a combined
 * signal (knee angle OR body-height drop) so depth detection stays reliable
 * regardless of camera angle — knee angle alone is noisy from a frontal view.
 */
export function stepSquatStateMachine(
  state: SquatState,
  smoothedKneeAngle: number,
  currentKneeValgusRatio: number,
  atDepth: boolean
): SquatStepResult {
  const { STANDING_ANGLE, KNEE_VALGUS_RATIO } = THRESHOLDS;

  switch (state.phase) {
    case "standing": {
      if (smoothedKneeAngle < STANDING_ANGLE) {
        return {
          state: {
            phase: "descending",
            reachedBottom: false,
            kneeValgusFlagged: false,
            minAngleThisRep: smoothedKneeAngle,
          },
          completedRep: null,
        };
      }
      return { state, completedRep: null };
    }

    case "descending": {
      const minAngleThisRep = Math.min(state.minAngleThisRep, smoothedKneeAngle);

      if (atDepth) {
        const kneeValgusFlagged =
          state.kneeValgusFlagged || currentKneeValgusRatio < KNEE_VALGUS_RATIO;
        return {
          state: { phase: "bottom", reachedBottom: true, kneeValgusFlagged, minAngleThisRep },
          completedRep: null,
        };
      }

      if (smoothedKneeAngle > STANDING_ANGLE) {
        // Went back up without ever reaching depth — a shallow rep.
        return {
          state: { ...initialSquatState },
          completedRep: {
            clean: false,
            errors: ["insufficient_depth"],
            minAngle: minAngleThisRep,
          },
        };
      }

      return { state: { ...state, minAngleThisRep }, completedRep: null };
    }

    case "bottom": {
      const minAngleThisRep = Math.min(state.minAngleThisRep, smoothedKneeAngle);
      const kneeValgusFlagged =
        state.kneeValgusFlagged || currentKneeValgusRatio < KNEE_VALGUS_RATIO;

      if (!atDepth) {
        return {
          state: { phase: "ascending", reachedBottom: true, kneeValgusFlagged, minAngleThisRep },
          completedRep: null,
        };
      }

      return {
        state: { ...state, kneeValgusFlagged, minAngleThisRep },
        completedRep: null,
      };
    }

    case "ascending": {
      const minAngleThisRep = Math.min(state.minAngleThisRep, smoothedKneeAngle);

      if (atDepth) {
        // Dipped back down (flicker near the bottom threshold) — back to "bottom".
        return {
          state: { ...state, phase: "bottom", minAngleThisRep },
          completedRep: null,
        };
      }

      if (smoothedKneeAngle > STANDING_ANGLE) {
        const errors: RepErrorType[] = [];
        if (!state.reachedBottom) errors.push("insufficient_depth");
        if (state.kneeValgusFlagged) errors.push("knee_valgus");

        return {
          state: { ...initialSquatState },
          completedRep: { clean: errors.length === 0, errors, minAngle: minAngleThisRep },
        };
      }

      return { state: { ...state, minAngleThisRep }, completedRep: null };
    }
  }
}
