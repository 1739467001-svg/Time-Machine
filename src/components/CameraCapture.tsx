"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useFaceDetector } from "@/lib/face/use-face-detector";

interface CameraCaptureProps {
  /** 复核确认后回调图片和用户填写的当前年龄 */
  onCapture: (imageDataUrl: string, currentAge: number) => void;
  /** 用户取消 / 返回 */
  onCancel?: () => void;
}

type CameraState = "idle" | "starting" | "ready" | "review" | "denied" | "error";

const MAX_EDGE = 512;
const FACE_SCORE_THRESHOLD = 0.5;
const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;

export default function CameraCapture({ onCapture, onCancel }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [state, setState] = useState<CameraState>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [startingLabel, setStartingLabel] = useState("摄像头正在接入舱体");
  const [faceDetected, setFaceDetected] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [reviewImage, setReviewImage] = useState("");
  const [currentAge, setCurrentAge] = useState(20);

  const { status: detectorStatus, detect } = useFaceDetector();

  const faceReady = detectorStatus === "ready" ? faceDetected : true;
  const statusLabel = getStatusLabel(state, detectorStatus, faceReady, countdown);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const start = useCallback(async () => {
    setStartingLabel("摄像头正在接入舱体");
    setState("starting");
    setErrorMsg("");
    setCountdown(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setState("ready");
    } catch (err) {
      if (
        err instanceof DOMException &&
        (err.name === "NotAllowedError" || err.name === "SecurityError")
      ) {
        setState("denied");
      } else {
        setErrorMsg(err instanceof Error ? err.message : "无法访问摄像头");
        setState("error");
      }
    }
  }, []);

  useEffect(() => stop, [stop]);

  useEffect(() => {
    if (state !== "ready" || detectorStatus !== "ready") return;
    let timer = 0;
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      const video = videoRef.current;
      if (video && video.readyState >= 2) {
        const faces = detect(video, performance.now());
        setFaceDetected(
          faces.some((f) => (f.categories?.[0]?.score ?? 1) >= FACE_SCORE_THRESHOLD),
        );
      }
      timer = window.setTimeout(tick, 180);
    };
    tick();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [state, detectorStatus, detect]);

  const captureFrame = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return;

    const scale = Math.min(1, MAX_EDGE / Math.max(vw, vh));
    const cw = Math.round(vw * scale);
    const ch = Math.round(vh * scale);

    const canvas = document.createElement("canvas");
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.translate(cw, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, cw, ch);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    stop();
    setReviewImage(dataUrl);
    setState("review");
    setFaceDetected(false);
    setCountdown(null);
  }, [stop]);

  useEffect(() => {
    if (countdown === null) return;
    const timer = window.setTimeout(() => {
      if (countdown <= 1) {
        captureFrame();
      } else {
        setCountdown((value) => (value ? value - 1 : value));
      }
    }, 720);

    return () => window.clearTimeout(timer);
  }, [captureFrame, countdown]);

  const beginCapture = useCallback(() => {
    if (!faceReady || countdown !== null) return;
    setCountdown(3);
  }, [countdown, faceReady]);

  const cancel = useCallback(() => {
    stop();
    setState("idle");
    setCountdown(null);
    setReviewImage("");
    onCancel?.();
  }, [onCancel, stop]);

  const choosePhoto = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const importPhoto = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        setErrorMsg("请选择 JPG、PNG 或 WebP 格式的人像照片。");
        setState("error");
        return;
      }
      if (file.size > MAX_UPLOAD_BYTES) {
        setErrorMsg("图片过大，请选择小于 12MB 的照片。");
        setState("error");
        return;
      }

      setState("starting");
      setStartingLabel("正在读取照片");
      setErrorMsg("");
      try {
        const imageDataUrl = await normalizePhoto(file);
        stop();
        setReviewImage(imageDataUrl);
        setState("review");
      } catch {
        setErrorMsg("这张图片无法读取，请换一张清晰的正面人像。");
        setState("error");
      }
    },
    [stop],
  );

  const confirmReview = useCallback(() => {
    if (!reviewImage) return;
    onCapture(reviewImage, currentAge);
    setReviewImage("");
    setState("idle");
  }, [currentAge, onCapture, reviewImage]);

  const retake = useCallback(() => {
    setReviewImage("");
    void start();
  }, [start]);

  return (
    <div className="camera-console">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="visually-hidden"
        onChange={importPhoto}
      />
      <div className="camera-header">
        <span>FACE INPUT</span>
        <strong>{statusLabel}</strong>
      </div>

      <div className={`camera-chamber is-${state}`}>
        <video
          ref={videoRef}
          playsInline
          muted
          className="camera-video"
          aria-label="摄像头预览"
        />

        <div className="camera-grid-overlay" aria-hidden="true" />
        <div className="camera-corners" aria-hidden="true" />
        <div className="camera-scanline" aria-hidden="true" />

        {state === "ready" && (
          <div className="face-target" aria-hidden="true">
            <span className={faceReady ? "is-ready" : ""} />
          </div>
        )}

        {state === "review" && reviewImage && (
          <div className="camera-review">
            {/* 动态 data URL 预览，不使用 next/image。 */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={reviewImage} alt="待生成的当前照片" className="camera-review-image" />
            <div className="review-seal" aria-hidden="true">
              <span>INPUT SEALED</span>
              <i />
            </div>
            <div className="review-age-control">
              <label htmlFor="current-age">当前年龄</label>
              <input
                id="current-age"
                type="number"
                min={1}
                max={100}
                value={currentAge}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  if (Number.isFinite(next)) setCurrentAge(Math.min(100, Math.max(1, next)));
                }}
              />
              <span>岁</span>
            </div>
          </div>
        )}

        {state !== "ready" && state !== "review" && (
          <div className="camera-idle-overlay">
            <div className="idle-face" aria-hidden="true">
              <span />
            </div>
            {state === "idle" && (
              <>
                <p>将正脸放入校准舱，系统会锁定此刻的你。</p>
                <button onClick={start} className="machine-button primary">
                  开启摄像头
                </button>
                <button onClick={choosePhoto} className="machine-button secondary">
                  导入照片
                </button>
              </>
            )}
            {state === "starting" && <p className="pulse-text">{startingLabel}</p>}
            {state === "denied" && (
              <>
                <p className="camera-error">摄像头权限被拒绝。请允许权限后重试。</p>
                <button onClick={start} className="machine-button secondary">
                  重试接入
                </button>
                <button onClick={choosePhoto} className="machine-button secondary">
                  导入照片
                </button>
              </>
            )}
            {state === "error" && (
              <>
                <p className="camera-error">{errorMsg || "摄像头出错了"}</p>
                <button onClick={start} className="machine-button secondary">
                  重试接入
                </button>
                <button onClick={choosePhoto} className="machine-button secondary">
                  导入照片
                </button>
              </>
            )}
          </div>
        )}

        {state === "ready" && detectorStatus === "loading" && (
          <span className="camera-toast">人脸检测模块加载中，不影响拍摄</span>
        )}

        {countdown !== null && (
          <div className="countdown-overlay" aria-live="assertive">
            <span>{countdown}</span>
          </div>
        )}
      </div>

      <div className="camera-controls">
        {state === "ready" ? (
          <>
            <button
              onClick={beginCapture}
              disabled={!faceReady || countdown !== null}
              className="machine-button primary"
            >
              {countdown !== null
                ? "时间快门启动中"
                : faceReady
                  ? "启动时间快门"
                  : "等待人脸锁定"}
            </button>
            <button onClick={choosePhoto} className="machine-button secondary">
              更换照片
            </button>
            {onCancel && (
              <button onClick={cancel} className="machine-button secondary">
                退出校准
              </button>
            )}
          </>
        ) : state === "review" ? (
          <>
            <button onClick={confirmReview} className="machine-button primary">
              开始推演
            </button>
            <button onClick={retake} className="machine-button secondary">
              重新拍摄
            </button>
            <button onClick={choosePhoto} className="machine-button secondary">
              另选照片
            </button>
            {onCancel && (
              <button onClick={cancel} className="machine-button secondary">
                返回控制舱
              </button>
            )}
          </>
        ) : (
          onCancel && (
            <button onClick={cancel} className="machine-button secondary">
              返回控制舱
            </button>
          )
        )}
      </div>
    </div>
  );
}

async function normalizePhoto(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const image = await loadImage(url);
    const scale = Math.min(1, MAX_EDGE / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable");
    ctx.drawImage(image, 0, 0, width, height);
    return canvas.toDataURL("image/jpeg", 0.92);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function getStatusLabel(
  state: CameraState,
  detectorStatus: "loading" | "ready" | "unavailable",
  faceReady: boolean,
  countdown: number | null,
) {
  if (countdown !== null) return "时间快门";
  if (state === "idle") return "待接入";
  if (state === "starting") return "接入中";
  if (state === "review") return "照片复核";
  if (state === "denied") return "权限阻断";
  if (state === "error") return "接入失败";
  if (detectorStatus === "loading") return "检测加载";
  if (detectorStatus === "unavailable") return "手动校准";
  return faceReady ? "人脸锁定" : "等待锁定";
}
