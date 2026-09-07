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
