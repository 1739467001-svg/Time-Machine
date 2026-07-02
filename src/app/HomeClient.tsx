"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import AgeTimeline, { type AgeCard } from "@/components/AgeTimeline";
import CameraCapture from "@/components/CameraCapture";
import ConsentModal from "@/components/ConsentModal";
import { FUTURE_AGE_STEPS, type AgeStep } from "@/lib/ages";
import type { AgedImage, EngineInfo } from "@/lib/aging";
import { composeTimeline, type TimelineCard } from "@/lib/share/compose-timeline";

type Stage = "intro" | "capture" | "result";

interface HomeClientProps {
  /** 服务端注入的当前引擎元信息（决定是否需要云端上传知情同意） */
  engine: EngineInfo;
}

export default function HomeClient({ engine }: HomeClientProps) {
  const [stage, setStage] = useState<Stage>("intro");
  const [original, setOriginal] = useState("");
  const [cards, setCards] = useState<AgeCard[]>([]);
  const [exporting, setExporting] = useState(false);
  // 云端引擎的知情同意：本次会话内一旦同意就不再重复弹（reset 不清除）。
  const [consented, setConsented] = useState(false);
  const [showConsent, setShowConsent] = useState(false);

  // Web Share API 是「客户端能力」：服务端快照返回 false，客户端返回实际支持
  // 情况。用 useSyncExternalStore 取值，既避免水合不一致，也不在 effect 里 setState。
  const canShare = useSyncExternalStore(
    subscribeNoop,
    () => typeof navigator !== "undefined" && typeof navigator.share === "function",
    () => false,
  );

  // 生成单个年龄段：失败可单独重试。
  const runStep = useCallback((step: AgeStep, img: string) => {
    setCards((prev) =>
      prev.map((c) =>
        c.step.id === step.id ? { ...c, status: "pending", result: undefined } : c,
      ),
    );
    fetch("/api/age", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: img, stepId: step.id }),
    })
      .then(async (res) => {
        const data = (await res.json()) as { result?: AgedImage; error?: string };
        if (!res.ok || !data.result) throw new Error(data.error ?? "失败");
        const result = data.result;
        setCards((prev) =>
          prev.map((c) => (c.step.id === step.id ? { ...c, status: "done", result } : c)),
        );
      })
      .catch(() => {
        setCards((prev) =>
          prev.map((c) => (c.step.id === step.id ? { ...c, status: "error" } : c)),
        );
      });
  }, []);

  const handleCapture = useCallback(
    (img: string) => {
      setOriginal(img);
      setCards(FUTURE_AGE_STEPS.map((step) => ({ step, status: "pending" as const })));
      setStage("result");
      // 6 个年龄段并行 fan-out，各自就绪即展示。
      FUTURE_AGE_STEPS.forEach((step) => runStep(step, img));
    },
    [runStep],
  );

  // 进入摄像头前的闸门：云端引擎且尚未同意时，先弹阻断式知情同意框。
  const handleEnter = useCallback(() => {
    if (engine.cloud && !consented) {
      setShowConsent(true);
      return;
    }
    setStage("capture");
  }, [engine.cloud, consented]);

  const acceptConsent = useCallback(() => {
    setConsented(true);
    setShowConsent(false);
    setStage("capture");
  }, []);

  const cancelConsent = useCallback(() => setShowConsent(false), []);

  const handleRetry = useCallback(
    (stepId: string) => {
      const step = FUTURE_AGE_STEPS.find((s) => s.id === stepId);
      if (step) runStep(step, original);
    },
    [original, runStep],
  );

  const reset = useCallback(() => {
    setOriginal("");
    setCards([]);
    setStage("intro");
  }, []);

  // 组装用于导出的卡片：现在 + 已完成的年龄段。
  const buildTimelineCards = useCallback((): TimelineCard[] => {
    const now: TimelineCard = {
      label: "现在",
      yearsFromNow: 0,
      imageUrl: original,
      placeholder: false,
    };
    const done = cards.flatMap<TimelineCard>((c) =>
      c.status === "done" && c.result
        ? [
            {
              label: c.step.label,
              yearsFromNow: c.step.yearsFromNow,
              imageUrl: c.result.imageUrl,
              placeholder: c.result.placeholder,
              intensity: c.result.intensity,
            },
          ]
        : [],
    );
    return [now, ...done];
  }, [original, cards]);

  const handleDownload = useCallback(async () => {
    setExporting(true);
    try {
      const blob = await composeTimeline(buildTimelineCards());
      triggerDownload(blob, "time-machine.png");
    } finally {
      setExporting(false);
    }
  }, [buildTimelineCards]);

  const handleShare = useCallback(async () => {
    setExporting(true);
    try {
      const blob = await composeTimeline(buildTimelineCards());
      const file = new File([blob], "time-machine.png", { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "时光机",
          text: "看看我未来几十年的样子",
        });
      } else {
        triggerDownload(blob, "time-machine.png");
      }
    } catch {
      // 用户取消分享等情况，静默忽略
    } finally {
      setExporting(false);
    }
  }, [buildTimelineCards]);

  const pending = cards.some((c) => c.status === "pending");
  const doneCount = cards.filter((c) => c.status === "done").length;
  const canExport = !pending && doneCount > 0;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center px-5 py-10 sm:py-16">
      <header className="mb-10 text-center">
        <h1 className="bg-gradient-to-r from-emerald-300 via-cyan-300 to-indigo-300 bg-clip-text text-4xl font-black tracking-tight text-transparent sm:text-5xl">
          时光机
        </h1>
        <p className="mt-3 text-sm text-zinc-400 sm:text-base">
          拍一张照片，看看 10 / 20 / 30 / 40 / 50 / 60 年后的自己
        </p>
      </header>

      {stage === "intro" && (
        <section className="flex max-w-md flex-col items-center gap-6 text-center">
          <p className="text-zinc-300">
            时光机会捕捉你此刻的样子，再用 AI 推演出你未来几十年的样貌，
            生成一条从现在到 60 年后的「人生时间轴」。
          </p>
          <button
            onClick={handleEnter}
            className="rounded-full bg-emerald-500 px-8 py-3 text-base font-semibold text-black shadow-lg transition hover:bg-emerald-400"
          >
            进入时光机 →
          </button>
          <PrivacyNote engine={engine} />
        </section>
      )}

      {stage === "capture" && (
        <section className="w-full">
          <CameraCapture onCapture={handleCapture} onCancel={reset} />
          <div className="mt-8 flex justify-center">
            <PrivacyNote engine={engine} />
          </div>
        </section>
      )}

      {stage === "result" && (
        <section className="w-full">
          <AgeTimeline originalImage={original} cards={cards} onRetry={handleRetry} />

          {pending && (
            <p className="mt-6 animate-pulse text-center text-sm text-zinc-400">
              时光机运转中，正在逐张推演你的未来…
            </p>
          )}

          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={reset}
              className="rounded-full border border-white/20 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              再来一次
            </button>
            <button
              onClick={handleDownload}
              disabled={!canExport || exporting}
              className="rounded-full bg-emerald-500 px-6 py-2.5 text-sm font-semibold text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {exporting ? "生成中…" : "下载长图"}
            </button>
            {canShare && (
              <button
                onClick={handleShare}
                disabled={!canExport || exporting}
                className="rounded-full border border-white/20 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                分享
              </button>
            )}
          </div>

          <div className="mt-6 flex justify-center">
            <PrivacyNote engine={engine} />
          </div>
        </section>
      )}

      {showConsent && (
        <ConsentModal engine={engine} onAccept={acceptConsent} onCancel={cancelConsent} />
      )}
    </main>
  );
}

// useSyncExternalStore 的订阅函数：canShare 的值不会变化，故订阅为空操作。
const subscribeNoop = () => () => {};

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function PrivacyNote({ engine }: { engine: EngineInfo }) {
  if (engine.cloud) {
    return (
      <p className="max-w-sm text-center text-xs leading-relaxed text-zinc-500">
        🔒 当前为云端引擎（{engine.vendor}）：抓拍的照片会上传至该服务商完成 AI 处理，
        本服务处理后即丢弃、不保存。进入摄像头前会先请你确认。
      </p>
    );
  }
  return (
    <p className="max-w-sm text-center text-xs leading-relaxed text-zinc-500">
      🔒 当前为本地占位引擎：照片仅上传到本站服务端做占位处理，不发送给任何第三方 AI 服务商，处理后即从内存丢弃，不落盘、不保存。
    </p>
  );
}
