// Docker truyền cùng BRIGHTNESS_MIN cho cv-service và frontend lúc build.
// Khi chạy frontend riêng, dùng NEXT_PUBLIC_ATTENDANCE_BRIGHTNESS_MIN (thang 0–255).
const configuredBrightnessMin = Number(process.env.NEXT_PUBLIC_ATTENDANCE_BRIGHTNESS_MIN ?? 130);
export const ATTENDANCE_BRIGHTNESS_MIN =
  Number.isFinite(configuredBrightnessMin) && configuredBrightnessMin > 0 && configuredBrightnessMin <= 255
    ? configuredBrightnessMin
    : 130;
export const INSUFFICIENT_LIGHT_MESSAGE =
  "Chưa đủ ánh sáng để chấm công. Vui lòng bật thêm đèn hoặc di chuyển đến nơi sáng hơn để khuôn mặt được chiếu sáng rõ.";

/** Đo vùng mặt trên ảnh camera gốc; dùng toàn khung khi chưa tìm thấy mặt. */
export function measureFrameBrightness(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  landmarks?: readonly { x: number; y: number }[] | null
): number | null {
  if (!video.videoWidth || !video.videoHeight || video.readyState < 2) return null;

  let x = 0;
  let y = 0;
  let width = video.videoWidth;
  let height = video.videoHeight;
  if (landmarks?.length) {
    const minX = Math.max(0, Math.min(...landmarks.map((point) => point.x)));
    const minY = Math.max(0, Math.min(...landmarks.map((point) => point.y)));
    const maxX = Math.min(1, Math.max(...landmarks.map((point) => point.x)));
    const maxY = Math.min(1, Math.max(...landmarks.map((point) => point.y)));
    x = minX * video.videoWidth;
    y = minY * video.videoHeight;
    width = (maxX - minX) * video.videoWidth;
    height = (maxY - minY) * video.videoHeight;
    if (width <= 0 || height <= 0) return null;
  }

  // Tái sử dụng canvas nhỏ để không đọc hàng triệu pixel mỗi frame.
  if (canvas.width !== 64 || canvas.height !== 64) {
    canvas.width = 64;
    canvas.height = 64;
  }
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  context.drawImage(video, x, y, width, height, 0, 0, 64, 64);
  const pixels = context.getImageData(0, 0, 64, 64).data;
  let total = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    total += 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2];
  }
  return total / (pixels.length / 4);
}

/**
 * Chụp và chuẩn hóa frame ảnh từ camera:
 * - Thu phóng (Downscale) tự động theo cạnh lớn nhất (mặc định maxDimension = 640px)
 * - Bảo toàn 100% tỷ lệ khung hình (Aspect Ratio) của mọi loại camera (ngang/dọc/vuông)
 * - Nén ảnh sang JPEG với chất lượng 0.8 (80%) để giảm ~95% dung lượng Base64
 */
export function captureOptimizedFrame(
  video: HTMLVideoElement | null,
  maxDimension = 640,
  quality = 0.8
): string | null {
  if (!video || !video.videoWidth || !video.videoHeight) return null;

  const w = video.videoWidth;
  const h = video.videoHeight;

  let targetW = w;
  let targetH = h;

  if (w > maxDimension || h > maxDimension) {
    if (w >= h) {
      targetW = maxDimension;
      targetH = Math.round((h / w) * maxDimension);
    } else {
      targetH = maxDimension;
      targetW = Math.round((w / h) * maxDimension);
    }
  }

  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.drawImage(video, 0, 0, targetW, targetH);
  return canvas.toDataURL("image/jpeg", quality);
}
