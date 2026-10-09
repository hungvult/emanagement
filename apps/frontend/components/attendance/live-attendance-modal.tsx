"use client";
import { getErrorMessage } from "@/lib/errors";
import { useCamera } from "@/hooks/use-camera";
import { Button } from "@/components/ui/button";
import { AsyncSession } from "@/lib/async-session";
import { AttendanceScanGate } from "@/lib/attendance-scan-gate";
import {
  ATTENDANCE_BRIGHTNESS_MIN,
  INSUFFICIENT_LIGHT_MESSAGE,
  captureOptimizedFrame,
  measureFrameBrightness,
} from "@/lib/camera-utils";
import { ekycAudio } from "@/lib/ekyc-audio";
import { BiometricAnalysisResult, ekycMediaPipe } from "@/lib/ekyc-mediapipe";
import { kioskService } from "@/services/kiosk.service";
import { KioskCheckInResponse } from "@/types/kiosk.types";
import {
  Activity,
  Camera,
  CheckCircle2,
  Clock,
  Eye,
  Moon,
  RefreshCw,
  Sparkles,
  Sun,
  Volume2,
  VolumeX,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";

interface LiveAttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const IDLE_TIMEOUT_MS = 6000; // 6 giây không thấy người thì tự động ngủ
const SLEEP_INTERVAL_MS = 750; // Khi ngủ: chỉ quét nhẹ nhàng mỗi 750ms để tiết kiệm CPU/GPU
const ACTIVE_INTERVAL_MS = 45; // Khi thức: quét tốc độ cao 45ms để bắt kịp khuôn mặt

export const LiveAttendanceModal: React.FC<LiveAttendanceModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [isScanning, setIsScanning] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [scanResult, setScanResult] = useState<KioskCheckInResponse | null>(
    null,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isFlashing, setIsFlashing] = useState(false);
  const [promptMessage, setPromptMessage] = useState<string>(
    "Vui lòng nhìn thẳng vào camera để chấm công",
  );
  const [isLightingInsufficient, setIsLightingInsufficient] = useState(false);
  const [isFaceDetected, setIsFaceDetected] = useState<boolean>(false);

  // Smart Standby / Sleep & Wake-up State
  const [isAutoSleepEnabled, setIsAutoSleepEnabled] = useState<boolean>(true);
  const [isSleepModeActive, setIsSleepModeActive] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<string>("");
  const [currentDate, setCurrentDate] = useState<string>("");

  const sessionRef = useRef(new AsyncSession());
  const {
    videoRef,
    isCameraActive,
    cameraError,
    startCamera: openCamera,
    stopCamera: closeCamera,
  } = useCamera(sessionRef);
  const scanGateRef = useRef(new AttendanceScanGate());
  const [waitingForDeparture, setWaitingForDeparture] = useState(false);

  const animFrameRef = useRef<number | null>(null);
  const isProcessingRef = useRef<boolean>(false);
  const steadyCountRef = useRef<number>(0);
  const lastVoiceTimeRef = useRef<number>(0);
  const lastFaceSeenTimeRef = useRef<number>(Date.now());
  const isSleepingRef = useRef<boolean>(false);

  // Đồng bộ ref với state để tránh stale closure trong requestAnimationFrame
  useEffect(() => {
    isSleepingRef.current = isSleepModeActive;
  }, [isSleepModeActive]);

  // Đồng hồ thời gian thực cho màn hình chờ Standby
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString("vi-VN", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
      setCurrentDate(
        now.toLocaleDateString("vi-VN", {
          weekday: "long",
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        })
      );
    };

    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  // Stop camera & loops
  const stopCamera = useCallback(() => {
    sessionRef.current.cancel();
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    closeCamera();
    isProcessingRef.current = false;
    steadyCountRef.current = 0;
    setIsSleepModeActive(false);
    setIsLightingInsufficient(false);
    ekycAudio.stopSpeaking();
  }, [closeCamera]);

  const startCamera = useCallback(async () => {
    setScanResult(null);
    setErrorMessage(null);
    lastFaceSeenTimeRef.current = Date.now();
    await openCamera();
  }, [openCamera]);

  // Đánh thức hệ thống (Wake Up)
  const wakeUp = useCallback(() => {
    setIsSleepModeActive(false);
    isSleepingRef.current = false;
    lastFaceSeenTimeRef.current = Date.now();
    steadyCountRef.current = 0;
    setPromptMessage("Vui lòng nhìn thẳng vào camera để chấm công");
    ekycAudio.playWakeUpSound();
    ekycAudio.speak("Xin chào, vui lòng nhìn thẳng vào camera", true);
  }, []);

  // Đưa hệ thống vào chế độ ngủ (Go To Sleep)
  const goToSleep = useCallback(() => {
    setIsSleepModeActive(true);
    isSleepingRef.current = true;
    setIsFaceDetected(false);
    steadyCountRef.current = 0;
    setPromptMessage("Hệ thống đang ở chế độ chờ tiết kiệm điện");
  }, []);

  // Capture current frame (optimized resolution & quality)
  const captureFrame = useCallback((): string | null => {
    return captureOptimizedFrame(videoRef.current);
  }, [videoRef]);

  // Clear the previous result after departure or an explicit retry of a failed scan.
  const handleReset = useCallback(() => {
    setWaitingForDeparture(false);
    setScanResult(null);
    setErrorMessage(null);
    ekycMediaPipe.resetBlink();
    isProcessingRef.current = false;
    steadyCountRef.current = 0;
    lastFaceSeenTimeRef.current = Date.now();
    setIsLightingInsufficient(false);
    setPromptMessage("Vui lòng nhìn thẳng vào camera để chấm công");
  }, []);

  const handleRetry = useCallback(() => {
    if (
      !isOpen ||
      !isCameraActive ||
      !errorMessage ||
      scanResult ||
      isProcessingRef.current
    )
      return;
    scanGateRef.current.reset();
    lastVoiceTimeRef.current = 0;
    ekycAudio.stopSpeaking();
    handleReset();
  }, [isOpen, isCameraActive, errorMessage, scanResult, handleReset]);

  // Perform Attendance Check-in (chụp và gửi lên backend xác thực MiniFASNet & SFace)
  const executeCheckIn = useCallback(async () => {
    const session = sessionRef.current;
    const revision = session.current;
    const frameBase64 = captureFrame();
    if (!frameBase64) {
      isProcessingRef.current = false;
      return;
    }

    setIsScanning(true);
    setErrorMessage(null);

    // Flash & chime
    setIsFlashing(true);
    session.schedule(() => setIsFlashing(false), 200);
    ekycAudio.playShutterSound();

    try {
      const res = await kioskService.checkIn("WEB_KIOSK_DEFAULT", {
        imageFrameBase64: frameBase64,
      });
      if (!session.isCurrent(revision)) return;

      if (res.status === "SUCCESS" && res.data) {
        setScanResult(res.data);
        ekycAudio.playSuccessChime();
        const actionText =
          res.data.checkType === "CHECK_IN"
            ? "Check in thành công"
            : "Check out thành công";
        ekycAudio.speak(actionText, true);
      } else {
        const message = res.message || "Không thể nhận diện khuôn mặt";
        setErrorMessage(message);
        ekycAudio.speak(
          message.includes("ánh sáng") || message.includes("IMAGE_TOO_DARK")
            ? INSUFFICIENT_LIGHT_MESSAGE
            : "Nhận diện thất bại",
        );
      }
    } catch (err: unknown) {
      if (!session.isCurrent(revision)) return;
      const msg = getErrorMessage(
        err,
        "Không tìm thấy khuôn mặt phù hợp trong hệ thống",
      );
      setErrorMessage(msg);

      let spokenError = "Nhận diện thất bại";
      if (msg.includes("ánh sáng") || msg.includes("IMAGE_TOO_DARK")) {
        spokenError = INSUFFICIENT_LIGHT_MESSAGE;
      } else if (
        msg.includes("Không phát hiện khuôn mặt") ||
        msg.includes("NO_FACE")
      ) {
        spokenError = "Không có khuôn mặt";
      } else if (
        msg.includes("Không nhận diện được khuôn mặt") ||
        msg.includes("UNKNOWN_FACE")
      ) {
        spokenError = "Người lạ, không nhận diện được";
      } else if (msg.includes("giả mạo") || msg.includes("SPOOF_DETECTED")) {
        spokenError = "Phát hiện giả mạo khuôn mặt";
      } else if (msg.includes("tranh chấp")) {
        spokenError = "Tranh chấp nhận diện";
      }

      ekycAudio.speak(spokenError);
    } finally {
      if (session.isCurrent(revision)) {
        setIsScanning(false);
        isProcessingRef.current = false;
        lastFaceSeenTimeRef.current = Date.now();
        scanGateRef.current.waitForDeparture(Date.now());
        setWaitingForDeparture(true);
        setPromptMessage(
          "Vui lòng rời khỏi khung hình để bắt đầu lượt chấm công tiếp theo",
        );
      }
    }
  }, [captureFrame]);

  // Initialize
  useEffect(() => {
    if (isOpen) {
      scanGateRef.current.reset();
      // Synchronize this screen with an external request or camera session.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setWaitingForDeparture(false);
      setIsScanning(false);
      setIsFlashing(false);
      ekycMediaPipe.loadModel().catch(() => {});
      ekycMediaPipe.clearReferenceFace();
      setScanResult(null);
      setErrorMessage(null);
      isProcessingRef.current = false;
      steadyCountRef.current = 0;
      lastVoiceTimeRef.current = 0;
      lastFaceSeenTimeRef.current = Date.now();
      setIsSleepModeActive(false);
      setIsLightingInsufficient(false);
      setPromptMessage("Vui lòng nhìn thẳng vào camera để chấm công");
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

  // Real-time Fast Check-in Loop with Smart Auto-Sleep & Wake-Up (Passive Anti-Spoofing MiniFASNet)
  useEffect(() => {
    if (!isOpen || !isCameraActive) return;

    let isSubscribed = true;
    let lastTime = performance.now();
    const lightingCanvas = document.createElement("canvas");

    const processFrame = async () => {
      if (!isSubscribed) return;

      const now = performance.now();
      const delta = now - lastTime;
      const currentlySleeping = isSleepingRef.current;
      const targetInterval = currentlySleeping ? SLEEP_INTERVAL_MS : ACTIVE_INTERVAL_MS;

      if (
        delta >= targetInterval &&
        videoRef.current &&
        !isProcessingRef.current
      ) {
        lastTime = now;
        const video = videoRef.current;

        if (video.videoWidth > 0 && video.videoHeight > 0) {
          try {
            // Định vị khuôn mặt nhìn thẳng chính diện
            const res: BiometricAnalysisResult =
              await ekycMediaPipe.processFrame(video, "front");
            if (!isSubscribed) return;

            if (scanGateRef.current.waiting) {
              if (scanGateRef.current.observe(res.facePresence, Date.now())) {
                handleReset();
              }
              // Continue detecting departure even while showing the previous result.
              animFrameRef.current = requestAnimationFrame(processFrame);
              return;
            }

            // 1. NẾU ĐANG Ở CHẾ ĐỘ NGỦ (STANDBY)
            if (currentlySleeping) {
              if (res.status !== "NO_FACE") {
                // TỰ ĐỘNG ĐÁNH THỨC KHI THẤY MẶT NGƯỜI BƯỚC TỚI
                wakeUp();
              }
              animFrameRef.current = requestAnimationFrame(processFrame);
              return;
            }

            // 2. NẾU ĐANG Ở CHẾ ĐỘ THỨC & QUÉT (ACTIVE)
            const brightness = measureFrameBrightness(
              video,
              lightingCanvas,
              res.landmarks,
            );
            const tooDark =
              brightness !== null && brightness < ATTENDANCE_BRIGHTNESS_MIN;
            setIsLightingInsufficient(tooDark);

            // Cập nhật thông báo hướng dẫn người dùng
            if (tooDark) {
              steadyCountRef.current = 0;
              setPromptMessage(INSUFFICIENT_LIGHT_MESSAGE);
            } else if (brightness === null) {
              steadyCountRef.current = 0;
              setPromptMessage("Đang kiểm tra ánh sáng camera...");
            } else if (res.status === "NO_FACE") {
              setIsFaceDetected(false);
              steadyCountRef.current = 0;
              setPromptMessage("Vui lòng đưa khuôn mặt vào giữa khung hình");

              // KIỂM TRA ĐIỀU KIỆN TỰ ĐỘNG ĐI NGỦ (sau IDLE_TIMEOUT_MS không thấy mặt)
              if (isAutoSleepEnabled) {
                const idleDuration = Date.now() - lastFaceSeenTimeRef.current;
                if (idleDuration >= IDLE_TIMEOUT_MS) {
                  goToSleep();
                }
              }
            } else {
              // Có khuôn mặt trong khung hình -> Cập nhật thời gian nhìn thấy mặt
              lastFaceSeenTimeRef.current = Date.now();
              setIsFaceDetected(true);

              if (res.status === "MULTIPLE_FACES") {
                steadyCountRef.current = 0;
                setPromptMessage(
                  "Phát hiện nhiều người! Vui lòng chỉ một người đứng trước camera",
                );
              } else if (res.status === "NOT_CENTERED") {
                steadyCountRef.current = 0;
                setPromptMessage("Vui lòng căn giữa khuôn mặt trong vòng tròn");
              } else if (res.status === "TOO_FAR") {
                steadyCountRef.current = 0;
                setPromptMessage("Vui lòng tiến lại gần camera hơn");
              } else if (res.status === "TOO_CLOSE") {
                steadyCountRef.current = 0;
                setPromptMessage("Vui lòng lùi lại một chút");
              } else {
                if (res.isMatched) {
                  steadyCountRef.current += 1;
                  // Giữ tư thế thẳng ổn định ~200ms (5 frame) để chống nhòe và chụp ngay lập tức
                  if (steadyCountRef.current >= 5 && !isProcessingRef.current) {
                    isProcessingRef.current = true;
                    setPromptMessage("Đang nhận diện khuôn mặt...");
                    executeCheckIn();
                    // Keep the loop alive, including when frame capture fails.
                    animFrameRef.current = requestAnimationFrame(processFrame);
                    return;
                  } else {
                    setPromptMessage("Giữ yên khuôn mặt...");
                  }
                } else {
                  steadyCountRef.current = 0;
                  setPromptMessage(
                    res.message || "Vui lòng nhìn thẳng vào camera để chấm công",
                  );
                }
              }

              // Nhắc nhở bằng giọng nói định kỳ (mỗi 5 giây) nếu đã thấy mặt
              const currentTime = Date.now();
              if (
                currentTime - lastVoiceTimeRef.current > 5000 &&
                !isProcessingRef.current
              ) {
                lastVoiceTimeRef.current = currentTime;
                ekycAudio.speak("Vui lòng nhìn thẳng vào camera để chấm công");
              }
            }
          } catch {
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
  }, [
    isOpen,
    isCameraActive,
    executeCheckIn,
    handleReset,
    videoRef,
    isAutoSleepEnabled,
    wakeUp,
    goToSleep,
  ]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="relative w-full max-w-lg overflow-hidden rounded-[32px] bg-white/95 backdrop-blur-xl border border-white shadow-2xl flex flex-col z-10 animate-in zoom-in-95 duration-300">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div
              className={`h-10 w-10 rounded-xl border flex items-center justify-center transition-colors shadow-sm ${
                isSleepModeActive
                  ? "bg-indigo-50 border-indigo-200 text-indigo-500"
                  : "bg-indigo-50 border-indigo-100 text-indigo-600"
              }`}
            >
              {isSleepModeActive ? (
                <Moon className="h-5 w-5 animate-pulse" />
              ) : (
                <Zap className="h-5 w-5 animate-pulse" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 tracking-tight">
                  Chấm công Face ID Kiosk
                </h3>
                {isSleepModeActive && (
                  <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200 text-[10px] font-semibold animate-pulse">
                    Đang ngủ (Standby)
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-medium">
                {isSleepModeActive
                  ? "Cảm biến trực chờ • Tự động thức khi có người"
                  : "Nhận diện sinh trắc học AI tự động"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Toggle Chế độ Tự Động Ngủ */}
            <button
              onClick={() => setIsAutoSleepEnabled((prev) => !prev)}
              className={`p-2 rounded-full transition-all border ${
                isAutoSleepEnabled
                  ? "bg-indigo-500/15 border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/25"
                  : "bg-secondary text-muted-foreground border-border hover:bg-secondary/80"
              }`}
              title={
                isAutoSleepEnabled
                  ? "Đang bật tự động ngủ khi vắng người (Bấm để tắt)"
                  : "Đang tắt tự động ngủ (Bấm để bật)"
              }
            >
              {isAutoSleepEnabled ? (
                <Moon className="h-4 w-4" />
              ) : (
                <Sun className="h-4 w-4" />
              )}
            </button>

            {/* Toggle Âm Thanh */}
            <button
              onClick={() => {
                const nextMuted = !isMuted;
                setIsMuted(nextMuted);
                ekycAudio.setMuted(nextMuted);
              }}
              className="p-2 rounded-full bg-white hover:bg-slate-50 text-slate-600 transition-all border border-slate-200 shadow-sm hover:text-indigo-600"
              title={isMuted ? "Bật âm thanh" : "Tắt âm thanh"}
            >
              {isMuted ? (
                <VolumeX className="h-4 w-4 text-rose-500" />
              ) : (
                <Volume2 className="h-4 w-4 text-indigo-500 animate-pulse" />
              )}
            </button>

            {/* Nút Đóng Modal */}
            <button
              onClick={onClose}
              className="p-2 rounded-full bg-white hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 text-slate-600 transition-all border border-slate-200 shadow-sm"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Camera Scanner View */}
        <div className="relative p-6 sm:p-8 flex flex-col items-center justify-center bg-transparent">
          {/* Flash */}
          {isFlashing && (
            <div className="absolute inset-0 bg-white z-40 pointer-events-none animate-out fade-out duration-300" />
          )}

          {/* Scanner Circular Ring */}
          <div className="relative w-64 h-64 sm:w-[300px] sm:h-[300px] flex items-center justify-center">
            {/* Outer Ring */}
            <div
              className={`absolute inset-0 rounded-full border-[3px] transition-all duration-300 ${
                isSleepModeActive
                  ? "border-indigo-300 shadow-[0_0_25px_rgba(99,102,241,0.2)] bg-indigo-500/5 scale-95"
                  : scanResult
                  ? "border-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.4)] bg-emerald-500/5"
                  : errorMessage
                  ? "border-rose-500 shadow-[0_0_30px_rgba(244,63,94,0.4)] bg-rose-500/5"
                  : isLightingInsufficient
                  ? "border-amber-500 shadow-[0_0_30px_rgba(245,158,11,0.4)] bg-amber-500/5"
                  : "border-indigo-400 shadow-[0_0_30px_rgba(99,102,241,0.25)] animate-pulse bg-indigo-500/5"
              }`}
            />

            {/* Video Feed */}
            <div className="relative w-[230px] h-[230px] sm:w-[270px] sm:h-[270px] rounded-full overflow-hidden bg-slate-100 flex items-center justify-center shadow-inner">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover transform -scale-x-100 transition-opacity duration-500 ${
                  !isCameraActive ? "hidden" : isSleepModeActive ? "opacity-25 filter blur-xs" : "opacity-100"
                }`}
              />

              {/* OVERLAY CHẾ ĐỘ NGỦ (STANDBY AMBIENT DISPLAY) */}
              {isSleepModeActive && (
                <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs flex flex-col items-center justify-center p-4 text-center z-30 animate-in fade-in duration-300">
                  <div className="h-10 w-10 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-2 animate-pulse">
                    <Moon className="h-5 w-5" />
                  </div>

                  <div className="font-mono text-2xl sm:text-3xl font-bold tracking-wider text-slate-100 drop-shadow-md">
                    {currentTime || "12:00:00"}
                  </div>

                  <p className="text-[11px] text-slate-400 mt-0.5 font-medium capitalize">
                    {currentDate}
                  </p>

                  <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-[10px] font-medium">
                    <Activity className="h-3 w-3 animate-spin" />
                    <span>Cảm biến đang trực...</span>
                  </div>
                </div>
              )}

              {/* Laser Scan Line (Chỉ hiện khi thức và chưa có kết quả) */}
              {isCameraActive && !isSleepModeActive && !scanResult && !waitingForDeparture && (
                <div className="absolute inset-x-0 h-1.5 bg-gradient-to-r from-transparent via-indigo-500 to-transparent shadow-[0_0_20px_rgba(99,102,241,0.8)] animate-bounce pointer-events-none opacity-80" />
              )}

              {/* Loading State */}
              {!isCameraActive && !cameraError && (
                <div className="flex flex-col items-center gap-3 text-slate-400">
                  <Camera className="h-10 w-10 text-indigo-400 animate-pulse" />
                  <p className="text-xs font-medium">
                    Đang khởi động Camera AI...
                  </p>
                </div>
              )}

              {/* Error State */}
              {cameraError && (
                <div className="flex flex-col items-center gap-2 text-rose-500 p-4 text-center">
                  <p className="text-xs font-medium">{cameraError}</p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={startCamera}
                    className="mt-2 text-xs border-rose-200 hover:bg-rose-50 text-rose-600"
                  >
                    Thử lại
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Result Card or Guidance */}
          <div className="w-full max-w-sm mt-6 text-center">
            {waitingForDeparture && !errorMessage && (
              <p
                role="status"
                className="mb-3 text-sm font-medium text-slate-600"
              >
                Vui lòng rời khỏi khung hình để bắt đầu lượt chấm công tiếp
                theo.
              </p>
            )}
            {isSleepModeActive ? (
              <div className="flex flex-col items-center gap-2 py-1 animate-in fade-in duration-300">
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 text-xs font-semibold shadow-sm">
                  <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
                  <span>Bước vào trước camera để tự động đánh thức</span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={wakeUp}
                  className="mt-1 h-8 px-4 rounded-full text-xs font-semibold border-slate-200 hover:bg-slate-50 text-slate-700"
                >
                  Chạm để quét ngay
                </Button>
              </div>
            ) : scanResult ? (
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 shadow-sm animate-in zoom-in-95 duration-300">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <CheckCircle2 className="h-6 w-6 text-emerald-600 animate-bounce" />
                  <span className="text-base font-bold text-emerald-900 tracking-tight">
                    {scanResult.checkType === "CHECK_IN"
                      ? "CHECK-IN THÀNH CÔNG"
                      : "CHECK-OUT THÀNH CÔNG"}
                  </span>
                </div>
                <div className="text-sm font-semibold text-emerald-800">
                  {scanResult.fullName} ({scanResult.employeeCode})
                </div>
                <div className="mt-2 flex items-center justify-center gap-3 text-xs font-medium text-emerald-700">
                  <span className="flex items-center gap-1 bg-white px-2.5 py-1 rounded-full border border-emerald-100 shadow-sm">
                    <Clock className="h-3.5 w-3.5" />
                    {new Date(scanResult.checkTime).toLocaleTimeString("vi-VN")}
                  </span>
                  <span
                    className={`px-2.5 py-1 rounded-full border shadow-sm ${scanResult.attendanceStatus === "ON_TIME" ? "bg-emerald-100 border-emerald-200 text-emerald-700" : "bg-amber-100 border-amber-200 text-amber-700"}`}
                  >
                    {scanResult.attendanceStatus === "ON_TIME"
                      ? "Đúng giờ"
                      : "Đi muộn"}
                  </span>
                </div>
              </div>
            ) : errorMessage ? (
              <div className="space-y-3">
                <div
                  role="alert"
                  className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-sm font-medium flex items-center justify-center gap-2 animate-in shake duration-300 shadow-sm"
                >
                  <XCircle className="h-5 w-5 text-rose-500 flex-shrink-0" />
                  <span>{errorMessage}</span>
                </div>
                <Button
                  type="button"
                  onClick={handleRetry}
                  disabled={isScanning || !isCameraActive}
                  className="gap-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700"
                >
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />
                  Quét lại
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 py-1">
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 text-xs font-semibold shadow-sm">
                  <Eye className="h-3.5 w-3.5" />
                  <span>Xác thực tính sống AI (Liveness Detection)</span>
                </div>
                <p
                  role="status"
                  aria-live="polite"
                  className={`text-sm font-medium tracking-wide ${
                    isLightingInsufficient
                      ? "text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3"
                      : "text-slate-600"
                  }`}
                >
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
