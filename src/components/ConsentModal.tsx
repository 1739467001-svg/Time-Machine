"use client";

import { useEffect, useRef } from "react";
import type { EngineInfo } from "@/lib/aging";

interface ConsentModalProps {
  /** 当前引擎元信息（应为云端引擎；vendor 用于文案） */
  engine: EngineInfo;
  /** 用户明确同意上传 */
  onAccept: () => void;
  /** 用户取消 / 返回（含点遮罩、按 Esc） */
  onCancel: () => void;
}

/**
 * 云端引擎的阻断式知情同意弹窗。
 *
 * 仅当服务端配置为云端引擎（gemini / qwen）时才出现：进入摄像头、上传人脸之前，
 * 必须明确告知用户「照片将上传到哪个服务商」并取得同意。本地 mock 引擎数据不出
 * 设备，不会弹此框（见 HomeClient 的 handleEnter）。
 */
export default function ConsentModal({ engine, onAccept, onCancel }: ConsentModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const acceptRef = useRef<HTMLButtonElement>(null);
  // 只有「在遮罩上按下、又在遮罩上抬起」才算点击遮罩关闭——避免在弹窗内选中
  // 文字时不小心拖到遮罩上抬手而误关。
  const pressedOnBackdrop = useRef(false);
  const vendor = engine.vendor ?? "第三方云端服务";

  useEffect(() => {
    // 记住打开前的焦点元素，关闭时归还（无障碍：焦点不该丢到 body）。
    const previouslyFocused = document.activeElement as HTMLElement | null;
    acceptRef.current?.focus();

    // 打开期间锁定背景滚动，避免滚动穿透到底层页面。
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCancel();
        return;
      }
      if (e.key === "Tab") {
        // 焦点陷阱：把 Tab / Shift+Tab 循环限制在弹窗内部，兑现 aria-modal 语义。
        const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (!focusables || focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus?.();
    };
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-5 backdrop-blur-sm"
      onMouseDown={(e) => {
        pressedOnBackdrop.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && pressedOnBackdrop.current) onCancel();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="consent-title"
        className="w-full max-w-md rounded-3xl border border-white/10 bg-zinc-900 p-6 shadow-2xl"
      >
        <h2 id="consent-title" className="text-lg font-bold text-white">
          上传前，请先知情同意
        </h2>

        <div className="mt-4 space-y-3 text-sm leading-relaxed text-zinc-300">
          <p>
            本站当前使用<strong className="text-white">云端变老引擎</strong>。你拍下的照片会被
            <strong className="text-emerald-300">上传至 {vendor}</strong> 的服务器完成 AI 变老处理。
          </p>
          <ul className="list-disc space-y-1 pl-5 text-zinc-400">
            <li>照片仅用于本次推演，本服务处理后即丢弃，不落盘、不入库、不打日志。</li>
            <li>照片一旦上传至服务商，其如何处理由该服务商条款约束，已超出本站控制范围。</li>
            <li>本产品仅供娱乐，生成的是「看起来合理」的样貌，并非科学预测。</li>
            <li>请只上传你本人的照片，不要用于伪造他人容貌、身份验证等用途。</li>
          </ul>
          <p className="text-zinc-400">
            不同意也没关系——你可以返回；若担心隐私，可让部署者切换到本地占位引擎（数据不出设备）。
          </p>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            onClick={onCancel}
            className="rounded-full border border-white/20 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            返回
          </button>
          <button
            ref={acceptRef}
            onClick={onAccept}
            className="rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-emerald-400"
          >
            我已知悉，同意上传
          </button>
        </div>
      </div>
    </div>
  );
}
