// Real-time Face, Pose, Distance, and Centering Detector for Banking eKYC

export type PoseType = "front" | "left" | "right" | "up" | "smile";

export type DetectionStatus =
  | "NO_FACE"
  | "MULTIPLE_FACES"
  | "TOO_FAR"
  | "TOO_CLOSE"
  | "NOT_CENTERED"
  | "WRONG_POSE"
  | "MATCHED";

export interface FaceDetectionResult {
  status: DetectionStatus;
  message: string;
  voiceMessage: string;
  isMatched: boolean;
  distanceRatio: number; // 0.0 to 1.0 (face width / frame width)
  yaw: number; // degrees (-60 to +60)
  pitch: number; // degrees (-45 to +45)
  roll: number; // degrees (-45 to +45)
  isCentered: boolean;
  qualityScore: number;
  box: { x: number; y: number; width: number; height: number } | null;
}

export class EkycDetector {
  private lastVoiceTime: number = 0;
  private lastVoiceKey: string = "";

  // Analyze video frame using native FaceDetector or skin/geometry optical heuristics
  public async analyzeFrame(
    video: HTMLVideoElement,
    targetPose: PoseType,
    canvas: HTMLCanvasElement
  ): Promise<FaceDetectionResult> {
    const frameW = canvas.width;
    const frameH = canvas.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    if (!ctx || video.videoWidth === 0 || video.videoHeight === 0) {
      return {
        status: "NO_FACE",
        message: "Đang mở Camera...",
        voiceMessage: "Đang mở máy ảnh",
        isMatched: false,
        distanceRatio: 0,
        yaw: 0,
        pitch: 0,
        roll: 0,
        isCentered: false,
        qualityScore: 0,
        box: null,
      };
    }

    ctx.drawImage(video, 0, 0, frameW, frameH);

    // Try Native Chromium Shape Detection FaceDetector API if available
    let detectedFaces: any[] = [];
    if (typeof window !== "undefined" && "FaceDetector" in window) {
      try {
        const nativeDetector = new (window as any).FaceDetector({ fastMode: true, maxDetectedFaces: 2 });
        detectedFaces = await nativeDetector.detect(canvas);
      } catch (e) {
        // Fallback to optical scan
      }
    }

    let faceBox: { x: number; y: number; width: number; height: number } | null = null;
    let yaw = 0;
    let pitch = 0;
    let roll = 0;

    if (detectedFaces && detectedFaces.length > 0) {
      if (detectedFaces.length > 1) {
        return {
          status: "MULTIPLE_FACES",
          message: "Phát hiện nhiều khuôn mặt trong khung hình",
          voiceMessage: "Vui lòng chỉ để một người trong khung hình",
          isMatched: false,
          distanceRatio: 0.5,
          yaw: 0,
          pitch: 0,
          roll: 0,
          isCentered: false,
          qualityScore: 0,
          box: null,
        };
      }

      const face = detectedFaces[0];
      const bb = face.boundingBox;
      faceBox = {
        x: bb.x,
        y: bb.y,
        width: bb.width,
        height: bb.height,
      };

      // Landmarks if available (eyes, nose, mouth)
      if (face.landmarks) {
        const leftEye = face.landmarks.find((l: any) => l.type === "eye" && l.location.x < bb.x + bb.width / 2);
        const rightEye = face.landmarks.find((l: any) => l.type === "eye" && l.location.x >= bb.x + bb.width / 2);
        const mouth = face.landmarks.find((l: any) => l.type === "mouth");

        if (leftEye && rightEye) {
          const eyeMidX = (leftEye.location.x + rightEye.location.x) / 2;
          const faceMidX = bb.x + bb.width / 2;
          yaw = Math.round(((eyeMidX - faceMidX) / bb.width) * 80);

          const eyeMidY = (leftEye.location.y + rightEye.location.y) / 2;
          const faceMidY = bb.y + bb.height * 0.38;
          pitch = Math.round(((eyeMidY - faceMidY) / bb.height) * 60);

          const dx = rightEye.location.x - leftEye.location.x;
          const dy = rightEye.location.y - leftEye.location.y;
          roll = Math.round((Math.atan2(dy, dx) * 180) / Math.PI);
        }
      }
    }

    // If native detector not available or no face found, use optical skin-geometry analyzer
    if (!faceBox) {
      const imgData = ctx.getImageData(0, 0, frameW, frameH);
      const data = imgData.data;

      let minX = frameW, maxX = 0, minY = frameH, maxY = 0;
      let skinPixels = 0;
      let totalLuminance = 0;
      let leftWeight = 0;
      let rightWeight = 0;
      let topWeight = 0;
      let bottomWeight = 0;

      for (let y = 0; y < frameH; y += 4) {
        for (let x = 0; x < frameW; x += 4) {
          const idx = (y * frameW + x) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];

          // YCbCr / RGB Skin tone filter
          const isSkin =
            r > 60 && g > 40 && b > 20 &&
            r > g && r > b &&
            Math.abs(r - g) > 12 &&
            r - b > 10;

          if (isSkin) {
            skinPixels++;
            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x);
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y);

            const lum = 0.299 * r + 0.587 * g + 0.114 * b;
            totalLuminance += lum;

            if (x < frameW / 2) leftWeight += lum;
            else rightWeight += lum;

            if (y < frameH / 2) topWeight += lum;
            else bottomWeight += lum;
          }
        }
      }

      const minFacePixels = (frameW * frameH) / (16 * 25); // At least 4% of frame
      if (skinPixels < minFacePixels || maxX - minX < 40 || maxY - minY < 40) {
        return {
          status: "NO_FACE",
          message: "Không tìm thấy khuôn mặt trong khung hình",
          voiceMessage: "Vui lòng đưa mặt vào giữa khung tròn",
          isMatched: false,
          distanceRatio: 0,
          yaw: 0,
          pitch: 0,
          roll: 0,
          isCentered: false,
          qualityScore: 0,
          box: null,
        };
      }

      faceBox = {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
      };

      // Estimate yaw and pitch from left-right and top-bottom luminance & geometry asymmetry
      const totalH = leftWeight + rightWeight;
      if (totalH > 0) {
        // Because camera is mirrored in UI, we calculate user's perceived turn
        const ratioH = (rightWeight - leftWeight) / totalH;
        yaw = Math.round(ratioH * 65);
      }

      const totalV = topWeight + bottomWeight;
      if (totalV > 0) {
        const ratioV = (bottomWeight - topWeight) / totalV;
        pitch = Math.round(ratioV * 50);
      }
    }

    // 1. Distance Check (Gần / Xa)
    const distanceRatio = faceBox.width / frameW;
    if (distanceRatio < 0.24) {
      return {
        status: "TOO_FAR",
        message: "Khuôn mặt quá xa. Vui lòng tiến lại gần hơn.",
        voiceMessage: "Vui lòng đưa mặt lại gần hơn",
        isMatched: false,
        distanceRatio,
        yaw,
        pitch,
        roll,
        isCentered: false,
        qualityScore: 0.4,
        box: faceBox,
      };
    }

    if (distanceRatio > 0.82) {
      return {
        status: "TOO_CLOSE",
        message: "Khuôn mặt quá gần. Vui lòng lùi ra xa một chút.",
        voiceMessage: "Vui lòng lùi mặt ra xa một chút",
        isMatched: false,
        distanceRatio,
        yaw,
        pitch,
        roll,
        isCentered: false,
        qualityScore: 0.5,
        box: faceBox,
      };
    }

    // 2. Centering Check (Vị trí trung tâm)
    const centerX = faceBox.x + faceBox.width / 2;
    const centerY = faceBox.y + faceBox.height / 2;
    const centerOffX = Math.abs(centerX - frameW / 2) / frameW;
    const centerOffY = Math.abs(centerY - frameH / 2) / frameH;
    const isCentered = centerOffX < 0.22 && centerOffY < 0.22;

    if (!isCentered && targetPose === "front") {
      return {
        status: "NOT_CENTERED",
        message: "Vui lòng căn giữa khuôn mặt trong vòng tròn.",
        voiceMessage: "Vui lòng đưa khuôn mặt vào giữa khung tròn",
        isMatched: false,
        distanceRatio,
        yaw,
        pitch,
        roll,
        isCentered: false,
        qualityScore: 0.6,
        box: faceBox,
      };
    }

    // 3. Pose Angle Verification (Khớp góc quay mặt)
    let isMatched = false;
    let poseMessage = "";
    let voicePrompt = "";

    switch (targetPose) {
      case "front":
        // Straight face: |yaw| <= 14 deg, |pitch| <= 14 deg
        if (Math.abs(yaw) <= 14 && Math.abs(pitch) <= 16) {
          isMatched = true;
          poseMessage = "✨ Góc mặt chính diện chuẩn xác!";
          voicePrompt = "Giữ yên khuôn mặt";
        } else if (yaw < -14) {
          poseMessage = "Đang quay sang trái. Vui lòng nhìn thẳng.";
          voicePrompt = "Vui lòng nhìn thẳng vào camera";
        } else if (yaw > 14) {
          poseMessage = "Đang quay sang phải. Vui lòng nhìn thẳng.";
          voicePrompt = "Vui lòng nhìn thẳng vào camera";
        } else {
          poseMessage = "Vui lòng giữ đầu thẳng và nhìn vào camera.";
          voicePrompt = "Vui lòng nhìn thẳng vào camera";
        }
        break;

      case "left":
        // Turn Left: user turns head to their left (yaw < -12)
        if (yaw < -10) {
          isMatched = true;
          poseMessage = "✨ Góc nghiêng trái chuẩn xác!";
          voicePrompt = "Giữ nguyên góc nghiêng trái";
        } else if (yaw > 10) {
          poseMessage = "Bạn đang quay sang phải. Hãy quay sang bên trái.";
          voicePrompt = "Vui lòng quay mặt sang bên trái";
        } else {
          poseMessage = "Vui lòng quay mặt sang bên trái từ từ.";
          voicePrompt = "Vui lòng quay mặt sang bên trái từ từ";
        }
        break;

      case "right":
        // Turn Right: user turns head to their right (yaw > +10)
        if (yaw > 10) {
          isMatched = true;
          poseMessage = "✨ Góc nghiêng phải chuẩn xác!";
          voicePrompt = "Giữ nguyên góc nghiêng phải";
        } else if (yaw < -10) {
          poseMessage = "Bạn đang quay sang trái. Hãy quay sang bên phải.";
          voicePrompt = "Vui lòng quay mặt sang bên phải";
        } else {
          poseMessage = "Vui lòng quay mặt sang bên phải từ từ.";
          voicePrompt = "Vui lòng quay mặt sang bên phải từ từ";
        }
        break;

      case "up":
        // Tilt Up: head tilted upward (pitch < -8)
        if (pitch < -7 || (Math.abs(yaw) <= 15 && centerY < frameH * 0.44)) {
          isMatched = true;
          poseMessage = "✨ Góc ngẩng mặt chuẩn xác!";
          voicePrompt = "Giữ nguyên góc ngẩng mặt";
        } else {
          poseMessage = "Vui lòng ngẩng cằm lên trên một chút.";
          voicePrompt = "Vui lòng ngẩng cằm lên một chút";
        }
        break;

      case "smile":
        // Smile / Confirmation step
        isMatched = true;
        poseMessage = "✨ Khuôn mặt hợp lệ!";
        voicePrompt = "Giữ yên để hoàn tất";
        break;
    }

    return {
      status: isMatched ? "MATCHED" : "WRONG_POSE",
      message: poseMessage,
      voiceMessage: voicePrompt,
      isMatched,
      distanceRatio,
      yaw,
      pitch,
      roll,
      isCentered,
      qualityScore: 0.9,
      box: faceBox,
    };
  }
}

export const ekycDetector = new EkycDetector();
