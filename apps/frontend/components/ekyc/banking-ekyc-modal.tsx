"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  CheckCircle2,
  Volume2,
  VolumeX,
  X,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Camera,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { ekycAudio } from "../../lib/ekyc-audio";
import { ekycMediaPipe, BiometricAnalysisResult, Landmark3D } from "../../lib/ekyc-mediapipe";
import { captureOptimizedFrame } from "../../lib/camera-utils";
import { Button } from "../ui/button";

export interface EkycStep {
  id: "front" | "left" | "right" | "up" | "smile" | "blink";
  title: string;
  voicePrompt: string;
  direction?: "left" | "right" | "up" | "center";
}

const EKYC_STEPS: EkycStep[] = [
  {
    id: "front",
    title: "Nhìn thẳng vào khung hình (1/5)",
    voicePrompt: "Vui lòng nhìn thẳng vào vòng tròn",
    direction: "center",
  },
  {
    id: "blink",
    title: "Vui lòng chớp mắt một cái (2/5)",
    voicePrompt: "Vui lòng chớp mắt",
    direction: "center",
  },
  {
    id: "left",
    title: "Quay mặt sang bên trái (3/5)",
    voicePrompt: "Vui lòng quay mặt sang bên trái",
    direction: "left",
  },
  {
    id: "right",
    title: "Quay mặt sang bên phải (4/5)",
    voicePrompt: "Vui lòng quay mặt sang bên phải",
    direction: "right",
  },
  {
    id: "up",
    title: "Hơi ngẩng cằm lên trên (5/5)",
    voicePrompt: "Vui lòng ngẩng cằm lên một chút",
    direction: "up",
  },
];

interface BankingEkycModalProps {
  isOpen: boolean;
  onClose: () => void;
  employeeName: string;
  employeeCode: string;
  onCaptureFrame?: (imageBase64: string, index: number) => Promise<void>;
  onCompleteAll: (allImages: string[]) => Promise<void>;
}

export const BankingEkycModal: React.FC<BankingEkycModalProps> = ({
  isOpen,
  onClose,
  employeeName,
  employeeCode,
  onCaptureFrame,
  onCompleteAll,
}) => {
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [stepProgress, setStepProgress] = useState(0); // 0 to 100
  const [isHoldingPose, setIsHoldingPose] = useState(false);
  const [isFlashing, setIsFlashing] = useState(false);
  const [isDoneAll, setIsDoneAll] = useState(false);
  const [promptMessage, setPromptMessage] = useState<string>("Vui lòng nhìn thẳng vào vòng tròn");

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const poseHoldTimeRef = useRef<number>(0);
  const isTransitioningRef = useRef<boolean>(false);
  const lastVoiceTimeRef = useRef<number>(0);
  const noFaceDurationRef = useRef<number>(0);
  const faceMismatchDurationRef = useRef<number>(0);
  const lastLandmarksRef = useRef<Landmark3D[] | null>(null);

  const currentStep = EKYC_STEPS[currentStepIdx] || EKYC_STEPS[0];

  // Stop camera & audio
  const stopEverything = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
    ekycAudio.stopSpeaking();
  }, []);

  // Start Camera
  const startCamera = useCallback(async () => {
    setCameraError(null);
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
        "Không thể mở Camera. Vui lòng kiểm tra quyền truy cập máy ảnh."
      );
      setIsCameraActive(false);
    }
  }, []);

  // Pre-load MediaPipe FaceMesh
  useEffect(() => {
    ekycMediaPipe.loadModel().catch(() => {});
  }, []);

  // Initialize on open
  useEffect(() => {
    if (isOpen) {
      setCurrentStepIdx(0);
      ekycMediaPipe.resetBlink();
      ekycMediaPipe.clearReferenceFace();
      lastLandmarksRef.current = null;
      noFaceDurationRef.current = 0;
      faceMismatchDurationRef.current = 0;
      setCapturedImages([]);
      setStepProgress(0);
      setIsDoneAll(false);
      isTransitioningRef.current = false;
      lastVoiceTimeRef.current = 0;
      setPromptMessage(EKYC_STEPS[0].title);
      startCamera();
    } else {
      stopEverything();
    }
    return () => {
      stopEverything();
    };
  }, [isOpen, startCamera, stopEverything]);

  // Sync stream to video element
  useEffect(() => {
    if (isOpen && isCameraActive && streamRef.current && videoRef.current) {
      if (videoRef.current.srcObject !== streamRef.current) {
        videoRef.current.srcObject = streamRef.current;
      }
      videoRef.current.play().catch(() => {});
    }
  }, [isOpen, isCameraActive]);

  // Speak step prompt when step changes
  useEffect(() => {
    if (isOpen && isCameraActive && !isDoneAll) {
      const timer = setTimeout(() => {
        ekycAudio.speak(currentStep.voicePrompt, true);
        lastVoiceTimeRef.current = Date.now();
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [isOpen, isCameraActive, currentStepIdx, isDoneAll, currentStep.voicePrompt]);

  // Toggle Mute
  const handleToggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    ekycAudio.setMuted(nextMuted);
  };

  // Capture current frame
  const captureCurrentFrame = useCallback((): string | null => {
    return captureOptimizedFrame(videoRef.current, 720, 0.88);
  }, []);

  // Step success transition
  const handleStepSuccess = useCallback(async () => {
    if (isTransitioningRef.current) return;
    isTransitioningRef.current = true;

    const frameBase64 = captureCurrentFrame();
    if (frameBase64) {
      // 1. Chớp sáng và phát âm thanh chụp ảnh
      setIsFlashing(true);
      setTimeout(() => setIsFlashing(false), 200);
      ekycAudio.playShutterSound();
      ekycAudio.playSuccessChime();

      // 2. Cập nhật ảnh vào danh sách 5 ảnh
      const nextList = [...capturedImages, frameBase64];
      setCapturedImages(nextList);

      // Lưu lại đặc trưng hình học khuôn mặt chuẩn từ bước 1 để đối chiếu các bước sau
      if (currentStepIdx === 0 && lastLandmarksRef.current) {
        ekycMediaPipe.setReferenceFace(lastLandmarksRef.current);
      }

      if (onCaptureFrame) {
        onCaptureFrame(frameBase64, currentStepIdx).catch(() => {});
      }

      // 3. Xử lý chuyển bước tiếp theo hoặc hoàn tất chuỗi 5 bước
      if (currentStepIdx + 1 < EKYC_STEPS.length) {
        setPromptMessage(`Chuẩn bị bước ${currentStepIdx + 2}/5...`);
        setTimeout(() => {
          ekycMediaPipe.resetBlink();
          setCurrentStepIdx((s) => s + 1);
          setStepProgress(0);
          setIsHoldingPose(false);
          poseHoldTimeRef.current = 0;
          isTransitioningRef.current = false;
        }, 900);
      } else {
        // Đã hoàn thành cả 5 bước!
        setIsDoneAll(true);
        setStepProgress(100);
        setPromptMessage("Đang đối chiếu & lưu trữ dữ liệu...");
        ekycAudio.playCompleteFanfare();
        ekycAudio.speak("Xác thực hoàn tất, đang lưu dữ liệu", true);

        // Gửi toàn bộ 5 ảnh để kiểm tra đồng nhất khuôn mặt và lưu vector
        setTimeout(async () => {
          try {
            await onCompleteAll(nextList);
          } catch (error: any) {
            setIsDoneAll(false);
            setPromptMessage(error.message || "Xác thực thất bại! Vui lòng thử lại.");
            ekycAudio.speak("Có lỗi xảy ra, vui lòng thử lại", true);
            setTimeout(() => {
              isTransitioningRef.current = false;
              setIsHoldingPose(false);
              poseHoldTimeRef.current = 0;
              setStepProgress(0);
            }, 3000);
          }
        }, 700);
      }
    } else {
      isTransitioningRef.current = false;
    }
  }, [captureCurrentFrame, currentStepIdx, onCaptureFrame, capturedImages, onCompleteAll]);

  // Real-time 3D Biometric AI Loop
  useEffect(() => {
    if (!isOpen || !isCameraActive || isDoneAll) return;

    let isSubscribed = true;
    let lastTime = performance.now();

    const processFrame = async () => {
      if (!isSubscribed) {
        return;
      }

      const now = performance.now();
      const delta = now - lastTime;

      if (delta >= 45 && videoRef.current) {
        lastTime = now;
        const video = videoRef.current;

        if (video.videoWidth > 0 && video.videoHeight > 0) {
          try {
            const res: BiometricAnalysisResult = await ekycMediaPipe.processFrame(
              video,
              currentStep.id
            );

            if (res.landmarks) {
              lastLandmarksRef.current = res.landmarks;
            }

            // Session Continuity & Anti-Swap Check:
            // Một khi đã có ảnh hoặc qua bước 1, nếu bỏ điện thoại/mặt ra quá 400ms -> lập tức hủy và về bước 1
            if (capturedImages.length > 0 || currentStepIdx > 0) {
              if (res.status === "NO_FACE") {
                noFaceDurationRef.current += delta;
                if (noFaceDurationRef.current >= 400) {
                  noFaceDurationRef.current = 0;
                  handleRestart();
                  setPromptMessage("Mất khuôn mặt! Bắt đầu lại từ bước 1.");
                  ekycAudio.speak("Vui lòng giữ khuôn mặt liên tục trong khung hình", true);
                  return;
                }
              } else if (res.status === "MULTIPLE_FACES") {
                handleRestart();
                setPromptMessage("Phát hiện nhiều người! Bắt đầu lại.");
                ekycAudio.speak("Vui lòng chỉ một người đứng trước máy ảnh", true);
                return;
              } else {
                noFaceDurationRef.current = 0;
              }

              // Kiểm tra nếu phát hiện đổi khuôn mặt (tỷ lệ giải phẫu khác khuôn mặt ban đầu)
              if (res.message && res.message.includes("Phát hiện đổi khuôn mặt")) {
                faceMismatchDurationRef.current += delta;
                if (faceMismatchDurationRef.current >= 400) {
                  faceMismatchDurationRef.current = 0;
                  handleRestart();
                  setPromptMessage("Phát hiện đổi người! Đã hủy và quay lại bước 1.");
                  ekycAudio.speak("Phát hiện đổi người, vui lòng không đổi người", true);
                  return;
                }
              } else {
                faceMismatchDurationRef.current = 0;
              }
            }

            // Nếu đang trong thời gian đệm chuyển bước, chỉ theo dõi khuôn mặt, không tính tiến trình
            if (isTransitioningRef.current) {
              animFrameRef.current = requestAnimationFrame(processFrame);
              return;
            }

            // Clean, friendly prompt message
            if (res.isMatched) {
              setPromptMessage("Giữ nguyên vị trí...");
            } else {
              setPromptMessage(res.message);
            }

            // Periodic Voice Reminder on wrong pose
            const currentTime = Date.now();
            if (!res.isMatched && currentTime - lastVoiceTimeRef.current > 4000) {
              lastVoiceTimeRef.current = currentTime;
              ekycAudio.speak(res.voiceMessage);
            }

            // Nhịp độ giữ tư thế:
            // Riêng với bước "blink" (chớp mắt): Chu trình sinh trắc Mở -> Nhắm -> Mở đã được xác thực,
            // kích hoạt thành công ngay lập tức để chuyển bước mượt mà không bị trễ!
            if (currentStep.id === "blink") {
              if (res.isMatched) {
                setIsHoldingPose(true);
                setStepProgress(100);
                handleStepSuccess();
              } else {
                setIsHoldingPose(false);
                setStepProgress(res.blinkScore || 0);
              }
            } else {
              const targetHoldMs = 650;
              if (res.isMatched) {
                setIsHoldingPose(true);
                poseHoldTimeRef.current += delta;
                const progress = Math.min(100, Math.round((poseHoldTimeRef.current / targetHoldMs) * 100));
                setStepProgress(progress);

                if (progress >= 100) {
                  handleStepSuccess();
                }
              } else {
                setIsHoldingPose(false);
                poseHoldTimeRef.current = Math.max(0, poseHoldTimeRef.current - delta * 0.5);
                setStepProgress(Math.round((poseHoldTimeRef.current / targetHoldMs) * 100));
              }
            }
          } catch (e) {
            // Ignore minor frame drops
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
  }, [isOpen, isCameraActive, isDoneAll, currentStep.id, handleStepSuccess, currentStepIdx, capturedImages.length]);

  // Restart scan
  const handleRestart = () => {
    noFaceDurationRef.current = 0;
    faceMismatchDurationRef.current = 0;
    lastLandmarksRef.current = null;
    ekycMediaPipe.clearReferenceFace();
    ekycMediaPipe.resetBlink();
    setCurrentStepIdx(0);
    setCapturedImages([]);
    setStepProgress(0);
    setIsDoneAll(false);
    isTransitioningRef.current = false;
    lastVoiceTimeRef.current = 0;
    ekycAudio.speak("Bắt đầu lại xác thực", true);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      {/* Luxury Dark Backdrop */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-xl transition-opacity"
        onClick={onClose}
      />

      {/* Main Luxury Modal Card */}
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl bg-[#111622]/95 border border-white/10 text-white shadow-2xl flex flex-col z-10">
        {/* Top Minimalist Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <div>
            <h3 className="text-base font-semibold text-white tracking-tight">
              Xác thực khuôn mặt
            </h3>
            <p className="text-xs text-slate-400">
              {employeeName} • {employeeCode}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleMute}
              className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-all border border-white/10"
              title={isMuted ? "Bật âm thanh" : "Tắt âm thanh"}
            >
              {isMuted ? (
                <VolumeX className="h-4 w-4 text-rose-400" />
              ) : (
                <Volume2 className="h-4 w-4 text-emerald-400" />
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

        {/* Step Progress Segmented Bar */}
        <div className="px-6 py-2 flex items-center justify-center gap-1.5">
          {EKYC_STEPS.map((step, idx) => {
            const isDone = idx < currentStepIdx || (isDoneAll && idx <= currentStepIdx);
            const isCur = idx === currentStepIdx && !isDoneAll;
            return (
              <div
                key={`${step.id}-${idx}`}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  isDone
                    ? "w-8 bg-emerald-400"
                    : isCur
                    ? "w-10 bg-white shadow-[0_0_10px_rgba(255,255,255,0.8)]"
                    : "w-6 bg-white/15"
                }`}
              />
            );
          })}
        </div>

        {/* Scanner Center Area */}
        <div className="relative px-6 py-5 flex flex-col items-center justify-center">

          {/* Clean Floating Prompt Pill */}
          <div className="mb-4 text-center">
            <div
              className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
                isHoldingPose
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                  : "bg-white/5 text-slate-200 border border-white/10"
              }`}
            >
              {isHoldingPose && (
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
              )}
              <span>{promptMessage}</span>
            </div>
          </div>

          {/* Luxury Circular Camera Scanner */}
          <div className="relative w-64 h-64 sm:w-72 sm:h-72 flex items-center justify-center">
            {/* SVG Circular Animated Progress Ring */}
            <svg
              className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none z-20"
              viewBox="0 0 100 100"
            >
              {/* Background ring */}
              <circle
                cx="50"
                cy="50"
                r="46"
                fill="none"
                stroke="rgba(255, 255, 255, 0.08)"
                strokeWidth="3"
              />
              {/* Animated Progress ring */}
              <circle
                cx="50"
                cy="50"
                r="46"
                fill="none"
                stroke={isDoneAll || isHoldingPose ? "#10b981" : "rgba(255, 255, 255, 0.4)"}
                strokeWidth="3.5"
                strokeDasharray="289"
                strokeDashoffset={289 - (289 * stepProgress) / 100}
                strokeLinecap="round"
                className="transition-all duration-150 ease-out"
                style={{
                  filter: isHoldingPose
                    ? "drop-shadow(0 0 8px rgba(16, 185, 129, 0.8))"
                    : "none",
                }}
              />
            </svg>

            {/* Direction Arrows */}
            {!isHoldingPose && !isDoneAll && isCameraActive && (
              <>
                {currentStep.direction === "left" && (
                  <div className="absolute -left-3 z-30 flex items-center p-2 rounded-full bg-emerald-500/20 border border-emerald-400 text-emerald-300 animate-pulse shadow-lg">
                    <ArrowLeft className="h-5 w-5" />
                  </div>
                )}
                {currentStep.direction === "right" && (
                  <div className="absolute -right-3 z-30 flex items-center p-2 rounded-full bg-emerald-500/20 border border-emerald-400 text-emerald-300 animate-pulse shadow-lg">
                    <ArrowRight className="h-5 w-5" />
                  </div>
                )}
                {currentStep.direction === "up" && (
                  <div className="absolute -top-3 z-30 flex items-center p-2 rounded-full bg-emerald-500/20 border border-emerald-400 text-emerald-300 animate-pulse shadow-lg">
                    <ArrowUp className="h-5 w-5" />
                  </div>
                )}
              </>
            )}

            {/* Circular Video Frame */}
            <div
              className={`relative w-[230px] h-[230px] sm:w-[260px] sm:h-[260px] rounded-full overflow-hidden bg-black flex items-center justify-center border-2 transition-all duration-300 z-10 ${
                isDoneAll
                  ? "border-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.5)]"
                  : isHoldingPose
                  ? "border-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.6)]"
                  : "border-white/15"
              }`}
            >
              {/* Shutter Flash Animation */}
              {isFlashing && (
                <div className="absolute inset-0 bg-white z-40 pointer-events-none animate-out fade-out duration-200" />
              )}

              {/* Clean Video */}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover transform -scale-x-100 ${
                  !isCameraActive ? "hidden" : ""
                }`}
              />

              {/* Loading State */}
              {!isCameraActive && !cameraError && (
                <div className="flex flex-col items-center gap-2 text-slate-400">
                  <Camera className="h-8 w-8 text-slate-300 animate-pulse" />
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

              {/* Done Completion Overlay */}
              {isDoneAll && (
                <div className="absolute inset-0 bg-emerald-950/85 backdrop-blur-md flex flex-col items-center justify-center gap-2 animate-in zoom-in-95 duration-200 z-30">
                  <div className="h-14 w-14 rounded-full bg-emerald-500/20 border border-emerald-400 flex items-center justify-center text-emerald-300 shadow-lg">
                    <CheckCircle2 className="h-8 w-8" />
                  </div>
                  <p className="text-sm font-semibold text-emerald-200">
                    Xác thực hoàn tất
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Captured Thumbnails Strip */}
          {capturedImages.length > 0 && (
            <div className="mt-5 flex items-center gap-2">
              {capturedImages.map((img, idx) => (
                <div
                  key={idx}
                  className="h-10 w-10 rounded-full border border-emerald-400/50 overflow-hidden bg-slate-800 shadow-sm"
                >
                  <img
                    src={img}
                    alt={`Góc ${idx + 1}`}
                    className="h-full w-full object-cover transform -scale-x-100"
                  />
                </div>
              ))}
              {Array.from({ length: 5 - capturedImages.length }).map((_, i) => (
                <div
                  key={i}
                  className="h-10 w-10 rounded-full border border-dashed border-white/15 flex items-center justify-center text-[10px] text-slate-500"
                >
                  {capturedImages.length + i + 1}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bottom Actions Bar */}
        <div className="px-6 py-4 bg-white/[0.02] border-t border-white/5 flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleRestart}
            disabled={capturedImages.length === 0}
            className="text-slate-400 hover:text-slate-200 text-xs flex items-center gap-1.5"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Quét lại
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={() => onCompleteAll(capturedImages)}
            disabled={capturedImages.length < EKYC_STEPS.length}
            className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold px-4 text-xs shadow-lg shadow-emerald-500/20"
          >
            <Sparkles className="h-3.5 w-3.5 mr-1" />
            Hoàn tất ({capturedImages.length}/5)
          </Button>
        </div>
      </div>
    </div>
  );
};
