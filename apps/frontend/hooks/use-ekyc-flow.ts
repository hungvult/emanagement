"use client";
import { getErrorMessage } from "@/lib/errors";
import { useCamera } from "@/hooks/use-camera";
import { cvService } from "@/services/cv.service";

import { EKYC_STEPS } from "@/constants/ekyc";
import { AsyncSession } from "@/lib/async-session";
import { captureOptimizedFrame } from "@/lib/camera-utils";
import { ekycAudio } from "@/lib/ekyc-audio";
import {
  BiometricAnalysisResult,
  ekycMediaPipe,
  Landmark3D,
} from "@/lib/ekyc-mediapipe";
import { useCallback, useEffect, useRef, useState } from "react";

export interface EkycFlowOptions {
  isOpen: boolean;
  onClose: () => void;
  employeeName: string;
  employeeCode: string;
  onCaptureFrame?: (imageBase64: string, index: number) => Promise<void>;
  onCompleteAll: (allImages: string[]) => Promise<void>;
}

export function useEkycFlow({
  isOpen,
  onCaptureFrame,
  onCompleteAll,
}: EkycFlowOptions) {
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [stepProgress, setStepProgress] = useState(0); // 0 to 100
  const [isHoldingPose, setIsHoldingPose] = useState(false);
  const [isFlashing, setIsFlashing] = useState(false);
  const [isDoneAll, setIsDoneAll] = useState(false);
  const [promptMessage, setPromptMessage] = useState<string>(
    "Vui lòng nhìn thẳng vào vòng tròn",
  );
  const sessionRef = useRef(new AsyncSession());
  const {
    videoRef,
    isCameraActive,
    cameraError,
    startCamera: openCamera,
    stopCamera: closeCamera,
  } = useCamera(sessionRef);
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
    closeCamera();
    ekycAudio.stopSpeaking();
  }, [closeCamera]);

  const startCamera = useCallback(async () => {
    await openCamera();
  }, [openCamera]);

  // Pre-load MediaPipe FaceMesh
  useEffect(() => {
    ekycMediaPipe.loadModel().catch(() => {});
  }, []);

  // Initialize on open
  useEffect(() => {
    if (isOpen) {
      // Opening a new session clears progress from the previous session.
      // eslint-disable-next-line react-hooks/set-state-in-effect
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

  // Speak step prompt when step changes
  useEffect(() => {
    if (isOpen && isCameraActive && !isDoneAll) {
      const timer = sessionRef.current.schedule(() => {
        ekycAudio.speak(currentStep.voicePrompt, true);
        lastVoiceTimeRef.current = Date.now();
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [
    isOpen,
    isCameraActive,
    currentStepIdx,
    isDoneAll,
    currentStep.voicePrompt,
  ]);

  // Toggle Mute
  const handleToggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    ekycAudio.setMuted(nextMuted);
  };

  // Capture current frame
  const captureCurrentFrame = useCallback((): string | null => {
    return captureOptimizedFrame(videoRef.current, 720, 0.88);
  }, [videoRef]);

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
        const valData = await cvService.validateFrame(
          frameBase64,
          currentStepIdx === 0 || currentStepIdx === 1,
        );
        if (!session.isCurrent(revision)) return;
        if (valData.status === "SPOOF_DETECTED") {
          const stepNum = currentStepIdx + 1;
          const errText = `Phát hiện giả mạo khuôn mặt (ảnh điện thoại/ảnh in) ở bước ${stepNum}!`;
          setPromptMessage(errText);
          ekycAudio.speak(
            "Phát hiện giả mạo khuôn mặt, vui lòng quét lại từ đầu",
            true,
          );
          sessionRef.current.schedule(() => {
            handleRestart();
          }, 2500);
          return;
        }
        if (valData.status !== "VALID") {
          const stepNum = currentStepIdx + 1;
          const errText =
            valData.message ||
            `Ảnh ở bước ${stepNum} không hợp lệ! Vui lòng quét lại.`;
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
        const errText =
          "Không thể kiểm tra ảnh. Vui lòng kiểm tra kết nối và quét lại.";
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
          } catch (error: unknown) {
            if (!session.isCurrent(revision)) return;
            setIsDoneAll(false);
            const errText = getErrorMessage(
              error,
              "Xác thực thất bại! Vui lòng quét lại từ đầu.",
            );
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
  }, [
    captureCurrentFrame,
    currentStepIdx,
    onCaptureFrame,
    capturedImages,
    onCompleteAll,
    handleRestart,
  ]);

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
            const res: BiometricAnalysisResult =
              await ekycMediaPipe.processFrame(video, currentStep.id);
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
                  ekycAudio.speak(
                    "Vui lòng giữ khuôn mặt liên tục trong khung hình",
                    true,
                  );
                  return;
                }
              } else if (res.status === "MULTIPLE_FACES") {
                handleRestart();
                setPromptMessage("Phát hiện nhiều người! Bắt đầu lại.");
                ekycAudio.speak(
                  "Vui lòng chỉ một người đứng trước máy ảnh",
                  true,
                );
                return;
              } else {
                noFaceDurationRef.current = 0;
              }

              // Kiểm tra nếu phát hiện đổi khuôn mặt (tỷ lệ giải phẫu khác khuôn mặt ban đầu)
              if (
                res.message &&
                res.message.includes("Phát hiện đổi khuôn mặt")
              ) {
                faceMismatchDurationRef.current += delta;
                if (faceMismatchDurationRef.current >= 400) {
                  faceMismatchDurationRef.current = 0;
                  handleRestart();
                  setPromptMessage(
                    "Phát hiện đổi người! Đã hủy và quay lại bước 1.",
                  );
                  ekycAudio.speak(
                    "Phát hiện đổi người, vui lòng không đổi người",
                    true,
                  );
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
            if (
              !res.isMatched &&
              currentTime - lastVoiceTimeRef.current > 4000
            ) {
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
                const progress = Math.min(
                  100,
                  Math.round((poseHoldTimeRef.current / targetHoldMs) * 100),
                );
                setStepProgress(progress);

                if (progress >= 100) {
                  handleStepSuccess();
                }
              } else {
                setIsHoldingPose(false);
                poseHoldTimeRef.current = Math.max(
                  0,
                  poseHoldTimeRef.current - delta * 0.5,
                );
                setStepProgress(
                  Math.round((poseHoldTimeRef.current / targetHoldMs) * 100),
                );
              }
            }
          } catch {
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
  }, [
    isOpen,
    isCameraActive,
    isDoneAll,
    currentStep.id,
    handleStepSuccess,
    currentStepIdx,
    capturedImages.length,
    handleRestart,
    videoRef,
  ]);
  return {
    handleToggleMute,
    isMuted,
    currentStepIdx,
    isDoneAll,
    isHoldingPose,
    promptMessage,
    stepProgress,
    isCameraActive,
    currentStep,
    isFlashing,
    videoRef,
    cameraError,
    startCamera,
    capturedImages,
    handleRestart,
  };
}
