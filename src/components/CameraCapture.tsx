"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface CameraCaptureProps {
  /** 抓拍完成后回调，参数为 base64 JPEG data URL */
  onCapture: (imageDataUrl: string) => void;
  /** 用户取消 / 返回 */
  onCancel?: () => void;
}

type CameraState = "idle" | "starting" | "ready" | "denied" | "error";

// 导出图片的最长边（像素）。变老模型通常只需要中等分辨率的正脸。
const MAX_EDGE = 512;

// 实验性 Shape Detection API 的最小类型声明（仅部分浏览器支持）。
interface DetectedFace {
  boundingBox: DOMRectReadOnly;
}
interface FaceDetectorLike {
  detect(source: CanvasImageSource): Promise<DetectedFace[]>;
}
interface FaceDetectorCtor {
  new (opts?: { fastMode?: boolean; maxDetectedFaces?: number }): FaceDetectorLike;
}

export default function CameraCapture({ onCapture, onCancel }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [state, setState] = useState<CameraState>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  // 是否检测到人脸；浏览器不支持检测时恒为 true（不阻塞拍摄）。
  const [faceReady, setFaceReady] = useState(false);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const start = useCallback(async () => {
    setState("starting");
    setErrorMsg("");
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

  // 组件卸载时关闭摄像头，避免摄像头一直亮着。
  useEffect(() => stop, [stop]);

  // 可选的人脸存在检测：仅在浏览器支持实验性 FaceDetector 时启用，
  // 否则降级为「始终可拍」。后续可替换为 MediaPipe / face-api.js。
  useEffect(() => {
    if (state !== "ready") return;
    const Ctor = (window as unknown as { FaceDetector?: FaceDetectorCtor }).FaceDetector;
    if (!Ctor) {
      setFaceReady(true);
      return;
    }
    const detector = new Ctor({ fastMode: true, maxDetectedFaces: 1 });
    let timer = 0;
    let cancelled = false;
    const tick = async () => {
      if (cancelled || !videoRef.current) return;
      try {
        const faces = await detector.detect(videoRef.current);
        setFaceReady(faces.length > 0);
      } catch {
        setFaceReady(true); // 检测异常时不阻塞拍摄
      }
      timer = window.setTimeout(tick, 500);
    };
    void tick();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [state]);

  const capture = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return;

    // 按最长边缩放到 MAX_EDGE
    const scale = Math.min(1, MAX_EDGE / Math.max(vw, vh));
    const cw = Math.round(vw * scale);
    const ch = Math.round(vh * scale);

    const canvas = document.createElement("canvas");
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // 前置摄像头镜像：水平翻转，让导出图与用户在屏幕上看到的一致。
    ctx.translate(cw, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, cw, ch);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    stop();
    setState("idle");
    setFaceReady(false);
    onCapture(dataUrl);
  }, [onCapture, stop]);

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="relative aspect-[3/4] w-full max-w-sm overflow-hidden rounded-3xl border border-white/10 bg-black/40 shadow-2xl">
        {/* 摄像头预览（镜像显示） */}
        <video
          ref={videoRef}
          playsInline
          muted
          className="h-full w-full -scale-x-100 object-cover"
        />

        {/* 人脸引导框 */}
        {state === "ready" && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div
              className={`h-2/3 w-1/2 rounded-[50%] border-2 transition-colors ${
                faceReady ? "border-emerald-400/80" : "border-white/40"
              }`}
            />
          </div>
        )}

        {/* 非就绪态的覆盖层 */}
        {state !== "ready" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
            {state === "idle" && (
              <>
                <p className="text-sm text-zinc-300">
                  把脸对准取景框，我会捕捉你此刻的样子。
                </p>
                <button
                  onClick={start}
                  className="rounded-full bg-emerald-500 px-6 py-2.5 text-sm font-semibold text-black transition hover:bg-emerald-400"
                >
                  开启摄像头
                </button>
              </>
            )}
            {state === "starting" && (
              <p className="animate-pulse text-sm text-zinc-300">正在唤醒摄像头…</p>
            )}
            {state === "denied" && (
              <>
                <p className="text-sm text-rose-300">
                  摄像头权限被拒绝。请在浏览器地址栏的权限设置里允许后重试。
                </p>
                <button
                  onClick={start}
                  className="rounded-full border border-white/20 px-5 py-2 text-sm text-white transition hover:bg-white/10"
                >
                  重试
                </button>
              </>
            )}
            {state === "error" && (
              <>
                <p className="text-sm text-rose-300">{errorMsg || "摄像头出错了"}</p>
                <button
                  onClick={start}
                  className="rounded-full border border-white/20 px-5 py-2 text-sm text-white transition hover:bg-white/10"
                >
                  重试
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* 拍摄控制 */}
      {state === "ready" && (
        <div className="flex flex-col items-center gap-3">
          <button
            onClick={capture}
            disabled={!faceReady}
            className="rounded-full bg-emerald-500 px-8 py-3 text-base font-semibold text-black shadow-lg transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {faceReady ? "拍一张 · 启动时光机" : "请把脸放进取景框…"}
          </button>
          {onCancel && (
            <button
              onClick={() => {
                stop();
                setState("idle");
                onCancel();
              }}
              className="text-xs text-zinc-400 underline-offset-4 hover:underline"
            >
              取消
            </button>
          )}
        </div>
      )}
    </div>
  );
}
