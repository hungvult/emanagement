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
import { AsyncSession, openSessionCamera } from "../../lib/async-session";

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
  const sessionRef = useRef(new AsyncSession());
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
    sessionRef.current.cancel();
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
        videoRef.current.play().catch(() => {});
      }
    } catch (err: any) {
      if (!session.isCurrent(revision)) return;
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
      const timer = sessionRef.current.schedule(() => {
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

  // Restart scan về đầu bước 1
  const handleRestart = useCallback(() => {
    sessionRef.current.cancel();
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
    setIsHoldingPose(false);
    poseHoldTimeRef.current = 0;
    lastVoiceTimeRef.current = 0;
    setPromptMessage(EKYC_STEPS[0].title);
    ekycAudio.speak("Bắt đầu lại xác thực từ bước 1", true);
  }, []);

  // Step success transition
  const handleStepSuccess = useCallback(async () => {
    const session = sessionRef.current;
    const revision = session.current;
    if (isTransitioningRef.current) return;
    isTransitioningRef.current = true;

    const frameBase64 = captureCurrentFrame();
    if (frameBase64) {
      // 1. Kiểm tra Anti-Spoofing & tính hợp lệ ngay sau mỗi ảnh quét (cả 5 bước)
      try {
        const valResp = await fetch("/api/v1/cv/validate-frame", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image: frameBase64,
            check_pose: currentStepIdx === 0 || currentStepIdx === 1,
          }),
        });
        const valData = await valResp.json();
        if (!session.isCurrent(revision)) return;
        if (valData.status === "SPOOF_DETECTED") {
          const stepNum = currentStepIdx + 1;
          const errText = `Phát hiện giả mạo khuôn mặt (ảnh điện thoại/ảnh in) ở bước ${stepNum}!`;
          setPromptMessage(errText);
          ekycAudio.speak("Phát hiện giả mạo khuôn mặt, vui lòng quét lại từ đầu", true);
          sessionRef.current.schedule(() => {
            handleRestart();
          }, 2500);
          return;
        }
        if (!valResp.ok || valData.status !== "VALID") {
          const stepNum = currentStepIdx + 1;
          const errText = valData.message || `Ảnh ở bước ${stepNum} không hợp lệ! Vui lòng quét lại.`;
          setPromptMessage(errText);
          ekycAudio.speak(errText, true);
          sessionRef.current.schedule(() => {
            handleRestart();
          }, 2500);
          return;
        }
      } catch (e) {
        if (!session.isCurrent(revision)) return;
        console.error("Lỗi khi validate-frame:", e);
        const errText = "Không thể kiểm tra ảnh. Vui lòng kiểm tra kết nối và quét lại.";
        setPromptMessage(errText);
        ekycAudio.speak(errText, true);
        sessionRef.current.schedule(handleRestart, 2500);
        return;
      }

      // Chớp sáng và phát âm thanh chụp ảnh
      setIsFlashing(true);
      sessionRef.current.schedule(() => setIsFlashing(false), 200);
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
        sessionRef.current.schedule(() => {
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
        sessionRef.current.schedule(async () => {
          try {
            await onCompleteAll(nextList);
          } catch (error: any) {
            if (!session.isCurrent(revision)) return;
            setIsDoneAll(false);
            const errText = error.message || "Xác thực thất bại! Vui lòng quét lại từ đầu.";
            setPromptMessage(errText);
            ekycAudio.speak(errText, true);
            // TỰ ĐỘNG RESET VỀ ĐẦU BƯỚC 1 ĐỂ QUÉT LẠI
            sessionRef.current.schedule(() => {
              handleRestart();
            }, 2500);
          }
        }, 700);
      }
    } else {
      isTransitioningRef.current = false;
    }
  }, [captureCurrentFrame, currentStepIdx, onCaptureFrame, capturedImages, onCompleteAll, handleRestart]);

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
            if (!isSubscribed) return;

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



  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 animate-in fade-in zoom-in-95 duration-300">
      {/* Premium Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      {/* Main Premium Modal Card */}
      <div className="relative w-full max-w-[420px] overflow-hidden rounded-[32px] bg-white border border-slate-100 text-slate-900 shadow-2xl flex flex-col z-10">
        
        {/* Glow Effects */}
        <div className="absolute top-0 right-0 -translate-y-12 translate-x-1/3 w-64 h-64 bg-indigo-50 rounded-full blur-3xl opacity-60 pointer-events-none"></div>

        {/* Top Minimalist Header */}
        <div className="relative z-10 flex items-center justify-between px-7 pt-7 pb-4">
          <div>
            <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">
              Xác thực khuôn mặt
            </h3>
            <p className="text-sm font-medium text-slate-500 mt-0.5">
              {employeeName} • <span className="text-indigo-500">{employeeCode}</span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleMute}
              className="p-2.5 rounded-full bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-all border border-slate-100 shadow-sm"
              title={isMuted ? "Bật âm thanh" : "Tắt âm thanh"}
            >
              {isMuted ? (
                <VolumeX className="h-4 w-4 text-rose-500" />
              ) : (
                <Volume2 className="h-4 w-4 text-emerald-500" />
              )}
            </button>
            <button
              onClick={onClose}
              className="p-2.5 rounded-full bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-all border border-slate-100 shadow-sm"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Step Progress Segmented Bar */}
        <div className="px-7 flex items-center justify-center gap-2 mb-2 relative z-10">
          {EKYC_STEPS.map((step, idx) => {
            const isDone = idx < currentStepIdx || (isDoneAll && idx <= currentStepIdx);
            const isCur = idx === currentStepIdx && !isDoneAll;
            return (
              <div
                key={`${step.id}-${idx}`}
                className={`h-1.5 rounded-full transition-all duration-500 ${
                  isDone
                    ? "w-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]"
                    : isCur
                    ? "w-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.4)]"
                    : "w-full bg-slate-100"
                }`}
              />
            );
          })}
        </div>

        {/* Scanner Center Area */}
        <div className="relative px-6 py-6 flex flex-col items-center justify-center z-10">

          {/* Clean Floating Prompt Pill */}
          <div className="mb-6 text-center min-h-[32px] flex items-center justify-center">
            <div
              className={`inline-flex items-center gap-2.5 px-5 py-2 rounded-full text-[13px] font-bold transition-all duration-300 transform ${
                isHoldingPose
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-[0_4px_15px_rgba(16,185,129,0.15)] scale-105"
                  : "bg-indigo-50/50 text-indigo-700 border border-indigo-100/50"
              }`}
            >
              {isHoldingPose && (
                <span className="flex h-2.5 w-2.5 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                </span>
              )}
              {!isHoldingPose && !isDoneAll && (
                <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
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
                r="47"
                fill="none"
                stroke="#f8fafc"
                strokeWidth="4"
              />
              {/* Animated Progress ring */}
              <circle
                cx="50"
                cy="50"
                r="47"
                fill="none"
                stroke={isDoneAll || isHoldingPose ? "#10b981" : "#6366f1"}
                strokeWidth="4"
                strokeDasharray="295"
                strokeDashoffset={295 - (295 * stepProgress) / 100}
                strokeLinecap="round"
                className="transition-all duration-200 ease-out"
                style={{
                  filter: isHoldingPose || isDoneAll
                    ? "drop-shadow(0 0 6px rgba(16, 185, 129, 0.6))"
                    : "drop-shadow(0 0 6px rgba(99, 102, 241, 0.4))",
                }}
              />
            </svg>

            {/* Direction Arrows */}
            {!isHoldingPose && !isDoneAll && isCameraActive && (
              <>
                {currentStep.direction === "left" && (
                  <div className="absolute -left-4 z-30 flex items-center p-2.5 rounded-full bg-white border border-indigo-100 text-indigo-600 animate-bounce shadow-xl">
                    <ArrowLeft className="h-6 w-6" />
                  </div>
                )}
                {currentStep.direction === "right" && (
                  <div className="absolute -right-4 z-30 flex items-center p-2.5 rounded-full bg-white border border-indigo-100 text-indigo-600 animate-bounce shadow-xl">
                    <ArrowRight className="h-6 w-6" />
                  </div>
                )}
                {currentStep.direction === "up" && (
                  <div className="absolute -top-4 z-30 flex items-center p-2.5 rounded-full bg-white border border-indigo-100 text-indigo-600 animate-bounce shadow-xl">
                    <ArrowUp className="h-6 w-6" />
                  </div>
                )}
              </>
            )}

            {/* Circular Video Frame */}
            <div
              className={`relative w-[236px] h-[236px] sm:w-[266px] sm:h-[266px] rounded-full overflow-hidden bg-slate-100 flex items-center justify-center transition-all duration-300 z-10 shadow-inner ${
                isDoneAll
                  ? "ring-4 ring-emerald-400 ring-offset-4 ring-offset-white"
                  : isHoldingPose
                  ? "ring-4 ring-emerald-400 ring-offset-4 ring-offset-white"
                  : "ring-4 ring-slate-50 ring-offset-0"
              }`}
            >
              {/* Shutter Flash Animation */}
              {isFlashing && (
                <div className="absolute inset-0 bg-white z-40 pointer-events-none animate-out fade-out duration-300" />
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
                <div className="flex flex-col items-center gap-3 text-slate-400">
                  <div className="h-12 w-12 rounded-full bg-white flex items-center justify-center shadow-sm animate-pulse">
                    <Camera className="h-5 w-5 text-indigo-500" />
                  </div>
                  <p className="text-xs font-semibold">Đang mở máy ảnh...</p>
                </div>
              )}

              {/* Error State */}
              {cameraError && (
                <div className="flex flex-col items-center gap-3 text-rose-500 p-6 text-center bg-rose-50 h-full w-full justify-center">
                  <p className="text-xs font-semibold">{cameraError}</p>
                  <Button
                    size="sm"
                    onClick={startCamera}
                    className="mt-2 text-xs font-bold bg-white text-rose-600 hover:bg-rose-100 border border-rose-200"
                  >
                    Thử lại
                  </Button>
                </div>
              )}

              {/* Done Completion Overlay */}
              {isDoneAll && (
                <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center gap-3 animate-in zoom-in-95 duration-300 z-30">
                  <div className="h-16 w-16 rounded-full bg-emerald-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/30">
                    <CheckCircle2 className="h-8 w-8" />
                  </div>
                  <p className="text-sm font-extrabold text-slate-800">
                    Đang lưu dữ liệu
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Captured Thumbnails Strip */}
          <div className="mt-8 flex items-center gap-2.5 h-12">
            {capturedImages.length > 0 ? (
              <>
                {capturedImages.map((img, idx) => (
                  <div
                    key={idx}
                    className="h-12 w-12 rounded-full border-2 border-emerald-500 overflow-hidden bg-white shadow-md animate-in zoom-in duration-300"
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
                    className="h-10 w-10 rounded-full border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center text-[11px] font-bold text-slate-300"
                  >
                    {capturedImages.length + i + 1}
                  </div>
                ))}
              </>
            ) : (
              <div className="flex items-center gap-2.5 opacity-50">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-10 w-10 rounded-full border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center text-[11px] font-bold text-slate-300"
                  >
                    {i + 1}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Bottom Actions Bar */}
        <div className="px-7 py-5 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between z-10">
          <Button
            type="button"
            variant="ghost"
            onClick={handleRestart}
            disabled={capturedImages.length === 0 || isDoneAll}
            className="text-slate-500 hover:text-slate-900 hover:bg-white text-sm font-bold flex items-center gap-2 rounded-xl h-10 px-4 transition-all"
          >
            <RefreshCw className="h-4 w-4" /> Quét lại
          </Button>

          <Button
            type="button"
            disabled
            className={`font-bold px-6 text-sm h-10 rounded-xl flex items-center shadow-lg transition-all ${
              capturedImages.length < EKYC_STEPS.length
                ? "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"
                : "bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/20"
            }`}
          >
            <Sparkles className="h-4 w-4 mr-1.5" />
            {isDoneAll ? "Đang lưu..." : `Hoàn tất (${capturedImages.length}/5)`}
          </Button>
        </div>
      </div>
    </div>
  );
};
