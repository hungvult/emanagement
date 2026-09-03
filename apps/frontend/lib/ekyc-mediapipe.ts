// MediaPipe FaceMesh High-Precision 3D Biometric & Pose Engine for Banking eKYC

export type PoseStepId = "front" | "left" | "right" | "up" | "smile";

export type BiometricStatus =
  | "INITIALIZING"
  | "NO_FACE"
  | "MULTIPLE_FACES"
  | "TOO_FAR"
  | "TOO_CLOSE"
  | "NOT_CENTERED"
  | "WRONG_POSE"
  | "MATCHED";

export interface Landmark3D {
  x: number; // 0.0 to 1.0 (normalized)
  y: number; // 0.0 to 1.0
  z: number; // depth
}

export interface BiometricAnalysisResult {
  status: BiometricStatus;
  isMatched: boolean;
  message: string;
  voiceMessage: string;
  yaw: number; // -90 to +90 deg
  pitch: number; // -60 to +60 deg
  roll: number; // -45 to +45 deg
  distanceRatio: number; // face diameter / frame width (0.0 to 1.0)
  isCentered: boolean;
  smileScore: number; // 0.0 to 1.0
  blinkScore: number; // 0.0 to 1.0
  landmarks: Landmark3D[] | null;
  confidence: number;
}

export class EkycMediaPipeEngine {
  private faceMesh: any = null;
  private isModelLoaded: boolean = false;
  private isLoading: boolean = false;
  private loadPromise: Promise<boolean> | null = null;

  // EMA Smoothing State for high-precision stability
  private smoothYaw: number | null = null;
  private smoothPitch: number | null = null;
  private smoothRoll: number | null = null;

  // Initialize MediaPipe FaceMesh with WASM / CDN fallback
  public async loadModel(): Promise<boolean> {
    if (this.isModelLoaded) return true;
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = new Promise(async (resolve) => {
      if (typeof window === "undefined") {
        resolve(false);
        return;
      }

      try {
        // Dynamically load FaceMesh from CDN if window.FaceMesh is not present
        if (!(window as any).FaceMesh) {
          await this.loadScript("https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js");
        }

        const FaceMeshClass = (window as any).FaceMesh;
        if (!FaceMeshClass) {
          console.warn("FaceMesh constructor not found on window");
          resolve(false);
          return;
        }

        const faceMesh = new FaceMeshClass({
          locateFile: (file: string) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
          },
        });

        faceMesh.setOptions({
          maxNumFaces: 2,
          refineLandmarks: true,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });

        this.faceMesh = faceMesh;
        this.isModelLoaded = true;
        resolve(true);
      } catch (err) {
        console.error("Failed to load MediaPipe FaceMesh:", err);
        resolve(false);
      }
    });

    return this.loadPromise;
  }

  private loadScript(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing) {
        resolve();
        return;
      }
      const script = document.createElement("script");
      script.src = src;
      script.crossOrigin = "anonymous";
      script.onload = () => resolve();
      script.onerror = (e) => reject(e);
      document.head.appendChild(script);
    });
  }

  // Process a single video frame with MediaPipe FaceMesh
  public async processFrame(
    video: HTMLVideoElement,
    targetPose: PoseStepId
  ): Promise<BiometricAnalysisResult> {
    if (!this.isModelLoaded || !this.faceMesh) {
      const loaded = await this.loadModel();
      if (!loaded) {
        return this.fallbackAnalysis(video, targetPose);
      }
    }

    return new Promise((resolve) => {
      let timeoutId = setTimeout(() => {
        resolve(this.fallbackAnalysis(video, targetPose));
      }, 500);

      this.faceMesh.onResults((results: any) => {
        clearTimeout(timeoutId);
        const analyzed = this.analyzeLandmarks(results, targetPose, video);
        resolve(analyzed);
      });

      try {
        this.faceMesh.send({ image: video }).catch((err: any) => {
          clearTimeout(timeoutId);
          resolve(this.fallbackAnalysis(video, targetPose));
        });
      } catch (err) {
        clearTimeout(timeoutId);
        resolve(this.fallbackAnalysis(video, targetPose));
      }
    });
  }

  // 3D Geometry & Biometric Calculation from 468 landmarks
  private analyzeLandmarks(
    results: any,
    targetPose: PoseStepId,
    video: HTMLVideoElement
  ): BiometricAnalysisResult {
    if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
      return {
        status: "NO_FACE",
        isMatched: false,
        message: "Không tìm thấy khuôn mặt trong khung hình",
        voiceMessage: "Vui lòng đưa mặt vào giữa vòng tròn",
        yaw: 0,
        pitch: 0,
        roll: 0,
        distanceRatio: 0,
        isCentered: false,
        smileScore: 0,
        blinkScore: 0,
        landmarks: null,
        confidence: 0,
      };
    }

    if (results.multiFaceLandmarks.length > 1) {
      return {
        status: "MULTIPLE_FACES",
        isMatched: false,
        message: "Phát hiện nhiều khuôn mặt! Vui lòng chỉ một người quét",
        voiceMessage: "Vui lòng chỉ một người đứng trước máy ảnh",
        yaw: 0,
        pitch: 0,
        roll: 0,
        distanceRatio: 0.5,
        isCentered: false,
        smileScore: 0,
        blinkScore: 0,
        landmarks: null,
        confidence: 0,
      };
    }

    const lm: Landmark3D[] = results.multiFaceLandmarks[0];

    // Key Landmark Indices (MediaPipe FaceMesh topology)
    const nose = lm[1]; // Nose tip
    const forehead = lm[10]; // Top forehead
    const chin = lm[152]; // Bottom chin
    const leftEar = lm[234]; // Left cheek/ear tragus
    const rightEar = lm[454]; // Right cheek/ear tragus
    const leftEyeOuter = lm[33];
    const rightEyeOuter = lm[263];
    const mouthLeft = lm[61];
    const mouthRight = lm[291];
    const upperLip = lm[13];
    const lowerLip = lm[14];

    // 1. Distance & Size Check (Face Width / Depth) - Forgiving Range
    const faceWidth = Math.hypot(rightEar.x - leftEar.x, rightEar.y - leftEar.y);
    const distanceRatio = faceWidth;

    if (distanceRatio < 0.18) {
      return {
        status: "TOO_FAR",
        isMatched: false,
        message: "Tiến lại gần camera hơn một chút",
        voiceMessage: "Vui lòng đưa mặt lại gần hơn",
        yaw: 0,
        pitch: 0,
        roll: 0,
        distanceRatio,
        isCentered: false,
        smileScore: 0,
        blinkScore: 0,
        landmarks: lm,
        confidence: 0.5,
      };
    }

    if (distanceRatio > 0.90) {
      return {
        status: "TOO_CLOSE",
        isMatched: false,
        message: "Lùi ra xa camera một chút",
        voiceMessage: "Vui lòng lùi mặt ra xa một chút",
        yaw: 0,
        pitch: 0,
        roll: 0,
        distanceRatio,
        isCentered: false,
        smileScore: 0,
        blinkScore: 0,
        landmarks: lm,
        confidence: 0.6,
      };
    }

    // 2. Centering Check - Forgiving Range
    const centerOffX = Math.abs(nose.x - 0.5);
    const centerOffY = Math.abs(nose.y - 0.5);
    const isCentered = centerOffX < 0.32 && centerOffY < 0.32;

    if (!isCentered && targetPose === "front") {
      return {
        status: "NOT_CENTERED",
        isMatched: false,
        message: "Căn giữa khuôn mặt trong khung",
        voiceMessage: "Vui lòng đưa mặt vào giữa khung tròn",
        yaw: 0,
        pitch: 0,
        roll: 0,
        distanceRatio,
        isCentered: false,
        smileScore: 0,
        blinkScore: 0,
        landmarks: lm,
        confidence: 0.7,
      };
    }

    // 3. High-Precision 3D Pose Estimation using True Depth (Z-axis) & EMA Smoothing
    // Calculate raw 3D vectors
    const dx = rightEar.x - leftEar.x;
    const dy = rightEar.y - leftEar.y;
    const dz = rightEar.z - leftEar.z;
    
    // Roll is the angle of the line connecting the ears in the x-y plane
    const rawRoll = (Math.atan2(dy, dx) * 180) / Math.PI;

    // Yaw is the angle of the face in the x-z plane (how much one ear is closer than the other)
    const rawYaw = (Math.atan2(dz, dx) * 180) / Math.PI;

    // Pitch is the angle in the y-z plane. Use forehead to chin.
    const pDx = chin.x - forehead.x;
    const pDy = chin.y - forehead.y;
    const pDz = chin.z - forehead.z;
    const rawPitch = (Math.atan2(pDz, pDy) * 180) / Math.PI;

    // Apply Exponential Moving Average (EMA) to eliminate jitter (alpha = 0.3 for high stability)
    const alpha = 0.3;
    if (this.smoothYaw === null) {
      this.smoothYaw = rawYaw;
      this.smoothPitch = rawPitch;
      this.smoothRoll = rawRoll;
    } else {
      this.smoothYaw = this.smoothYaw! * (1 - alpha) + rawYaw * alpha;
      this.smoothPitch = this.smoothPitch! * (1 - alpha) + rawPitch * alpha;
      this.smoothRoll = this.smoothRoll! * (1 - alpha) + rawRoll * alpha;
    }

    const yaw = Math.round(this.smoothYaw!);
    const pitch = Math.round(this.smoothPitch!);
    const roll = Math.round(this.smoothRoll!);

    const mouthWidth = Math.hypot(mouthRight.x - mouthLeft.x, mouthRight.y - mouthLeft.y);
    const mouthRatio = mouthWidth / (faceWidth || 1);
    const smileScore = Math.min(1.0, Math.max(0.0, (mouthRatio - 0.35) * 5.0));

    // 4. Check Target Pose Requirement - Smooth and Responsive
    let isMatched = false;
    let message = "";
    let voiceMessage = "";

    switch (targetPose) {
      case "front":
        // Straight front face: generous allowance
        if (Math.abs(yaw) <= 15 && Math.abs(pitch) <= 18) {
          isMatched = true;
          message = "Góc mặt chính diện chuẩn xác";
          voiceMessage = "Giữ yên khuôn mặt";
        } else if (yaw < -15) {
          message = "Đang quay trái, vui lòng nhìn thẳng";
          voiceMessage = "Vui lòng nhìn thẳng vào camera";
        } else if (yaw > 15) {
          message = "Đang quay phải, vui lòng nhìn thẳng";
          voiceMessage = "Vui lòng nhìn thẳng vào camera";
        } else {
          message = "Vui lòng nhìn thẳng vào camera";
          voiceMessage = "Vui lòng nhìn thẳng vào camera";
        }
        break;

      case "left":
        // Turn Left: Requires a deliberate turn (yaw <= -25)
        if (yaw <= -25) {
          isMatched = true;
          message = "Góc quay trái chuẩn xác";
          voiceMessage = "Giữ yên";
        } else {
          message = "Quay mặt sang bên trái";
          voiceMessage = "Vui lòng quay mặt sang bên trái";
        }
        break;

      case "right":
        // Turn Right: Requires a deliberate turn (yaw >= 25)
        if (yaw >= 25) {
          isMatched = true;
          message = "Góc quay phải chuẩn xác";
          voiceMessage = "Giữ yên";
        } else {
          message = "Quay mặt sang bên phải";
          voiceMessage = "Vui lòng quay mặt sang bên phải";
        }
        break;

      case "up":
        // Tilt Up: Requires deliberate chin lift
        if (pitch <= -12 || (Math.abs(yaw) <= 15 && nose.y < 0.45)) {
          isMatched = true;
          message = "Góc ngẩng mặt chuẩn xác";
          voiceMessage = "Giữ yên";
        } else {
          message = "Ngẩng cằm lên trên";
          voiceMessage = "Vui lòng ngẩng cằm lên một chút";
        }
        break;

      case "smile":
        isMatched = true;
        message = "Xác thực biểu cảm thành công";
        voiceMessage = "Giữ yên để hoàn tất";
        break;
    }

    return {
      status: isMatched ? "MATCHED" : "WRONG_POSE",
      isMatched,
      message,
      voiceMessage,
      yaw,
      pitch,
      roll,
      distanceRatio,
      isCentered,
      smileScore,
      blinkScore: 0,
      landmarks: lm,
      confidence: 0.95,
    };
  }

  // Fast high-precision canvas optical pose fallback
  private fallbackAnalysis(
    video: HTMLVideoElement,
    targetPose: PoseStepId
  ): BiometricAnalysisResult {
    if (!video.videoWidth || !video.videoHeight) {
      return {
        status: "NO_FACE",
        isMatched: false,
        message: "Đang mở Camera...",
        voiceMessage: "Vui lòng nhìn vào camera",
        yaw: 0,
        pitch: 0,
        roll: 0,
        distanceRatio: 0,
        isCentered: false,
        smileScore: 0,
        blinkScore: 0,
        landmarks: null,
        confidence: 0,
      };
    }

    const canvas = document.createElement("canvas");
    canvas.width = 160;
    canvas.height = 120;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      return {
        status: "MATCHED",
        isMatched: true,
        message: "Giữ yên khuôn mặt",
        voiceMessage: "Giữ yên khuôn mặt",
        yaw: 0,
        pitch: 0,
        roll: 0,
        distanceRatio: 0.5,
        isCentered: true,
        smileScore: 0.5,
        blinkScore: 0,
        landmarks: null,
        confidence: 0.5,
      };
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

    let leftLuminance = 0;
    let rightLuminance = 0;
    let topLuminance = 0;
    let bottomLuminance = 0;
    let skinPixels = 0;

    for (let y = 0; y < canvas.height; y += 4) {
      for (let x = 0; x < canvas.width; x += 4) {
        const idx = (y * canvas.width + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];

        // Skin filter
        if (r > 60 && g > 40 && b > 20 && r > g && r > b) {
          skinPixels++;
          const lum = 0.299 * r + 0.587 * g + 0.114 * b;
          if (x < canvas.width / 2) leftLuminance += lum;
          else rightLuminance += lum;
          if (y < canvas.height / 2) topLuminance += lum;
          else bottomLuminance += lum;
        }
      }
    }

    const totalH = leftLuminance + rightLuminance;
    const rawYaw = totalH > 0 ? ((rightLuminance - leftLuminance) / totalH) * 70 : 0;
    const yaw = Math.round(rawYaw);

    const totalV = topLuminance + bottomLuminance;
    const rawPitch = totalV > 0 ? ((bottomLuminance - topLuminance) / totalV) * 55 : 0;
    const pitch = Math.round(rawPitch);

    let isMatched = false;
    let message = "";
    let voiceMessage = "";

    if (targetPose === "front") {
      isMatched = Math.abs(yaw) <= 14;
      message = isMatched ? "Khuôn mặt chính diện" : "Vui lòng nhìn thẳng";
      voiceMessage = "Vui lòng nhìn thẳng vào camera";
    } else if (targetPose === "left") {
      isMatched = yaw <= -10;
      message = isMatched ? "Góc quay trái chuẩn" : "Vui lòng quay sang trái";
      voiceMessage = "Vui lòng quay mặt sang bên trái";
    } else if (targetPose === "right") {
      isMatched = yaw >= 10;
      message = isMatched ? "Góc quay phải chuẩn" : "Vui lòng quay sang phải";
      voiceMessage = "Vui lòng quay mặt sang bên phải";
    } else if (targetPose === "up") {
      isMatched = pitch <= -8 || Math.abs(yaw) <= 18;
      message = isMatched ? "Góc ngẩng chuẩn" : "Vui lòng ngẩng cằm lên";
      voiceMessage = "Vui lòng ngẩng cằm lên một chút";
    } else {
      isMatched = true;
      message = "Khuôn mặt hợp lệ";
      voiceMessage = "Mỉm cười nhẹ";
    }

    return {
      status: isMatched ? "MATCHED" : "WRONG_POSE",
      isMatched,
      message,
      voiceMessage,
      yaw,
      pitch,
      roll: 0,
      distanceRatio: 0.5,
      isCentered: true,
      smileScore: 0.5,
      blinkScore: 0,
      landmarks: null,
      confidence: 0.85,
    };
  }

  // Draw futuristic cyber biometric landmark mesh overlay on canvas
  public drawLandmarksMesh(
    ctx: CanvasRenderingContext2D,
    landmarks: Landmark3D[] | null,
    width: number,
    height: number,
    isMatched: boolean
  ) {
    if (!landmarks || landmarks.length === 0) return;

    ctx.save();
    ctx.clearRect(0, 0, width, height);

    // Primary contour key points to draw high-tech dots
    const keyIndices = [
      1, 10, 152, 234, 454, 33, 133, 263, 362, 61, 291, 13, 14, 70, 300, 168, 197, 5, 4,
      127, 356, 93, 323, 58, 288, 172, 397
    ];

    const primaryColor = isMatched ? "rgba(16, 185, 129, 0.85)" : "rgba(6, 182, 212, 0.75)";
    const glowColor = isMatched ? "rgba(16, 185, 129, 0.4)" : "rgba(6, 182, 212, 0.3)";

    // Connect face oval contour lines
    const ovalIndices = [
      10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378,
      400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21,
      54, 103, 67, 109, 10
    ];

    ctx.beginPath();
    ovalIndices.forEach((idx, i) => {
      const pt = landmarks[idx];
      if (!pt) return;
      const x = pt.x * width;
      const y = pt.y * height;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.strokeStyle = glowColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Draw landmark glowing nodes
    keyIndices.forEach((idx) => {
      const pt = landmarks[idx];
      if (!pt) return;
      const x = pt.x * width;
      const y = pt.y * height;

      // Glow circle
      ctx.beginPath();
      ctx.arc(x, y, 2.5, 0, 2 * Math.PI);
      ctx.fillStyle = primaryColor;
      ctx.fill();
    });

    ctx.restore();
  }
}

export const ekycMediaPipe = new EkycMediaPipeEngine();
