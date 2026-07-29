"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import AgeTimeline, { type AgeCard } from "@/components/AgeTimeline";
import CameraCapture from "@/components/CameraCapture";
import { FUTURE_AGE_STEPS, type AgeStep } from "@/lib/ages";
import type { AgedImage, AgingProviderInfo } from "@/lib/aging";
import { composeTimeline, type TimelineCard } from "@/lib/share/compose-timeline";

type Stage = "intro" | "capture" | "result";

export default function Home() {
  const [stage, setStage] = useState<Stage>("intro");
  const [original, setOriginal] = useState("");
  const [cards, setCards] = useState<AgeCard[]>([]);
  const [exporting, setExporting] = useState(false);
  const [providerInfo, setProviderInfo] = useState<AgingProviderInfo | null>(null);
  const [providerInfoError, setProviderInfoError] = useState(false);
  const [cloudConsent, setCloudConsent] = useState(false);
  const [showConsentDialog, setShowConsentDialog] = useState(false);
  const [currentAge, setCurrentAge] = useState(20);
  const activeRunRef = useRef(0);

  const canShare = useSyncExternalStore(
    subscribeNoop,
    () => typeof navigator !== "undefined" && typeof navigator.share === "function",
    () => false,
  );

  useEffect(() => {
    let cancelled = false;
    fetch("/api/provider")
      .then(async (res) => {
        if (!res.ok) throw new Error("provider lookup failed");
        return (await res.json()) as { provider: AgingProviderInfo };
      })
      .then(({ provider }) => {
        if (cancelled) return;
        setProviderInfo(provider);
        setProviderInfoError(false);
      })
      .catch(() => {
        if (cancelled) return;
        setProviderInfo(null);
        setProviderInfoError(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const enterCapture = useCallback(() => {
    const infoLoaded = providerInfo || providerInfoError;
    if (!infoLoaded) return;
    if (!providerInfo?.ready) return;

    const needsConsent = providerInfo?.requiresConsent ?? true;
    if (needsConsent && !cloudConsent) {
      setShowConsentDialog(true);
      return;
    }

    setStage("capture");
  }, [cloudConsent, providerInfo, providerInfoError]);

  const acceptCloudConsent = useCallback(() => {
    setCloudConsent(true);
    setShowConsentDialog(false);
    setStage("capture");
  }, []);

  const runStep = useCallback(
    async (
      step: AgeStep,
      img: string,
      sourceYearsFromNow: number,
      runId: number,
      sourceCurrentAge: number,
    ): Promise<AgedImage | null> => {
      setCards((prev) =>
        prev.map((c) =>
          c.step.id === step.id
            ? { ...c, status: "pending", result: undefined, error: undefined }
            : c,
        ),
      );
      try {
        const res = await fetch("/api/age", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image: img,
            stepId: step.id,
            sourceYearsFromNow,
            currentAge: sourceCurrentAge,
          }),
        });
        const data = (await res.json()) as { result?: AgedImage; error?: string };
        if (!res.ok || !data.result) {
          throw new Error(data.error ?? "图像生成失败，请重试。");
        }
        if (activeRunRef.current !== runId) return null;
        const result = data.result;
        setCards((prev) =>
          prev.map((c) =>
            c.step.id === step.id ? { ...c, status: "done", result } : c,
          ),
        );
        return result;
      } catch (err) {
        if (activeRunRef.current !== runId) return null;
        const error = err instanceof Error ? err.message : "图像生成失败，请重试。";
        setCards((prev) =>
          prev.map((c) =>
            c.step.id === step.id ? { ...c, status: "error", error } : c,
          ),
        );
        return null;
      }
    },
    [],
  );

  const runTimeline = useCallback(
    (sourceImage: string, startIndex = 0, sourceYearsFromNow = 0, sourceCurrentAge = currentAge) => {
      const runId = activeRunRef.current + 1;
      activeRunRef.current = runId;
      setCards((prev) => {
        const next = prev.length
          ? prev
          : FUTURE_AGE_STEPS.map((step) => ({ step, status: "pending" as const }));
        return next.map((card, index) =>
          index >= startIndex
            ? { ...card, status: "pending" as const, result: undefined, error: undefined }
            : card,
        );
      });

      void (async () => {
        let currentImage = sourceImage;
        let currentYears = sourceYearsFromNow;

        for (let index = startIndex; index < FUTURE_AGE_STEPS.length; index += 1) {
          const step = FUTURE_AGE_STEPS[index];
          const result = await runStep(
            step,
            currentImage,
            currentYears,
            runId,
            sourceCurrentAge,
          );
          if (!result || activeRunRef.current !== runId) {
            if (activeRunRef.current === runId) {
              setCards((prev) =>
                prev.map((card, cardIndex) =>
                  cardIndex > index && card.status === "pending"
                    ? {
                        ...card,
                        status: "error",
                        error: "等待上一年龄段重新生成。",
                      }
                    : card,
                ),
              );
            }
            return;
          }
          currentImage = result.imageUrl;
          currentYears = step.yearsFromNow;
        }
      })();
    },
    [currentAge, runStep],
  );

  const handleCapture = useCallback(
    (img: string, age: number) => {
      setOriginal(img);
      setCurrentAge(age);
      setStage("result");
      runTimeline(img, 0, 0, age);
    },
    [runTimeline],
  );

  const handleRetry = useCallback(
    (stepId: string) => {
      const targetIndex = FUTURE_AGE_STEPS.findIndex((step) => step.id === stepId);
      if (targetIndex < 0 || !original) return;

      let completedIndex = -1;
      for (let index = 0; index < targetIndex; index += 1) {
        const card = cards[index];
        if (card?.status !== "done" || !card.result) break;
        completedIndex = index;
      }

      const sourceImage =
        completedIndex >= 0 ? cards[completedIndex].result!.imageUrl : original;
      const sourceYears =
        completedIndex >= 0 ? FUTURE_AGE_STEPS[completedIndex].yearsFromNow : 0;
      runTimeline(sourceImage, completedIndex + 1, sourceYears, currentAge);
    },
    [cards, currentAge, original, runTimeline],
  );

  const reset = useCallback(() => {
    activeRunRef.current += 1;
    setOriginal("");
    setCards([]);
    setStage("intro");
  }, []);

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
  const errorCount = cards.filter((c) => c.status === "error").length;
  const canExport = !pending && doneCount > 0;
  const providerLoaded = Boolean(providerInfo || providerInfoError);
  const providerReady = providerInfo?.ready ?? false;

  return (
    <main className="machine-shell">
      <MachineHeader stage={stage} />

      {stage === "intro" && (
        <section className="launch-grid" aria-label="时光机启动舱">
          <div className="mission-column">
            <div className="mission-kicker">PERSONAL TIME CAPSULE</div>
            <h1 className="machine-title">时光机</h1>
            <p className="machine-lead">
              站进取景舱，系统会捕捉此刻的你，并推演 10 到 60 年后的时间切片。
            </p>

            <SystemStatusPanel
              providerInfo={providerInfo}
              error={providerInfoError}
              stage={stage}
              doneCount={doneCount}
              errorCount={errorCount}
            />

            <PrivacyNote providerInfo={providerInfo} error={providerInfoError} />
          </div>

          <TimeChamberPreview
            disabled={!providerLoaded || !providerReady}
            providerInfo={providerInfo}
            error={providerInfoError}
            onStart={enterCapture}
          />
        </section>
      )}

      {stage === "capture" && (
        <section className="capture-grid" aria-label="时光机校准舱">
          <div className="capture-copy">
            <p className="mission-kicker">CALIBRATION BAY</p>
            <h1 className="section-title">对准现在</h1>
            <p>
              把脸放进中心轮廓拍摄，或导入一张清晰正面照片。时间轨道会从此刻逐段向后展开。
            </p>
            <SystemStatusPanel
              providerInfo={providerInfo}
              error={providerInfoError}
              stage={stage}
              doneCount={doneCount}
              errorCount={errorCount}
            />
          </div>

          <div className="capture-dock">
            <CameraCapture onCapture={handleCapture} onCancel={reset} />
            <PrivacyNote providerInfo={providerInfo} error={providerInfoError} />
          </div>
        </section>
      )}

      {stage === "result" && (
        <section className="result-console" aria-label="人生时间轴">
          <div className="result-header">
            <div>
              <p className="mission-kicker">TEMPORAL OUTPUT</p>
              <h1 className="section-title">人生时间轴已展开</h1>
            </div>
            <GenerationMeter
              cards={cards}
              pending={pending}
            />
          </div>

          <AgeTimeline originalImage={original} cards={cards} onRetry={handleRetry} />

          <div className="command-deck">
            <button onClick={reset} className="machine-button secondary">
              重新校准
            </button>
            <button
              onClick={handleDownload}
              disabled={!canExport || exporting}
              className="machine-button primary"
            >
              {exporting ? "合成长图中" : "下载时间长图"}
            </button>
            {canShare && (
              <button
                onClick={handleShare}
                disabled={!canExport || exporting}
                className="machine-button secondary"
              >
                分享时间线
              </button>
            )}
          </div>

          <PrivacyNote providerInfo={providerInfo} error={providerInfoError} />
        </section>
      )}

      {showConsentDialog && (
        <CloudConsentDialog
          providerInfo={providerInfo}
          onCancel={() => setShowConsentDialog(false)}
          onConfirm={acceptCloudConsent}
        />
      )}
    </main>
  );
}

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

function MachineHeader({ stage }: { stage: Stage }) {
  const stageLabel =
    stage === "intro" ? "舱门待启动" : stage === "capture" ? "正在校准" : "时间线生成";

  return (
    <header className="machine-topbar">
      <div>
        <span className="topbar-code">TM-60</span>
        <span className="topbar-separator" />
        <span>{stageLabel}</span>
      </div>
      <div className="topbar-clock" aria-hidden="true">
        NOW / +10 / +20 / +30 / +40 / +50 / +60
      </div>
    </header>
  );
}

function TimeChamberPreview({
  disabled,
  providerInfo,
  error,
  onStart,
}: {
  disabled: boolean;
  providerInfo: AgingProviderInfo | null;
  error: boolean;
  onStart: () => void;
}) {
  const engineLabel = error
    ? "引擎待确认"
    : providerInfo
      ? providerInfo.ready
        ? providerInfo.displayName
        : "引擎配置错误"
      : "读取引擎中";

  return (
    <div className="time-chamber-preview">
      <div className="chamber-frame" aria-hidden="true">
        <div className="chamber-rings" />
        <div className="chamber-face">
          <span className="face-head" />
          <span className="face-shoulders" />
        </div>
        <div className="chamber-scan" />
        <div className="chamber-readout readout-a">IDENTITY LOCK</div>
        <div className="chamber-readout readout-b">AGING VECTOR 6X</div>
        <div className="time-ticks">
          {["NOW", "+10", "+20", "+30", "+40", "+50", "+60"].map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>
      </div>

      <div className="chamber-command">
        <div>
          <p className="panel-label">当前引擎</p>
          <p className="panel-value">{engineLabel}</p>
        </div>
        <button onClick={onStart} disabled={disabled} className="machine-button primary">
          {!providerInfo && !error
            ? "读取舱体配置"
            : providerInfo && !providerInfo.ready
              ? "引擎配置待修复"
              : error
                ? "引擎状态不可用"
                : "进入校准舱"}
        </button>
      </div>
    </div>
  );
}

function SystemStatusPanel({
  providerInfo,
  error,
  stage,
  doneCount,
  errorCount,
}: {
  providerInfo: AgingProviderInfo | null;
  error: boolean;
  stage: Stage;
  doneCount: number;
  errorCount: number;
}) {
  const engine = error
    ? "未确认"
    : providerInfo
      ? !providerInfo.ready
        ? "配置错误"
        : providerInfo.cloud
          ? providerInfo.displayName
          : "本地占位"
      : "读取中";
  const privacy = error
    ? "需确认"
    : providerInfo?.cloud
      ? "云端同意门"
      : "本地内存";
  const mode =
    stage === "result"
      ? `${doneCount}/6 完成${errorCount ? `，${errorCount} 失败` : ""}`
      : "逐段递进";

  return (
    <dl className="status-grid" aria-label="时光机状态">
      <div>
        <dt>引擎</dt>
        <dd>{engine}</dd>
      </div>
      <div>
        <dt>隐私</dt>
        <dd>{privacy}</dd>
      </div>
      <div>
        <dt>生成</dt>
        <dd>{mode}</dd>
      </div>
    </dl>
  );
}

function GenerationMeter({
  cards,
  pending,
}: {
  cards: AgeCard[];
  pending: boolean;
}) {
  return (
    <div className="generation-meter" aria-label="生成进度">
      <span>{pending ? "时间轨道运转中" : "时间轨道稳定"}</span>
      <div className="meter-bars" aria-hidden="true">
        {FUTURE_AGE_STEPS.map((step, index) => (
          <i
            key={step.id}
            className={
              cards[index]?.status === "done"
                ? "is-done"
                : cards[index]?.status === "error"
                  ? "is-error"
                  : ""
            }
          />
        ))}
      </div>
    </div>
  );
}

function PrivacyNote({
  providerInfo,
  error,
}: {
  providerInfo: AgingProviderInfo | null;
  error: boolean;
}) {
  if (error) {
    return (
      <p className="privacy-line">
        隐私状态未确认。继续前会先要求你确认本次处理可能使用云端模型。
      </p>
    );
  }

  if (!providerInfo) {
    return <p className="privacy-line">正在读取当前变老引擎配置。</p>;
  }

  if (!providerInfo.ready) {
    return (
      <p className="privacy-line is-error" role="alert">
        引擎配置错误：{providerInfo.configurationError ?? "请检查服务器环境变量。"}
      </p>
    );
  }

  return (
    <p className="privacy-line">
      {providerInfo.privacyNotice}
      {providerInfo.cloud
        ? " 项目不会把图片落盘、入库或写入日志。"
        : " 处理后即丢弃，不会保存或上传第三方。"}
    </p>
  );
}

function CloudConsentDialog({
  providerInfo,
  onCancel,
  onConfirm,
}: {
  providerInfo: AgingProviderInfo | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const providerName = providerInfo?.displayName ?? "云端 AI 引擎";
  const vendor = providerInfo?.vendor ?? "第三方服务商";
  const privacyNotice =
    providerInfo?.privacyNotice ??
    "当前未能确认具体引擎。继续后，本次抓拍照片可能会被发送至云端模型用于图像编辑。";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cloud-consent-title"
      className="consent-backdrop"
    >
      <section className="consent-panel">
        <p className="mission-kicker">PRIVACY GATE</p>
        <h2 id="cloud-consent-title">将使用 {providerName}</h2>
        <div className="consent-copy">
          <p>{privacyNotice}</p>
          <p>
            你的照片属于敏感生物特征数据。项目只在本次请求中处理它，不保存、不入库、
            不写入日志；但云端生成需要经过 {vendor} 的服务。
          </p>
        </div>
        <div className="consent-actions">
          <button onClick={onCancel} className="machine-button secondary">
            先不拍
          </button>
          <button onClick={onConfirm} className="machine-button primary">
            我了解并同意
          </button>
        </div>
      </section>
    </div>
  );
}
