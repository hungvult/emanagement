"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { AsyncSession, openSessionCamera } from "@/lib/async-session";

export function useCamera(sessionRef: RefObject<AsyncSession>) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setIsCameraActive(false);
  }, []);
  const startCamera = useCallback(async () => {
    const session = sessionRef.current;
    const revision = session.current;
    setCameraError(null);
    try {
      const stream = await openSessionCamera(session, {
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "user",
        },
        audio: false,
      });
      if (!stream) return;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = stream;
      setIsCameraActive(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        void videoRef.current.play().catch(() => {});
      }
    } catch {
      if (!session.isCurrent(revision)) return;
      setCameraError(
        "Không thể mở camera. Vui lòng kiểm tra quyền truy cập máy ảnh.",
      );
      setIsCameraActive(false);
    }
  }, [sessionRef]);
  useEffect(() => {
    if (isCameraActive && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
      void videoRef.current.play().catch(() => {});
    }
  }, [isCameraActive]);
  return { videoRef, isCameraActive, cameraError, startCamera, stopCamera };
}
