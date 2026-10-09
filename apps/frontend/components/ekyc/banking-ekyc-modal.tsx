"use client";
import NextImage from "next/image";
import { Button } from "@/components/ui/button";
import { EKYC_STEPS } from "@/constants/ekyc";
import { useEkycFlow, type EkycFlowOptions } from "@/hooks/use-ekyc-flow";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Camera,
  CheckCircle2,
  RefreshCw,
  Sparkles,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
export type { EkycStep } from "@/constants/ekyc";

export function BankingEkycModal(props: EkycFlowOptions) {
  const { isOpen, onClose, employeeName, employeeCode } = props;
  const {
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
  } = useEkycFlow(props);
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
              {employeeName} •{" "}
              <span className="text-indigo-500">{employeeCode}</span>
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
            const isDone =
              idx < currentStepIdx || (isDoneAll && idx <= currentStepIdx);
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
                  filter:
                    isHoldingPose || isDoneAll
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
                    <NextImage
                      unoptimized
                      width={640}
                      height={480}
                      src={img}
                      alt={`Góc ${idx + 1}`}
                      className="h-full w-full object-cover transform -scale-x-100"
                    />
                  </div>
                ))}
                {Array.from({ length: 5 - capturedImages.length }).map(
                  (_, i) => (
                    <div
                      key={i}
                      className="h-10 w-10 rounded-full border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center text-[11px] font-bold text-slate-300"
                    >
                      {capturedImages.length + i + 1}
                    </div>
                  ),
                )}
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
            {isDoneAll
              ? "Đang lưu..."
              : `Hoàn tất (${capturedImages.length}/5)`}
          </Button>
        </div>
      </div>
    </div>
  );
}
