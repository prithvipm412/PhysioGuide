import type { PoseLandmarker } from "@mediapipe/tasks-vision";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { CameraFeed } from "./components/CameraFeed";
import { PoseOverlay, type FormStatusColor } from "./components/PoseOverlay";
import { useRepCounter } from "./hooks/useRepCounter";
import type { Point3D } from "./lib/angles";
import { getPoseLandmarker } from "./lib/poseLandmarker";

const COUNTDOWN_SECONDS = 5;

type SessionState = "idle" | "countdown" | "active";

// Live red/amber error-driven coloring lands in Phase 3 (form-error rules);
// for now the skeleton just reflects rep phase so Phase 1/2 stay in scope.
function statusColorForPhase(phase: string): FormStatusColor {
  if (phase === "bottom") return "amber";
  return "green";
}

export default function App() {
  const videoElRef = useRef<HTMLVideoElement | null>(null);
  const [videoReady, setVideoReady] = useState(false);
  const [videoDims, setVideoDims] = useState({ width: 0, height: 0 });

  const [landmarker, setLandmarker] = useState<PoseLandmarker | null>(null);
  const [modelError, setModelError] = useState<string | null>(null);

  const [drawLandmarks, setDrawLandmarks] = useState<Point3D[] | null>(null);
  const [fps, setFps] = useState(0);

  const repCounter = useRepCounter();

  const [sessionState, setSessionState] = useState<SessionState>("idle");
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);

  const startSession = useCallback(() => {
    setCountdown(COUNTDOWN_SECONDS);
    setSessionState("countdown");
  }, []);

  const endSession = useCallback(() => {
    setSessionState("idle");
    repCounter.reset();
    // Depending on repCounter.reset (stable via useCallback) rather than the whole
    // repCounter object, which is a new reference every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repCounter.reset]);

  useEffect(() => {
    if (sessionState !== "countdown") return;
    if (countdown <= 0) {
      repCounter.reset();
      setSessionState("active");
      return;
    }
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionState, countdown, repCounter.reset]);

  useEffect(() => {
    let cancelled = false;
    getPoseLandmarker()
      .then((lm) => {
        if (!cancelled) setLandmarker(lm);
      })
      .catch((err) => {
        console.error("Failed to load pose model", err);
        if (!cancelled) setModelError("Couldn't load the pose model. Check your connection and reload.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleVideoReady = useCallback((video: HTMLVideoElement) => {
    videoElRef.current = video;
    setVideoDims({ width: video.videoWidth, height: video.videoHeight });
    setVideoReady(true);
  }, []);

  useEffect(() => {
    if (!landmarker || !videoReady || !videoElRef.current) return;

    const video = videoElRef.current;
    let rafId: number;
    let frameCount = 0;
    let lastFpsUpdate = performance.now();

    const loop = () => {
      if (video.readyState >= 2) {
        const result = landmarker.detectForVideo(video, performance.now());
        const normalized = result.landmarks[0] ?? null;
        const world = result.worldLandmarks[0] ?? null;

        setDrawLandmarks(normalized);
        if (world) repCounter.processFrame(world, sessionState === "active");

        frameCount++;
        const now = performance.now();
        if (now - lastFpsUpdate >= 500) {
          setFps(Math.round((frameCount * 1000) / (now - lastFpsUpdate)));
          frameCount = 0;
          lastFpsUpdate = now;
        }
      }
      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
    // Depending on repCounter.processFrame (stable via useCallback) rather than the
    // whole repCounter object, which is a new reference every render and would
    // otherwise restart this rAF loop on every processed frame. sessionState is
    // fine to depend on directly — it only changes a few times per session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [landmarker, videoReady, repCounter.processFrame, sessionState]);

  const lastRep = repCounter.reps[repCounter.reps.length - 1];
  const statusColor = statusColorForPhase(repCounter.phase);

  return (
    <div className="min-h-screen bg-[var(--color-bg-app)] flex flex-col">
      <header className="px-6 py-4 bg-[var(--color-primary)] text-white">
        <h1 className="text-xl font-bold">Movement &amp; Rehab Form Coach</h1>
        <p className="text-sm text-white/80">
          A coaching &amp; monitoring tool — not a diagnostic or medical device.
        </p>
      </header>

      <main className="flex-1 flex flex-col lg:flex-row gap-6 p-6">
        <div className="relative flex-1 min-h-[60vh] bg-black rounded-2xl overflow-hidden">
          <CameraFeed onVideoReady={handleVideoReady} />
          <PoseOverlay
            landmarks={drawLandmarks}
            videoWidth={videoDims.width}
            videoHeight={videoDims.height}
            statusColor={statusColor}
          />

          {!repCounter.isBodyVisible && videoReady && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/80 text-white px-4 py-2 rounded-full text-sm font-medium">
              Step back so your whole body is visible
            </div>
          )}

          {!landmarker && !modelError && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-white">
              <p className="text-lg">Loading pose model…</p>
            </div>
          )}

          {modelError && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/90 text-white text-center px-6">
              <p className="text-lg font-semibold">{modelError}</p>
            </div>
          )}

          {landmarker && !modelError && videoReady && sessionState === "idle" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 flex items-center justify-center bg-black/50"
            >
              <motion.button
                type="button"
                onClick={startSession}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="bg-[var(--color-accent)] text-white text-lg font-semibold px-8 py-4 rounded-2xl shadow-lg"
              >
                Start Session
              </motion.button>
            </motion.div>
          )}

          {sessionState === "countdown" && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
              <AnimatePresence mode="wait">
                <motion.p
                  key={countdown}
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.4 }}
                  transition={{ duration: 0.35 }}
                  className="text-white text-8xl font-bold"
                >
                  {countdown > 0 ? countdown : "Go!"}
                </motion.p>
              </AnimatePresence>
            </div>
          )}

          <div className="absolute top-4 left-4 bg-black/60 text-white text-xs font-mono px-2 py-1 rounded">
            {fps} fps · {repCounter.phase} · {Math.round(repCounter.kneeAngle)}°
          </div>
        </div>

        <aside className="w-full lg:w-80 flex flex-col gap-4">
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <p className="text-sm text-gray-500 mb-1">Reps</p>
            <p className="text-4xl font-bold text-[var(--color-primary)]">{repCounter.repCount}</p>
            <div className="flex gap-4 mt-2 text-sm text-gray-600">
              <span>{repCounter.cleanReps} clean</span>
              <span>{repCounter.flaggedReps} flagged</span>
            </div>
          </div>

          {lastRep && (
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <p className="text-sm text-gray-500 mb-1">Last rep</p>
              <p className="font-medium">
                {lastRep.clean ? "Clean" : lastRep.errors.join(", ").replace(/_/g, " ")}
              </p>
            </div>
          )}

          <div className="bg-white rounded-2xl p-5 shadow-sm text-sm text-gray-600 space-y-2">
            <p className="font-semibold text-gray-800">Camera setup</p>
            <p>Stand 6–8 feet back so your whole body is in frame.</p>
            <p>Angle your body roughly 30–40° off dead-front (not straight-on).</p>
            <p>Use even lighting and keep other people out of frame.</p>
          </div>

          {sessionState === "active" && (
            <button
              type="button"
              onClick={endSession}
              className="mt-auto bg-[var(--color-accent)] text-white font-semibold py-3 rounded-2xl"
            >
              End Session
            </button>
          )}
        </aside>
      </main>
    </div>
  );
}
