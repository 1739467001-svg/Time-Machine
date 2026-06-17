"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Detection, FaceDetector } from "@mediapipe/tasks-vision";

/**
 * MediaPipe 人脸检测 hook。
 *
 * 比浏览器实验性的 FaceDetector 更稳、跨浏览器一致。模型与 WASM 运行时从
 * CDN 加载；任何环节失败都会降级为 status="unavailable"，由调用方决定不阻塞
 * 拍摄（人脸检测只是「锦上添花」，绝不应该挡住用户）。
 */

const VERSION = "0.10.35";
const WASM_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}/wasm`;
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite";

export type FaceDetectorStatus = "loading" | "ready" | "unavailable";

export interface UseFaceDetector {
  status: FaceDetectorStatus;
  /** 对当前视频帧做检测，返回检测到的人脸；不可用时返回空数组 */
  detect: (video: HTMLVideoElement, timestampMs: number) => Detection[];
}

export function useFaceDetector(): UseFaceDetector {
  const detectorRef = useRef<FaceDetector | null>(null);
  const [status, setStatus] = useState<FaceDetectorStatus>("loading");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { FilesetResolver, FaceDetector } = await import("@mediapipe/tasks-vision");
        const vision = await FilesetResolver.forVisionTasks(WASM_URL);

        // 优先 GPU，失败再退回 CPU。
        let detector: FaceDetector;
        try {
          detector = await FaceDetector.createFromOptions(vision, {
            baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
            runningMode: "VIDEO",
          });
        } catch {
          detector = await FaceDetector.createFromOptions(vision, {
            baseOptions: { modelAssetPath: MODEL_URL, delegate: "CPU" },
            runningMode: "VIDEO",
          });
        }

        if (cancelled) {
          detector.close();
          return;
        }
        detectorRef.current = detector;
        setStatus("ready");
      } catch (err) {
        console.warn("人脸检测不可用，降级为手动拍摄：", err);
        if (!cancelled) setStatus("unavailable");
      }
    })();

    return () => {
      cancelled = true;
      detectorRef.current?.close();
      detectorRef.current = null;
    };
  }, []);

  const detect = useCallback((video: HTMLVideoElement, timestampMs: number): Detection[] => {
    const detector = detectorRef.current;
    if (!detector) return [];
    try {
      return detector.detectForVideo(video, timestampMs).detections ?? [];
    } catch {
      return [];
    }
  }, []);

  return { status, detect };
}
