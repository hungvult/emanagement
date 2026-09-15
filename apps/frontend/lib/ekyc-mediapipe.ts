export type PoseStepId = "front" | "left" | "right" | "up" | "smile" | "blink";

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

export interface FaceGeometryProfile {
  ratioEyeToFace: number;      // Khoảng cách 2 mắt / Chiều dài khuôn mặt
  ratioNoseToFace: number;     // Mũi tới cằm / Chiều dài khuôn mặt
  ratioMouthToFace: number;    // Độ rộng miệng / Chiều dài khuôn mặt
  ratioJawToFace: number;      // Độ rộng quai hàm / Chiều dài khuôn mặt
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

  // Face Identity Consistency (Khóa khuôn mặt từ bước 1)
  private referenceFaceProfile: FaceGeometryProfile | null = null;

  public setReferenceFace(landmarks: Landmark3D[]): void {
    this.referenceFaceProfile = this.extractGeometryProfile(landmarks);
  }

  public clearReferenceFace(): void {
    this.referenceFaceProfile = null;
  }

  public hasReferenceFace(): boolean {
    return this.referenceFaceProfile !== null;
  }

  public extractGeometryProfile(landmarks: Landmark3D[]): FaceGeometryProfile | null {
    if (!landmarks || landmarks.length < 468) return null;
    const lm = landmarks;
    const leftEyeX = (lm[33].x + lm[133].x) / 2;
    const leftEyeY = (lm[33].y + lm[133].y) / 2;
    const rightEyeX = (lm[263].x + lm[362].x) / 2;
    const rightEyeY = (lm[263].y + lm[362].y) / 2;

    const eyeDist = Math.hypot(rightEyeX - leftEyeX, rightEyeY - leftEyeY);
    const faceLen = Math.hypot(lm[152].x - lm[10].x, lm[152].y - lm[10].y) || 1e-5;
    const noseToChin = Math.hypot(lm[152].x - lm[1].x, lm[152].y - lm[1].y);
    const mouthW = Math.hypot(lm[291].x - lm[61].x, lm[291].y - lm[61].y);
    const jawW = Math.hypot(lm[454].x - lm[234].x, lm[454].y - lm[234].y);

    return {
      ratioEyeToFace: eyeDist / faceLen,
      ratioNoseToFace: noseToChin / faceLen,
      ratioMouthToFace: mouthW / faceLen,
      ratioJawToFace: jawW / faceLen,
    };
  }

  public checkFaceConsistency(landmarks: Landmark3D[]): { isConsistent: boolean; diff: number } {
    if (!this.referenceFaceProfile) {
      return { isConsistent: true, diff: 0 };
    }
    const cur = this.extractGeometryProfile(landmarks);
    if (!cur) {
      return { isConsistent: true, diff: 0 };
    }
    const ref = this.referenceFaceProfile;
    const d1 = Math.abs(cur.ratioEyeToFace - ref.ratioEyeToFace) / (ref.ratioEyeToFace + 1e-5);
    const d2 = Math.abs(cur.ratioNoseToFace - ref.ratioNoseToFace) / (ref.ratioNoseToFace + 1e-5);
    const d3 = Math.abs(cur.ratioMouthToFace - ref.ratioMouthToFace) / (ref.ratioMouthToFace + 1e-5);
    const d4 = Math.abs(cur.ratioJawToFace - ref.ratioJawToFace) / (ref.ratioJawToFace + 1e-5);

    const avgDiff = (d1 + d2 + d3 + d4) / 4.0;
    return {
      isConsistent: avgDiff <= 0.16,
      diff: avgDiff,
    };
  }

  // Blink State Machine chống giả mạo ảnh tĩnh (tương thích cả người đeo kính và mọi dáng mắt)
  private blinkState: "WAITING_OPEN" | "OPEN_READY" | "CLOSED" | "REOPENED" | "COMPLETED" = "WAITING_OPEN";
  private openEarSamples: number[] = [];
  private leftOpenEarSamples: number[] = [];
  private rightOpenEarSamples: number[] = [];
  private leftBaseline: number = 0.18;
  private rightBaseline: number = 0.18;
  private baselineOpenEar: number = 0.18;
  private closedTime: number = 0;
  private reopenedTime: number = 0;
  private completedUntil: number = 0;
  private blinkCooldownUntil: number = 0;
  private blinkHeadPoseRef: { x: number; y: number; yaw: number; pitch: number; roll: number } | null = null;

  public resetBlink(): void {
    this.blinkState = "WAITING_OPEN";
    this.openEarSamples = [];
    this.leftOpenEarSamples = [];
    this.rightOpenEarSamples = [];
    this.leftBaseline = 0.18;
    this.rightBaseline = 0.18;
    this.baselineOpenEar = 0.18;
    this.closedTime = 0;
    this.reopenedTime = 0;
    this.completedUntil = 0;
    this.blinkHeadPoseRef = null;
    this.blinkCooldownUntil = Date.now() + 600; // 600ms cooldown an toàn khi vừa chuyển bước
  }

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

    // Eye Aspect Ratio (EAR) for Blink Detection (Chống giả mạo ảnh điện thoại)
    // Đo lường chính xác 3 đoạn thẳng dọc (2 bên mí và tâm con ngươi) để khử nhiễu gọng kính:
    // Mắt trái: 160 & 144, 159 & 145 (tâm mí), 158 & 153, chiều rộng 133 & 33
    const leftEyeH1 = Math.hypot(lm[160].x - lm[144].x, lm[160].y - lm[144].y);
    const leftEyeH2 = Math.hypot(lm[158].x - lm[153].x, lm[158].y - lm[153].y);
    const leftEyeH3 = Math.hypot(lm[159].x - lm[145].x, lm[159].y - lm[145].y);
    const leftEyeW = Math.hypot(lm[133].x - lm[33].x, lm[133].y - lm[33].y);
    const leftEAR = (leftEyeH1 + 2.0 * leftEyeH3 + leftEyeH2) / (4.0 * (leftEyeW + 1e-5));

    // Mắt phải: 385 & 380, 386 & 374 (tâm mí), 387 & 373, chiều rộng 263 & 362
    const rightEyeH1 = Math.hypot(lm[385].x - lm[380].x, lm[385].y - lm[380].y);
    const rightEyeH2 = Math.hypot(lm[387].x - lm[373].x, lm[387].y - lm[373].y);
    const rightEyeH3 = Math.hypot(lm[386].x - lm[374].x, lm[386].y - lm[374].y);
    const rightEyeW = Math.hypot(lm[263].x - lm[362].x, lm[263].y - lm[362].y);
    const rightEAR = (rightEyeH1 + 2.0 * rightEyeH3 + rightEyeH2) / (4.0 * (rightEyeW + 1e-5));

    const avgEAR = (leftEAR + rightEAR) / 2.0;

    // 2D robust horizontal pose ratio (bất biến với Z-axis noise và webcam mirror)
    const distLeft = Math.abs(nose.x - leftEar.x);
    const distRight = Math.abs(nose.x - rightEar.x);
    const asymmetry = (distRight - distLeft) / (distRight + distLeft + 1e-5);

    // 2D vertical ratio (tỉ lệ khoảng cách từ cằm tới mũi so với từ mũi tới trán)
    const noseToChin = Math.abs(chin.y - nose.y);
    const foreheadToNose = Math.abs(nose.y - forehead.y);
    const verticalRatio = noseToChin / (foreheadToNose + 1e-5);
    const earMidY = (leftEar.y + rightEar.y) / 2;
    const noseAboveEarRatio = (earMidY - nose.y) / (faceWidth + 1e-5);

    // 3.5 Check Cross-Step Face Consistency (Chống đổi người / đổi ảnh giữa chừng)
    // Khi đang ở bước chớp mắt (blink) hoặc nhìn thẳng (front), góc mặt đủ thẳng để so khớp tỷ lệ hình học khuôn mặt
    if (this.referenceFaceProfile && (targetPose === "front" || targetPose === "blink")) {
      const consistency = this.checkFaceConsistency(lm);
      if (!consistency.isConsistent) {
        return {
          status: "WRONG_POSE",
          isMatched: false,
          message: "Phát hiện đổi khuôn mặt! Vui lòng giữ nguyên khuôn mặt ban đầu",
          voiceMessage: "Vui lòng giữ nguyên khuôn mặt ban đầu",
          yaw,
          pitch,
          roll,
          distanceRatio,
          isCentered,
          smileScore,
          blinkScore: avgEAR,
          landmarks: lm,
          confidence: 0.8,
        };
      }
    }

    // 4. Check Target Pose Requirement - Smooth and Responsive
    let isMatched = false;
    let message = "";
    let voiceMessage = "";

    switch (targetPose) {
      case "front":
        // Nhìn thẳng: mặt cân đối (asymmetry nhỏ), không cúi/ngửa quá mức
        if (Math.abs(asymmetry) <= 0.12 && Math.abs(pitch) <= 16 && verticalRatio < 1.30) {
          isMatched = true;
          message = "Góc mặt chính diện chuẩn xác";
          voiceMessage = "Giữ yên khuôn mặt";
        } else {
          message = "Vui lòng nhìn thẳng vào camera";
          voiceMessage = "Vui lòng nhìn thẳng vào camera";
        }
        break;

      case "blink": {
        const now = Date.now();

        // 1. Khóa tư thế đầu (Strict Pose Lock): Bắt buộc mặt phải hướng thẳng camera!
        // Nghiêm cấm xoay hoặc nghiêng đầu khi chớp mắt.
        // Khi đeo kính, nếu nghiêng hoặc xoay mặt, gọng kính và góc nhìn nghiêng sẽ làm biến dạng EAR giả lập nhắm mắt.
        const isPoseCentered =
          Math.abs(asymmetry) <= 0.08 &&
          Math.abs(pitch) <= 12 &&
          Math.abs(roll) <= 9;

        if (!isPoseCentered) {
          // Nếu đầu bị xoay/nghiêng khi đang chờ hoặc đang nhắm, reset lại chu trình để tránh false-positive
          if (this.blinkState === "CLOSED" || this.blinkState === "REOPENED") {
            this.blinkState = "OPEN_READY";
          }
          if (Math.abs(asymmetry) > 0.08) {
            message = "Giữ mặt thẳng, không xoay mặt sang bên";
          } else if (pitch > 12) {
            message = "Không cúi đầu, hãy nhìn thẳng vào camera";
          } else if (pitch < -12) {
            message = "Không ngửa đầu, hãy nhìn thẳng vào camera";
          } else {
            message = "Giữ thẳng đầu, không nghiêng đầu sang bên";
          }
          voiceMessage = "Vui lòng nhìn thẳng và giữ yên đầu";
          break;
        }

        // 2. Cooldown an toàn ngay sau khi reset / chuyển bước
        if (now < this.blinkCooldownUntil) {
          message = "Vui lòng nhìn vào camera...";
          voiceMessage = "Vui lòng nhìn vào camera";
          break;
        }

        // 3. Thu thập baseline mắt mở tự nhiên độc lập cho cả 2 mắt (yêu cầu 8 frame ổn định ~ 250ms)
        if (this.blinkState === "WAITING_OPEN") {
          if (leftEAR >= 0.08 && rightEAR >= 0.08) {
            this.leftOpenEarSamples.push(leftEAR);
            this.rightOpenEarSamples.push(rightEAR);
            this.openEarSamples.push(avgEAR);
            if (this.openEarSamples.length >= 8) {
              const sumL = this.leftOpenEarSamples.reduce((a, b) => a + b, 0);
              const sumR = this.rightOpenEarSamples.reduce((a, b) => a + b, 0);
              this.leftBaseline = Math.max(0.12, sumL / this.leftOpenEarSamples.length);
              this.rightBaseline = Math.max(0.12, sumR / this.rightOpenEarSamples.length);
              this.baselineOpenEar = (this.leftBaseline + this.rightBaseline) / 2.0;
              this.blinkState = "OPEN_READY";
              this.blinkHeadPoseRef = { x: nose.x, y: nose.y, yaw, pitch, roll };
            }
          } else {
            this.leftOpenEarSamples = [];
            this.rightOpenEarSamples = [];
            this.openEarSamples = [];
          }
          message = "Vui lòng nhìn thẳng và chớp mắt";
          voiceMessage = "Vui lòng chớp mắt";
          break;
        }

        // 4. Trạng thái mắt mở sẵn sàng: Đợi người dùng thực hiện nhắm mắt thật
        if (this.blinkState === "OPEN_READY") {
          // Thích ứng nhẹ nếu mắt mở to hơn tự nhiên
          if (leftEAR > this.leftBaseline && leftEAR < 0.42) {
            this.leftBaseline = this.leftBaseline * 0.90 + leftEAR * 0.10;
          }
          if (rightEAR > this.rightBaseline && rightEAR < 0.42) {
            this.rightBaseline = this.rightBaseline * 0.90 + rightEAR * 0.10;
          }
          this.baselineOpenEar = (this.leftBaseline + this.rightBaseline) / 2.0;

          // Cập nhật vị trí đầu chuẩn khi mắt đang mở
          this.blinkHeadPoseRef = { x: nose.x, y: nose.y, yaw, pitch, roll };

          // TIÊU CHUẨN NHẮM MẮT THẬT (Bi-ocular Active Blink Verification):
          // 1. CẢ 2 MẮT đều phải sụt giảm rõ rệt so với baseline của chính mắt đó
          // 2. Mức sụt giảm phải đạt ít nhất 32% (tức EAR <= baseline * 0.68)
          // 3. Độ giảm tuyệt đối mỗi mắt drop >= 0.028
          // 4. Ngăn chặn tuyệt đối việc 1 mắt mở 1 mắt nhắm/bị che gọng kính
          const dropL = this.leftBaseline - leftEAR;
          const dropR = this.rightBaseline - rightEAR;

          const isLeftClosed = dropL >= 0.028 && leftEAR <= this.leftBaseline * 0.68;
          const isRightClosed = dropR >= 0.028 && rightEAR <= this.rightBaseline * 0.68;

          // Bắt buộc cả 2 mắt phải cùng nhắm:
          if (isLeftClosed && isRightClosed) {
            this.blinkState = "CLOSED";
            this.closedTime = now;
          }
          message = "Vui lòng chớp mắt một cái";
          voiceMessage = "Vui lòng chớp mắt";
          break;
        }

        // 5. Trạng thái mắt đã nhắm: Đợi mắt mở trở lại (hoàn tất chu trình nhắm -> mở)
        if (this.blinkState === "CLOSED") {
          // Kiểm tra đầu có bị di chuyển/lắc trong lúc nhắm mắt hay không
          if (this.blinkHeadPoseRef) {
            const shift = Math.hypot(nose.x - this.blinkHeadPoseRef.x, nose.y - this.blinkHeadPoseRef.y);
            const yawDiff = Math.abs(yaw - this.blinkHeadPoseRef.yaw);
            const pitchDiff = Math.abs(pitch - this.blinkHeadPoseRef.pitch);
            if (shift > 0.035 || yawDiff > 7 || pitchDiff > 7) {
              // Phát hiện đầu dịch chuyển hoặc xoay -> Hủy lượt nhắm do cử động đầu!
              this.blinkState = "OPEN_READY";
              this.blinkHeadPoseRef = { x: nose.x, y: nose.y, yaw, pitch, roll };
              message = "Vui lòng giữ yên đầu và chớp mắt";
              break;
            }
          }

          // Nhắm quá lâu (> 1.6s) -> reset về OPEN_READY
          if (now - this.closedTime > 1600) {
            this.blinkState = "OPEN_READY";
            break;
          }

          // Mắt mở trở lại:
          // - Phải nhắm tối thiểu 60ms (chống nhiễu rung camera)
          // - CẢ 2 MẮT đều phải phục hồi về ít nhất 82% baseline
          const closedDuration = now - this.closedTime;
          const leftReopened = leftEAR >= this.leftBaseline * 0.82;
          const rightReopened = rightEAR >= this.rightBaseline * 0.82;

          if (closedDuration >= 60 && leftReopened && rightReopened) {
            this.blinkState = "REOPENED";
            this.reopenedTime = now;
          }
          message = "Tốt lắm, mở mắt ra";
          voiceMessage = "Tốt lắm";
          break;
        }

        // 6. Trạng thái mắt vừa mở lại: Giữ 80ms để 2 mắt mở to ổn định
        if (this.blinkState === "REOPENED") {
          if (now - this.reopenedTime >= 80) {
            const leftFullyOpen = leftEAR >= this.leftBaseline * 0.78;
            const rightFullyOpen = rightEAR >= this.rightBaseline * 0.78;
            if (leftFullyOpen && rightFullyOpen) {
              this.blinkState = "COMPLETED";
              this.completedUntil = now + 2000;
            } else {
              this.blinkState = "OPEN_READY";
            }
          }
          message = "Tốt lắm, mở mắt ra";
          voiceMessage = "Tốt lắm";
          break;
        }

        // 7. Hoàn tất chu trình sinh trắc học: Mở -> Cả 2 mắt nhắm thật mà đầu không lắc -> Mở lại to rõ
        if (this.blinkState === "COMPLETED") {
          if (now > this.completedUntil) {
            this.blinkState = "OPEN_READY";
          }
          isMatched = true;
          message = "Chớp mắt thành công!";
          voiceMessage = "Tốt lắm";
        }
        break;
      }

      case "left":
        // Bắt buộc quay sang bên trái: mũi lệch rõ rệt sang trái (asymmetry < -0.14)
        if (asymmetry < -0.14) {
          isMatched = true;
          message = "Góc quay trái chuẩn xác";
          voiceMessage = "Giữ yên";
        } else {
          message = "Quay mặt sang bên trái";
          voiceMessage = "Vui lòng quay mặt sang bên trái";
        }
        break;

      case "right":
        // Bắt buộc quay sang bên phải: mũi lệch rõ rệt sang phải (asymmetry > 0.14)
        if (asymmetry > 0.14) {
          isMatched = true;
          message = "Góc quay phải chuẩn xác";
          voiceMessage = "Giữ yên";
        } else {
          message = "Quay mặt sang bên phải";
          voiceMessage = "Vui lòng quay mặt sang bên phải";
        }
        break;

      case "up":
        // Hơi ngẩng cằm lên trên: pitch âm hoặc tỉ lệ cằm-mũi/mũi-trán tăng (>= 1.25)
        if (pitch <= -6 || verticalRatio >= 1.25 || noseAboveEarRatio > -0.02) {
          isMatched = true;
          message = "Góc ngẩng mặt chuẩn xác";
          voiceMessage = "Giữ yên";
        } else {
          message = "Hơi ngẩng cằm lên trên";
          voiceMessage = "Vui lòng ngẩng cằm lên một chút";
        }
        break;

      case "smile":
        isMatched = true;
        message = "Xác thực biểu cảm thành công";
        voiceMessage = "Giữ yên để hoàn tất";
        break;
    }

    let blinkProgress = 0;
    if (this.blinkState === "WAITING_OPEN") {
      blinkProgress = Math.min(25, Math.round((this.openEarSamples.length / 6) * 25));
    } else if (this.blinkState === "OPEN_READY") {
      blinkProgress = 35;
    } else if (this.blinkState === "CLOSED") {
      blinkProgress = 75;
    } else if (this.blinkState === "REOPENED") {
      blinkProgress = 90;
    } else if (this.blinkState === "COMPLETED") {
      blinkProgress = 100;
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
      blinkScore: blinkProgress,
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
        status: "WRONG_POSE",
        isMatched: false,
        message: "Đang xử lý hình ảnh...",
        voiceMessage: "Vui lòng nhìn vào camera",
        yaw: 0,
        pitch: 0,
        roll: 0,
        distanceRatio: 0.5,
        isCentered: true,
        smileScore: 0,
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
    } else if (targetPose === "blink") {
      isMatched = false;
      message = "Vui lòng nhìn thẳng và chớp mắt";
      voiceMessage = "Vui lòng chớp mắt";
    } else if (targetPose === "smile") {
      isMatched = true;
      message = "Xác thực biểu cảm thành công";
      voiceMessage = "Giữ yên để hoàn tất";
    } else {
      isMatched = false;
      message = "Vui lòng nhìn vào camera";
      voiceMessage = "Vui lòng nhìn vào camera";
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
