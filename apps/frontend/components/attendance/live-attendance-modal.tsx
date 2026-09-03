"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Camera,
  CheckCircle2,
  XCircle,
  X,
  Sparkles,
  RefreshCw,
  Clock,
  UserCheck,
  Zap,
  Volume2,
  VolumeX,
} from "lucide-react";
import { kioskService } from "../../services/kiosk.service";
import { KioskCheckInResponse } from "../../types/kiosk.types";
import { ekycAudio } from "../../lib/ekyc-audio";
import { Button } from "../ui/button";

interface LiveAttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LiveAttendanceModal: React.FC<LiveAttendanceModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [scanResult, setScanResult] = useState<KioskCheckInResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isFlashing, setIsFlashing] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const autoScanIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isProcessingRef = useRef<boolean>(false);

  // Stop camera & loops
  const stopCamera = useCallback(() => {
    if (autoScanIntervalRef.current) {
      clearInterval(autoScanIntervalRef.current);
      autoScanIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
    isProcessingRef.current = false;
  }, []);

  // Start Camera
  const startCamera = useCallback(async () => {
    setCameraError(null);
    setScanResult(null);
    setErrorMessage(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "user",
        },
        audio: false,
      });

      streamRef.current = stream;
      setIsCameraActive(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
    } catch (err: any) {
      console.error("Camera error:", err);
      setCameraError(
        "Không thể kết nối máy ảnh. Vui lòng cấp quyền truy cập camera trong trình duyệt."
      );
      setIsCameraActive(false);
    }
  }, []);

  // Initialize
  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, startCamera, stopCamera]);

  // Sync stream to video
  useEffect(() => {
    if (isOpen && isCameraActive && streamRef.current && videoRef.current) {
      if (videoRef.current.srcObject !== streamRef.current) {
        videoRef.current.srcObject = streamRef.current;
      }
      videoRef.current.play().catch(() => {});
    }
  }, [isOpen, isCameraActive]);

  // Capture frame
  const captureFrame = useCallback((): string | null => {
    if (!videoRef.current) return null;
    const video = videoRef.current;
    if (!video.videoWidth || !video.videoHeight) return null;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.92);
  }, []);

  // Perform Attendance Check-in
  const executeCheckIn = useCallback(async () => {
    if (isProcessingRef.current || !isCameraActive) return;
    const frameBase64 = captureFrame();
    if (!frameBase64) return;

    isProcessingRef.current = true;
    setIsScanning(true);
    setErrorMessage(null);

    // Flash
    setIsFlashing(true);
    setTimeout(() => setIsFlashing(false), 200);
    ekycAudio.playShutterSound();

    try {
      const res = await kioskService.checkIn("WEB_KIOSK_DEFAULT", {
        imageFrameBase64: frameBase64,
      });

      if (res.status === "SUCCESS" && res.data) {
        setScanResult(res.data);
        ekycAudio.playSuccessChime();
        const actionText = res.data.checkType === "CHECK_IN" ? "Check in thành công" : "Check out thành công";
        ekycAudio.speak(actionText, true);
      } else {
        setErrorMessage(res.message || "Không thể nhận diện khuôn mặt");
        ekycAudio.speak("Nhận diện thất bại");
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || "Không tìm thấy khuôn mặt phù hợp trong hệ thống";
      setErrorMessage(msg);
      
      // Simplify spoken error message
      let spokenError = "Nhận diện thất bại";
      if (msg.includes("Không phát hiện khuôn mặt") || msg.includes("NO_FACE")) {
        spokenError = "Không có khuôn mặt";
      } else if (msg.includes("Không nhận diện được khuôn mặt") || msg.includes("UNKNOWN_FACE")) {
        spokenError = "Người lạ, không nhận diện được";
      } else if (msg.includes("giả mạo")) {
        spokenError = "Phát hiện giả mạo khuôn mặt";
      } else if (msg.includes("tranh chấp")) {
        spokenError = "Tranh chấp nhận diện";
      }

      // Avoid spamming the 'No face' error every 2 seconds when idling
      // ekycAudio already has a 4-second throttle for identical texts, 
      // but to be safe, we still speak it per user request.
      ekycAudio.speak(spokenError);
    } finally {
      setIsScanning(false);
      // Cooldown before next auto-attempt
      setTimeout(() => {
        isProcessingRef.current = false;
      }, 2500);
    }
  }, [captureFrame, isCameraActive]);

  // Auto-scan loop
  useEffect(() => {
    if (isOpen && isCameraActive) {
      // Clear any existing interval first
      if (autoScanIntervalRef.current) clearInterval(autoScanIntervalRef.current);
      
      autoScanIntervalRef.current = setInterval(() => {
        // Only trigger if not currently processing and no result/error is currently displayed
        if (!isProcessingRef.current && !scanResult && !errorMessage) {
          executeCheckIn();
        }
      }, 2000);
    }
    return () => {
      if (autoScanIntervalRef.current) {
        clearInterval(autoScanIntervalRef.current);
        autoScanIntervalRef.current = null;
      }
    };
  }, [isOpen, isCameraActive, scanResult, errorMessage, executeCheckIn]);

  // Restart scan manually or auto-reset after showing result
  const handleReset = useCallback(() => {
    setScanResult(null);
    setErrorMessage(null);
    isProcessingRef.current = false;
  }, []);

  // Auto-reset effect
  useEffect(() => {
    if (scanResult || errorMessage) {
      const timer = setTimeout(() => {
        handleReset();
      }, 3000); // Automatically clear after 3 seconds to be ready for next person
      return () => clearTimeout(timer);
    }
  }, [scanResult, errorMessage, handleReset]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/85 backdrop-blur-xl transition-opacity"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="relative w-full max-w-lg overflow-hidden rounded-3xl bg-[#0e131f] border border-cyan-500/30 text-white shadow-[0_0_80px_rgba(6,182,212,0.25)] flex flex-col z-10">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-gradient-to-r from-cyan-950/40 via-slate-900 to-slate-900">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Zap className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">
                Chấm công Face ID Trực tuyến
              </h3>
              <p className="text-xs text-slate-400">
                Nhận diện sinh trắc học AI tự động
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const nextMuted = !isMuted;
                setIsMuted(nextMuted);
                ekycAudio.setMuted(nextMuted);
              }}
              className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-all border border-white/10"
              title={isMuted ? "Bật âm thanh" : "Tắt âm thanh"}
            >
              {isMuted ? (
                <VolumeX className="h-4 w-4 text-rose-400" />
              ) : (
                <Volume2 className="h-4 w-4 text-cyan-400 animate-pulse" />
              )}
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all border border-white/10"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Camera Scanner View */}
        <div className="relative p-6 flex flex-col items-center justify-center bg-radial from-slate-900 to-[#070b14]">
          {/* Flash */}
          {isFlashing && (
            <div className="absolute inset-0 bg-white z-40 pointer-events-none animate-out fade-out duration-200" />
          )}

          {/* Scanner Circular Ring */}
          <div className="relative w-64 h-64 sm:w-72 sm:h-72 flex items-center justify-center">
            {/* Outer Ring */}
            <div
              className={`absolute inset-0 rounded-full border-2 transition-all duration-300 ${
                scanResult
                  ? "border-emerald-400 shadow-[0_0_35px_rgba(16,185,129,0.7)]"
                  : errorMessage
                  ? "border-rose-500 shadow-[0_0_25px_rgba(244,63,94,0.5)]"
                  : "border-cyan-500/50 shadow-[0_0_20px_rgba(6,182,212,0.3)] animate-pulse"
              }`}
            />

            {/* Video Feed */}
            <div className="relative w-[230px] h-[230px] sm:w-[260px] sm:h-[260px] rounded-full overflow-hidden bg-black flex items-center justify-center">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover transform -scale-x-100 ${
                  !isCameraActive ? "hidden" : ""
                }`}
              />

              {/* Laser Scan Line */}
              {isCameraActive && !scanResult && (
                <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_15px_#06b6d4] animate-bounce pointer-events-none opacity-80" />
              )}

              {/* Loading State */}
              {!isCameraActive && !cameraError && (
                <div className="flex flex-col items-center gap-2 text-slate-400">
                  <Camera className="h-8 w-8 text-cyan-400 animate-pulse" />
                  <p className="text-xs">Đang mở máy ảnh...</p>
                </div>
              )}

              {/* Error State */}
              {cameraError && (
                <div className="flex flex-col items-center gap-2 text-rose-400 p-4 text-center">
                  <p className="text-xs">{cameraError}</p>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={startCamera}
                    className="mt-1 text-xs"
                  >
                    Thử lại
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Result Card or Guidance */}
          <div className="w-full max-w-sm mt-5 text-center">
            {scanResult ? (
              <div className="p-4 rounded-2xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-200 shadow-[0_0_30px_rgba(16,185,129,0.3)] animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <CheckCircle2 className="h-6 w-6 text-emerald-400 animate-bounce" />
                  <span className="text-base font-bold text-white">
                    {scanResult.checkType === "CHECK_IN" ? "CHECK-IN THÀNH CÔNG" : "CHECK-OUT THÀNH CÔNG"}
                  </span>
                </div>
                <div className="text-sm font-semibold text-white">
                  {scanResult.fullName} ({scanResult.employeeCode})
                </div>
                <div className="mt-1 flex items-center justify-center gap-3 text-xs text-emerald-300">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {new Date(scanResult.checkTime).toLocaleTimeString("vi-VN")}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 font-semibold border border-emerald-400/30">
                    {scanResult.attendanceStatus === "ON_TIME" ? "Đúng giờ" : "Đi muộn"}
                  </span>
                </div>
              </div>
            ) : errorMessage ? (
              <div className="p-3 rounded-2xl bg-rose-950/80 border border-rose-500/40 text-rose-200 text-xs flex items-center justify-center gap-2 animate-in shake duration-200">
                <XCircle className="h-4 w-4 text-rose-400 flex-shrink-0" />
                <span>{errorMessage}</span>
              </div>
            ) : (
              <p className="text-xs text-slate-400">
                Đưa khuôn mặt vào giữa khung tròn để máy tự động nhận diện chấm công
              </p>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
