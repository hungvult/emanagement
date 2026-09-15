"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Camera,
  CheckCircle2,
  XCircle,
  X,
  RefreshCw,
  Clock,
  UserCheck,
  Zap,
  Volume2,
  VolumeX,
  Eye,
} from "lucide-react";
import { kioskService } from "../../services/kiosk.service";
import { KioskCheckInResponse } from "../../types/kiosk.types";
import { ekycAudio } from "../../lib/ekyc-audio";
import { captureOptimizedFrame } from "../../lib/camera-utils";
import { ekycMediaPipe, BiometricAnalysisResult } from "../../lib/ekyc-mediapipe";
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
  const [promptMessage, setPromptMessage] = useState<string>(
    "Vui lòng nhìn thẳng và chớp mắt một cái để chấm công"
  );
  const [isFaceDetected, setIsFaceDetected] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const isProcessingRef = useRef<boolean>(false);
  const lastVoiceTimeRef = useRef<number>(0);

  // Stop camera & loops
  const stopCamera = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
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
    ekycAudio.stopSpeaking();
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

  // Capture current frame (optimized resolution & quality)
  const captureFrame = useCallback((): string | null => {
    return captureOptimizedFrame(videoRef.current);
  }, []);

  // Restart scan manually or auto-reset after showing result
  const handleReset = useCallback(() => {
    setScanResult(null);
    setErrorMessage(null);
    ekycMediaPipe.resetBlink();
    isProcessingRef.current = false;
    setPromptMessage("Vui lòng nhìn thẳng và chớp mắt một cái để chấm công");
  }, []);

  // Perform Attendance Check-in (chỉ kích hoạt sau khi đã xác thực chớp mắt thật)
  const executeCheckIn = useCallback(async () => {
    const frameBase64 = captureFrame();
    if (!frameBase64) {
      isProcessingRef.current = false;
      return;
    }

    setIsScanning(true);
    setErrorMessage(null);

    // Flash & chime
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
        const actionText =
          res.data.checkType === "CHECK_IN" ? "Check in thành công" : "Check out thành công";
        ekycAudio.speak(actionText, true);
      } else {
        setErrorMessage(res.message || "Không thể nhận diện khuôn mặt");
        ekycAudio.speak("Nhận diện thất bại");
      }
    } catch (err: any) {
      const msg =
        err.response?.data?.message || err.message || "Không tìm thấy khuôn mặt phù hợp trong hệ thống";
      setErrorMessage(msg);

      let spokenError = "Nhận diện thất bại";
      if (msg.includes("Không phát hiện khuôn mặt") || msg.includes("NO_FACE")) {
        spokenError = "Không có khuôn mặt";
      } else if (msg.includes("Không nhận diện được khuôn mặt") || msg.includes("UNKNOWN_FACE")) {
        spokenError = "Người lạ, không nhận diện được";
      } else if (msg.includes("giả mạo") || msg.includes("SPOOF_DETECTED")) {
        spokenError = "Phát hiện giả mạo khuôn mặt";
      } else if (msg.includes("tranh chấp")) {
        spokenError = "Tranh chấp nhận diện";
      }

      ekycAudio.speak(spokenError);
    } finally {
      setIsScanning(false);
      // Giữ kết quả hiển thị 3.5 giây rồi tự động reset cho người tiếp theo
      setTimeout(() => {
        handleReset();
      }, 3500);
    }
  }, [captureFrame, handleReset]);

  // Initialize
  useEffect(() => {
    if (isOpen) {
      ekycMediaPipe.loadModel().catch(() => {});
      ekycMediaPipe.clearReferenceFace();
      ekycMediaPipe.resetBlink();
      setScanResult(null);
      setErrorMessage(null);
      isProcessingRef.current = false;
      lastVoiceTimeRef.current = 0;
      setPromptMessage("Vui lòng nhìn thẳng và chớp mắt một cái để chấm công");
      startCamera();
    } else {
      ekycMediaPipe.clearReferenceFace();
      stopCamera();
    }
    return () => {
      ekycMediaPipe.clearReferenceFace();
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

  // Real-time Active Biometric Liveness Loop: Chống 100% việc giơ ảnh điện thoại
  useEffect(() => {
    if (!isOpen || !isCameraActive) return;

    let isSubscribed = true;
    let lastTime = performance.now();

    const processFrame = async () => {
      if (!isSubscribed) return;

      const now = performance.now();
      const delta = now - lastTime;

      // Xử lý mỗi ~45ms
      if (
        delta >= 45 &&
        videoRef.current &&
        !isProcessingRef.current &&
        !scanResult &&
        !errorMessage
      ) {
        lastTime = now;
        const video = videoRef.current;

        if (video.videoWidth > 0 && video.videoHeight > 0) {
          try {
            const res: BiometricAnalysisResult = await ekycMediaPipe.processFrame(
              video,
              "blink"
            );

            // Cập nhật thông báo hướng dẫn người dùng
            if (res.status === "NO_FACE") {
              setIsFaceDetected(false);
              setPromptMessage("Vui lòng đưa khuôn mặt vào giữa khung hình");
            } else if (res.status === "MULTIPLE_FACES") {
              setIsFaceDetected(true);
              setPromptMessage("Phát hiện nhiều người! Vui lòng chỉ một người đứng trước camera");
            } else if (res.status === "NOT_CENTERED") {
              setIsFaceDetected(true);
              setPromptMessage("Vui lòng căn giữa khuôn mặt trong vòng tròn");
            } else if (res.status === "TOO_FAR") {
              setIsFaceDetected(true);
              setPromptMessage("Vui lòng tiến lại gần camera hơn");
            } else if (res.status === "TOO_CLOSE") {
              setIsFaceDetected(true);
              setPromptMessage("Vui lòng lùi lại một chút");
            } else {
              setIsFaceDetected(true);
              if (res.blinkScore >= 70 && !res.isMatched) {
                setPromptMessage("Tốt lắm, mở mắt ra...");
              } else {
                setPromptMessage("Vui lòng nhìn thẳng và chớp mắt một cái để chấm công");
              }
            }

            // Nhắc nhở bằng giọng nói định kỳ (mỗi 5 giây) nếu đã thấy mặt
            const currentTime = Date.now();
            if (
              res.status !== "NO_FACE" &&
              currentTime - lastVoiceTimeRef.current > 5000 &&
              !isProcessingRef.current
            ) {
              lastVoiceTimeRef.current = currentTime;
              ekycAudio.speak("Vui lòng nhìn thẳng và chớp mắt một cái để chấm công");
            }

            // KÍCH HOẠT CHẤM CÔNG DUY NHẤT KHI PHÁT HIỆN CHỚP MẮT SINH TRẮC HỌC THẬT (Strict Active Liveness)
            // Tuyệt đối không tự chụp bằng thời gian đứng yên, triệt tiêu 100% gian lận bằng ảnh/điện thoại!
            if (res.isMatched && !isProcessingRef.current) {
              isProcessingRef.current = true;
              setPromptMessage("Đang nhận diện khuôn mặt...");
              executeCheckIn();
              return;
            }
          } catch (e) {
            // bỏ qua drop frame tạm thời
          }
        }
      }

      animFrameRef.current = requestAnimationFrame(processFrame);
    };

    animFrameRef.current = requestAnimationFrame(processFrame);

    return () => {
      isSubscribed = false;
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [isOpen, isCameraActive, scanResult, errorMessage, executeCheckIn]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="relative w-full max-w-lg overflow-hidden rounded-3xl bg-card border border-border text-foreground shadow-xl flex flex-col z-10">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/50">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Zap className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground">
                Chấm công Face ID Trực tuyến
              </h3>
              <p className="text-xs text-muted-foreground">
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
              className="p-2 rounded-full bg-secondary hover:bg-secondary/80 text-secondary-foreground transition-all border border-border"
              title={isMuted ? "Bật âm thanh" : "Tắt âm thanh"}
            >
              {isMuted ? (
                <VolumeX className="h-4 w-4 text-destructive" />
              ) : (
                <Volume2 className="h-4 w-4 text-primary animate-pulse" />
              )}
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-full bg-secondary hover:bg-secondary/80 text-secondary-foreground transition-all border border-border"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Camera Scanner View */}
        <div className="relative p-6 flex flex-col items-center justify-center bg-card">
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
                  ? "border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.3)]"
                  : errorMessage
                  ? "border-destructive shadow-[0_0_20px_rgba(239,68,68,0.3)]"
                  : "border-primary/50 shadow-[0_0_15px_rgba(79,70,229,0.2)] animate-pulse"
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
                <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent shadow-[0_0_15px_rgba(79,70,229,0.8)] animate-bounce pointer-events-none opacity-80" />
              )}

              {/* Loading State */}
              {!isCameraActive && !cameraError && (
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <Camera className="h-8 w-8 text-primary animate-pulse" />
                  <p className="text-xs">Đang mở máy ảnh...</p>
                </div>
              )}

              {/* Error State */}
              {cameraError && (
                <div className="flex flex-col items-center gap-2 text-destructive p-4 text-center">
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
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 shadow-sm animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <CheckCircle2 className="h-6 w-6 text-emerald-600 animate-bounce" />
                  <span className="text-base font-bold text-emerald-800">
                    {scanResult.checkType === "CHECK_IN" ? "CHECK-IN THÀNH CÔNG" : "CHECK-OUT THÀNH CÔNG"}
                  </span>
                </div>
                <div className="text-sm font-semibold text-emerald-900">
                  {scanResult.fullName} ({scanResult.employeeCode})
                </div>
                <div className="mt-1 flex items-center justify-center gap-3 text-xs text-emerald-700">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {new Date(scanResult.checkTime).toLocaleTimeString("vi-VN")}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 font-semibold border border-emerald-500/30">
                    {scanResult.attendanceStatus === "ON_TIME" ? "Đúng giờ" : "Đi muộn"}
                  </span>
                </div>
              </div>
            ) : errorMessage ? (
              <div className="p-3 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center justify-center gap-2 animate-in shake duration-200">
                <XCircle className="h-4 w-4 text-destructive flex-shrink-0" />
                <span>{errorMessage}</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2.5 py-1">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-medium shadow-sm">
                  <Eye className="h-3.5 w-3.5 text-primary" />
                  <span>Xác thực tính sống AI (Liveness Detection)</span>
                </div>
                <p className="text-xs text-muted-foreground font-medium tracking-wide">
                  {promptMessage}
                </p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
