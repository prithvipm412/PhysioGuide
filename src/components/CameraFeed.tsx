import { useEffect, useRef, useState } from "react";

interface CameraFeedProps {
  onVideoReady: (video: HTMLVideoElement) => void;
}

type CameraStatus = "requesting" | "ready" | "denied" | "unavailable";

/**
 * Renders just the <video> element (mirrored for a natural selfie view) plus
 * permission-state overlays. Intentionally has no wrapper div of its own —
 * the parent owns a shared relative container so a sibling canvas overlay
 * (PoseOverlay) can be mirrored identically and stay pixel-aligned with it.
 */
export function CameraFeed({ onVideoReady }: CameraFeedProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<CameraStatus>("requesting");

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus("unavailable");
        return;
      }

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (cancelled || !videoRef.current) return;

        const video = videoRef.current;
        video.srcObject = stream;
        video.onloadedmetadata = () => {
          video.play();
          setStatus("ready");
          onVideoReady(video);
        };
      } catch (err) {
        console.error("Camera access failed", err);
        if (!cancelled) setStatus("denied");
      }
    }

    start();

    return () => {
      cancelled = true;
      stream?.getTracks().forEach((track) => track.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover -scale-x-100"
        playsInline
        muted
      />

      {status === "requesting" && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-white text-center px-6">
          <p className="text-lg">Requesting camera access…</p>
        </div>
      )}

      {status === "denied" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/90 text-white text-center px-6">
          <p className="text-lg font-semibold">Camera access denied or blocked</p>
          <p className="text-sm text-white/80 max-w-md">
            This app needs your webcam to watch your form. Check your browser's site
            permissions (usually a camera icon in the address bar), allow access, then
            reload the page.
          </p>
        </div>
      )}

      {status === "unavailable" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/90 text-white text-center px-6">
          <p className="text-lg font-semibold">No camera found</p>
          <p className="text-sm text-white/80 max-w-md">
            This browser or device doesn't support webcam access. Try Chrome on a
            laptop or desktop with a working camera.
          </p>
        </div>
      )}
    </>
  );
}
