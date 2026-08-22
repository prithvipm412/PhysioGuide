# Movement & Rehab Form Coach

## Problem

People doing prescribed home exercises (e.g. post-knee-injury rehab) usually
have no one there to correct their form. Bad form during rehab exercises like
squats — especially knees caving in or not reaching proper depth — can slow
recovery or cause re-injury, and most people can't tell it's happening from
the inside.

## Solution

A browser-based coach that watches you through your webcam while you do
squats and gives real-time feedback the way a physiotherapist would: counting
reps, flagging knees-caving-in and insufficient-depth errors as they happen,
and giving a session summary at the end.

**This is a coaching/monitoring tool, not a diagnostic or medical device.**
It does not diagnose injuries or replace professional medical or physical
therapy advice.

Everything runs client-side — no video ever leaves your device.

## How it works

1. The browser requests webcam access and streams live video into the page.
2. [MediaPipe Tasks Vision](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker)'s
   `PoseLandmarker` (lite model, running in `VIDEO` mode) detects 33 body
   landmarks per frame, entirely in-browser via WASM — no server round trip.
3. For each frame, the app picks whichever leg (left/right) has the higher
   landmark-visibility score, and computes the hip-knee-ankle angle for that
   leg, smoothed over a short rolling window to reduce jitter.
4. A state machine (`standing → descending → bottom → ascending → standing`)
   turns that angle stream into rep counts, and flags:
   - **Knees caving in** — knee-to-knee horizontal distance vs. ankle-to-ankle
     horizontal distance at the bottom of the rep.
   - **Insufficient depth** — a rep that never crosses the bottom-angle
     threshold.
5. The skeleton overlay and on-screen cues reflect the current form
   assessment in real time; ending a session shows total reps, clean vs.
   flagged reps, and a breakdown by error type.

## Tech stack

- React + TypeScript, built with Vite
- Pose detection: `@mediapipe/tasks-vision` (`PoseLandmarker`, `VIDEO` mode)
- Styling: Tailwind CSS
- Animation: Framer Motion
- No backend — pose detection, rep counting, and form checks all run in the
  browser
- Deployed on Vercel

## Camera setup

- **Distance:** stand back far enough that your whole body (head to feet) is
  in frame — usually 6–8 feet on a laptop webcam.
- **Angle:** roughly 30–40° off dead-front (a 3/4 view), not straight-on and
  not full side-profile. This balances squat-depth accuracy (best from the
  side) against the knee-valgus check (best from the front).
- **Lighting:** even lighting helps; keep other people out of frame.

## Demo link

_TBD — added after deployment._

## Status

Squats are the only exercise implemented. Built in phases (pipeline proof →
rep counting → form-error rules → feedback UI/session summary → polish &
deploy), with rep-counting and form-error thresholds tuned against real
human test sessions rather than guessed.
