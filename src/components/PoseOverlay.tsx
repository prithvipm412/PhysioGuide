import { PoseLandmarker } from "@mediapipe/tasks-vision";
import { useEffect, useRef } from "react";
import type { Point3D } from "../lib/angles";

export type FormStatusColor = "green" | "amber" | "red";

interface PoseOverlayProps {
  landmarks: Point3D[] | null;
  videoWidth: number;
  videoHeight: number;
  statusColor: FormStatusColor;
}

const COLORS: Record<FormStatusColor, string> = {
  green: "#22C55E",
  amber: "#F59E0B",
  red: "#EF4444",
};

export function PoseOverlay({ landmarks, videoWidth, videoHeight, statusColor }: PoseOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !videoWidth || !videoHeight) return;

    if (canvas.width !== videoWidth) canvas.width = videoWidth;
    if (canvas.height !== videoHeight) canvas.height = videoHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!landmarks) return;

    const color = COLORS[statusColor];

    ctx.lineWidth = 3;
    ctx.strokeStyle = color;
    for (const connection of PoseLandmarker.POSE_CONNECTIONS) {
      const start = landmarks[connection.start];
      const end = landmarks[connection.end];
      if (!start || !end) continue;
      ctx.beginPath();
      ctx.moveTo(start.x * canvas.width, start.y * canvas.height);
      ctx.lineTo(end.x * canvas.width, end.y * canvas.height);
      ctx.stroke();
    }

    ctx.fillStyle = color;
    for (const point of landmarks) {
      if ((point.visibility ?? 1) < 0.3) continue;
      ctx.beginPath();
      ctx.arc(point.x * canvas.width, point.y * canvas.height, 4, 0, 2 * Math.PI);
      ctx.fill();
    }
  }, [landmarks, videoWidth, videoHeight, statusColor]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full object-cover -scale-x-100"
    />
  );
}
