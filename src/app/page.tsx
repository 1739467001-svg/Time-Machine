"use client";

import { useCallback, useState } from "react";
import AgeTimeline from "@/components/AgeTimeline";
import CameraCapture from "@/components/CameraCapture";
import type { AgedImage } from "@/lib/aging";

type Stage = "intro" | "capture" | "processing" | "result" | "error";

export default function Home() {
  const [stage, setStage] = useState<Stage>("intro");
  const [original, setOriginal] = useState<string>("");
  const [results, setResults] = useState<AgedImage[]>([]);
  const [errorMsg, setErrorMsg] = useState("");

  const handleCapture = useCallback(async (imageDataUrl: string) => {
    setOriginal(imageDataUrl);
    setStage("processing");
    setErrorMsg("");
    try {
      const res = await fetch("/api/age", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: imageDataUrl }),
      });
      const data = (await res.json()) as { results?: AgedImage[]; error?: string };
      if (!res.ok || !data.results) {
        throw new Error(data.error ?? "处理失败");
      }
      setResults(data.results);
      setStage("result");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "处理失败");
      setStage("error");
    }
  }, []);

  const reset = useCallback(() => {
    setOriginal("");
    setResults([]);
    setErrorMsg("");
    setStage("intro");
  }, []);

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
            onClick={() => setStage("capture")}
            className="rounded-full bg-emerald-500 px-8 py-3 text-base font-semibold text-black shadow-lg transition hover:bg-emerald-400"
          >
            进入时光机 →
          </button>
          <PrivacyNote />
        </section>
      )}

      {stage === "capture" && (
        <section className="w-full">
          <CameraCapture onCapture={handleCapture} onCancel={reset} />
          <div className="mt-8 flex justify-center">
            <PrivacyNote />
          </div>
        </section>
      )}

      {stage === "processing" && (
        <section className="flex flex-col items-center gap-6 py-16 text-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/15 border-t-emerald-400" />
          <p className="animate-pulse text-zinc-300">时光机运转中，正在推演你的未来…</p>
        </section>
      )}

      {stage === "result" && (
        <section className="w-full">
          <AgeTimeline originalImage={original} results={results} />
          <div className="mt-10 flex flex-col items-center gap-4">
            <button
              onClick={reset}
              className="rounded-full border border-white/20 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              再来一次
            </button>
            <PrivacyNote />
          </div>
        </section>
      )}

      {stage === "error" && (
        <section className="flex flex-col items-center gap-5 py-16 text-center">
          <p className="text-rose-300">{errorMsg}</p>
          <button
            onClick={reset}
            className="rounded-full border border-white/20 px-6 py-2.5 text-sm text-white transition hover:bg-white/10"
          >
            重新开始
          </button>
        </section>
      )}
    </main>
  );
}

function PrivacyNote() {
  return (
    <p className="max-w-sm text-center text-xs leading-relaxed text-zinc-500">
      🔒 你的照片仅用于本次推演，处理后即丢弃，不会保存或上传第三方。
      （当前为本地占位引擎；接入云端模型后此处会更新数据流向说明。）
    </p>
  );
}
