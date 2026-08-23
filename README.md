# Movement & Rehab Form Coach

Ever done physical therapy exercises at home and wondered if you're actually doing them right? That's the gap this project tries to close. It's a browser app that watches you through your webcam while you squat and gives you real-time feedback on your form — the kind of correction a physiotherapist would normally give you in person, for the moments when there's no one there to give it.

Everything happens locally in your browser. Your camera feed is never uploaded anywhere — no server, no cloud, no account.

> **This is a coaching and monitoring tool, not a medical device.** It doesn't diagnose injuries and it isn't a substitute for advice from an actual physical therapist or doctor. Think of it as a mirror with an opinion, not a clinician.

## Why this exists

Rehab only works if the exercises are done correctly. Two of the most common mistakes people make with squats — letting the knees cave inward and not going deep enough — are exactly the kind of thing that's easy to do without noticing and easy for someone else to catch instantly just by looking at you. This project tries to be that second pair of eyes when you're doing your exercises alone.

## What it does

- Turns on your webcam and overlays a live skeleton on top of you, tracking 33 body landmarks in real time
- Counts your squat reps automatically, based on the angle of your knee as you go up and down
- Flags two common form mistakes as they happen:
  - **Knees caving in** (valgus) — comparing knee-to-knee spacing against ankle-to-ankle spacing at the bottom of the rep
  - **Not squatting deep enough** — a rep that never gets low enough gets marked instead of counted clean
- Shows a running tally of clean vs. flagged reps while you work out
- A short countdown after you hit "Start Session" so you have time to get into position before it starts counting

## How it works

1. The browser asks for webcam access and streams the live video into the page.
2. [MediaPipe Tasks Vision](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker)'s `PoseLandmarker` (the lightweight "lite" model, running in `VIDEO` mode) detects 33 body landmarks per frame — entirely inside the browser via WebAssembly, no server round-trip involved.
3. Each frame, the app figures out which leg (left or right) is more clearly visible to the camera and locks onto it for the rest of that rep, so a flickery visibility reading mid-squat can't corrupt the count.
4. It computes the hip-knee-ankle angle for that leg, smoothed over a short rolling window to cancel out landmark jitter.
5. Because knee angle alone reads well from a side-on camera but gets noisy from straight-on angles (the thigh and shin foreshorten toward the camera), the app also tracks a second signal: how much the person's overall height (shoulder-to-ankle) drops as they squat. Either signal crossing its threshold is enough to register "at the bottom of the rep," so depth detection holds up from the side, the front, or anywhere in between.
6. A small state machine (`standing → descending → bottom → ascending → standing`) turns that stream of angles into rep counts, using bone-length consistency (thigh/shin length can't actually change mid-squat) to throw out frames where a landmark clearly got misplaced — usually because an arm swung in front of the leg.
7. The skeleton overlay and on-screen cues reflect the current form assessment live, and ending a session shows total reps, clean vs. flagged reps, and a breakdown by error type.

## Tech stack

| | |
|---|---|
| Framework | React + TypeScript, built with Vite |
| Pose detection | [`@mediapipe/tasks-vision`](https://www.npmjs.com/package/@mediapipe/tasks-vision) (`PoseLandmarker`, `VIDEO` mode) |
| Styling | Tailwind CSS |
| Animation | Framer Motion |
| Backend | None — pose detection, rep counting, and form checks all run client-side |
| Hosting | Vercel |

## Getting started

You'll need [Node.js](https://nodejs.org/) and a webcam. Chrome is recommended — camera APIs and WASM performance are most consistent there.

```bash
npm install
npm run dev
```

Then open the printed `localhost` URL in Chrome and allow camera access when prompted.

Other useful commands:

```bash
npm run build    # type-check and build for production
npm run lint     # run the linter
npm run preview  # preview the production build locally
```

## Setting up your camera for a session

The app needs a wider view than a typical "sitting at your laptop" webcam framing gives you:

- **Distance** — stand back far enough that your whole body, head to feet, is in frame. Usually 6–8 feet back from a laptop webcam.
- **Angle** — roughly 30–40° off dead-front (a three-quarter view) works best, rather than either fully side-on or dead straight-on. It balances squat-depth accuracy (best from the side) against the knee-valgus check (best from the front) — though the app now also uses a body-height signal as a fallback for depth, so it's more forgiving of camera angle than knee-angle tracking alone.
- **Lighting** — even lighting helps a lot, and it's best if only one person is in frame at a time.

If the app can't see your hips, knees, and ankles with reasonable confidence, it'll tell you to step back rather than silently guessing.

## Project structure

```
src/
  components/
    CameraFeed.tsx       # camera access + <video> element
    PoseOverlay.tsx       # canvas skeleton drawing
  hooks/
    useRepCounter.ts      # rep counting + form-check state, wired to the state machine
  lib/
    poseLandmarker.ts     # MediaPipe model loading
    angles.ts             # joint-angle math, visibility scoring, depth signals
    squatStateMachine.ts  # the standing/descending/bottom/ascending state machine
  App.tsx                # ties the camera, overlay, and rep counter together
```

## Status

Squats are the only exercise implemented right now — the plan is to get this working well end-to-end before considering a second one. Rep counting and the form-error thresholds have been tuned iteratively against real test sessions (side angle, frontal angle, deliberately bad reps) rather than guessed and left alone, and that process is still ongoing.

## Demo

_A live deployed link will go here once it's up._
