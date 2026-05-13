import React, { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useStore } from "@/lib/useStore";
import { useI18n } from "@/lib/I18nContext";
import { api, ApiError } from "@/lib/api";

const RESOLUTIONS = [
  { label: "480p", value: "480p", sub: "854×480" },
  { label: "720p", value: "720p", sub: "1280×720" },
  { label: "1080p", value: "1080p", sub: "1920×1080" },
];

const ASPECT_RATIOS = [
  { label: "21:9", value: "21:9" },
  { label: "16:9", value: "16:9" },
  { label: "4:3",  value: "4:3"  },
  { label: "1:1",  value: "1:1"  },
  { label: "3:4",  value: "3:4"  },
  { label: "9:16", value: "9:16" },
];

function aspectStyle(ratio: string) {
  const map: Record<string, string> = {
    "21:9": "aspect-[21/9]", "16:9": "aspect-video", "4:3": "aspect-[4/3]",
    "1:1": "aspect-square", "3:4": "aspect-[3/4]",  "9:16": "aspect-[9/16]",
  };
  return map[ratio] ?? "aspect-square";
}

const MAX_REF_FILE_BYTES = 10 * 1024 * 1024;
const COST_PER_IMAGE = 5;
const POLL_INTERVAL_MS = 2500;
const MAX_POLL_ATTEMPTS = 60;
const MAX_CONSECUTIVE_ERRORS = 5;

export default function GenerateImage() {
  const { state, updateCredits, refreshGenerations } = useStore();
  const { t } = useI18n();

  // Qwen/WaveSpeed nao usa Soul ID — sem seletor de modelo treinado
  const [prompt, setPrompt] = useState("");
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [resolution, setResolution] = useState("1080p");
  const refInputRef = useRef<HTMLInputElement>(null);
  const [seed, setSeed] = useState<string>("");
  const [generating, setGenerating] = useState(false);
  const [generatingStatus, setGeneratingStatus] = useState<string>("");
  const [results, setResults] = useState<string[]>([]);
  const [lastPrompt, setLastPrompt] = useState("");
  const [genError, setGenError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const consecutiveErrorsRef = useRef(0);

  const canGenerate = prompt.trim().length >= 3 && referenceImage && !generating;
  const totalCost = COST_PER_IMAGE;

  function loadFile(file: File) {
    if (file.size > MAX_REF_FILE_BYTES) {
      alert("Imagem muito grande. Máximo: 10MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => setReferenceImage(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  function stopPolling() {
    if (pollRef.current) {
      clearTimeout(pollRef.current);
      pollRef.current = null;
    }
  }

  function getBackoff(attempt: number): number {
    const backoffs = [POLL_INTERVAL_MS, 5000, 10000, 15000];
    return backoffs[Math.min(attempt, backoffs.length - 1)];
  }

  async function pollStatus(pollId: string, attempt: number, consecutiveErrors: number) {
    if (attempt >= MAX_POLL_ATTEMPTS) {
      stopPolling();
      setGenerating(false);
      setGenError("Tempo esgotado. A geração demorou mais que o esperado. Verifique o Histórico em alguns instantes.");
      refreshCredits();
      return;
    }

    try {
      const res = await api.generate.imageStatus(pollId);

      consecutiveErrorsRef.current = 0;

      if (res.credits !== undefined) updateCredits(res.credits);

      if (res.status === "completed" && res.outputs.length > 0) {
        stopPolling();
        setResults(res.outputs);
        setGenerating(false);
        setGenError(null);
        refreshGenerations().catch(() => {});
      } else if (res.status === "failed") {
        stopPolling();
        setGenerating(false);
        const errMsg = res.error ?? "";
        if (errMsg.toLowerCase().includes("insufficient") || errMsg.toLowerCase().includes("top up") || errMsg.toLowerCase().includes("balance")) {
          setGenError("Serviço de imagem temporariamente indisponível: saldo do provedor insuficiente.");
        } else {
          setGenError(errMsg || "A geração falhou.");
        }
        if (res.credits === undefined) refreshCredits();
      } else {
        const statusLabel = res.status === "processing" ? "Processando" : "Aguardando";
        setGeneratingStatus(`${statusLabel}...`);
        pollRef.current = setTimeout(
          () => pollStatus(pollId, attempt + 1, 0),
          POLL_INTERVAL_MS,
        );
      }
    } catch {
      consecutiveErrorsRef.current += 1;
      if (consecutiveErrorsRef.current >= MAX_CONSECUTIVE_ERRORS) {
        stopPolling();
        setGenerating(false);
        setGenError("A geração foi enviada, mas não conseguimos sincronizar o status. Verifique o Histórico em alguns instantes.");
        refreshCredits();
        return;
      }
      const backoff = getBackoff(consecutiveErrorsRef.current);
      setGeneratingStatus(`Sincronizando... (tentativa ${consecutiveErrorsRef.current + 1})`);
      pollRef.current = setTimeout(
        () => pollStatus(pollId, attempt + 1, consecutiveErrorsRef.current),
        backoff,
      );
    }
  }

  async function refreshCredits() {
    try {
      const res = await api.credits.balance();
      updateCredits(res.balance);
    } catch { /* silent */ }
  }

  async function handleGenerate() {
    if (!canGenerate) return;

    setGenerating(true);
    setResults([]);
    setGenError(null);
    setGeneratingStatus("Enviando...");
    const currentPrompt = prompt.trim();
    setLastPrompt(currentPrompt);

    try {
      const res = await api.generate.image({
        prompt: currentPrompt,
        images: [referenceImage!],
        aspect_ratio: aspectRatio,
        resolution,
        seed: seed || "-1",
      });

      if (res.credits !== undefined) updateCredits(res.credits);

      if (res.status === "completed" && res.outputs?.length) {
        setResults(res.outputs);
        setGenerating(false);
        refreshGenerations().catch(() => {});
        return;
      }

      setGeneratingStatus("Gerando...");
      const pollId = String(res.job_id ?? res.prediction_id);
      pollRef.current = setTimeout(
        () => pollStatus(pollId, 0, 0),
        POLL_INTERVAL_MS,
      );
    } catch (err: unknown) {
      setGenerating(false);
      if (err instanceof ApiError && typeof err.data?.credits === "number") {
        updateCredits(err.data.credits);
      } else {
        await refreshCredits();
      }
      const msg = err instanceof Error ? err.message : "Erro ao iniciar geração";
      const status = err instanceof ApiError ? err.status : 0;
      if (status === 502 || status === 503) {
        setGenError("Serviço de imagem temporariamente indisponível. Tente novamente depois.");
      } else if (msg.toLowerCase().includes("insufficient") || msg.toLowerCase().includes("top up") || msg.toLowerCase().includes("provedor") || msg.toLowerCase().includes("saldo")) {
        setGenError("Serviço de imagem temporariamente indisponível: saldo do provedor insuficiente.");
      } else {
        setGenError(msg);
      }
    }
  }

  return (
    <DashboardLayout title={t("generateImage.title")} subtitle={t("generateImage.subtitle")}>
      <div className="flex flex-col xl:flex-row gap-6 h-full">

        {/* ── LEFT PANEL ─────────────────────────────────────────────────────── */}
        <div className="w-full xl:w-96 flex-shrink-0 flex flex-col gap-4">

          {/* Model badge */}
          <div className="bg-[#C0001A]/6 border border-[#C0001A]/20 px-4 py-3 flex items-center gap-3">
            <span className="text-[#C0001A] text-lg">✦</span>
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-[#C0001A] leading-none">Qwen Image 2.0 Pro</p>
              <p className="text-[11px] text-black/40 font-medium mt-0.5">WaveSpeed AI · image-to-image</p>
            </div>
          </div>


          <div className="bg-white border border-black/8 p-4">
            <p className="text-[11px] font-black uppercase tracking-widest text-black/40 mb-1">
              Qwen Image 2.0 Pro não usa Soul ID
            </p>
            <p className="text-[11px] text-black/25 font-medium">
              Para usar seu modelo treinado (Natty), vá em <a href="/dashboard/higgsfield" className="text-[#C0001A] font-black hover:underline">Soul 2.0</a>
            </p>
          </div>

          {/* Reference image — REQUIRED for Qwen */}
          <div className="bg-white border border-black/8 p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-black/40">{t("generateImage.referenceImage")}</p>
                <p className="text-[11px] text-[#C0001A] font-bold mt-0.5 uppercase tracking-wide">Obrigatória para Qwen</p>
              </div>
              {referenceImage && (
                <button onClick={() => setReferenceImage(null)} className="text-[11px] font-black uppercase tracking-widest text-black/30 hover:text-[#C0001A] transition-colors">
                  {t("generateImage.remove")}
                </button>
              )}
            </div>

            {referenceImage ? (
              <div className="relative group">
                <img src={referenceImage} alt="Ref" className="w-full object-contain bg-black/3 max-h-56" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                  <button onClick={() => setReferenceImage(null)} className="bg-white text-black px-4 py-2 text-xs font-black uppercase tracking-widest hover:bg-[#C0001A] hover:text-white transition-colors">
                    {t("generateImage.removeBtn")}
                  </button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => refInputRef.current?.click()}
                onDrop={(e) => { e.preventDefault(); const file = e.dataTransfer.files[0]; if (file) loadFile(file); }}
                onDragOver={(e) => e.preventDefault()}
                className="border-2 border-dashed border-[#C0001A]/30 hover:border-[#C0001A] transition-colors p-8 text-center cursor-pointer group"
              >
                <p className="text-2xl mb-2 opacity-40 group-hover:opacity-70 transition-opacity">🖼</p>
                <p className="text-xs font-black uppercase tracking-widest text-black/40 group-hover:text-black/60 transition-colors">{t("generateImage.dragOrClick")}</p>
                <p className="text-[11px] text-black/20 font-medium mt-1">{t("generateImage.imageTypes")}</p>
                <input ref={refInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) loadFile(file); }} />
              </div>
            )}
            <p className="text-[11px] text-black/25 font-medium mt-2">A IA edita sua imagem de referência com base no prompt</p>
          </div>

          {/* Prompt */}
          <div className="bg-white border border-black/8 p-5">
            <p className="text-xs font-black uppercase tracking-widest text-black/40 mb-3">{t("generateImage.prompt")}</p>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={t("generateImage.promptPlaceholder")}
              rows={4}
              maxLength={800}
              className="w-full border-2 border-black/10 focus:border-[#C0001A] outline-none px-4 py-3 text-sm font-medium text-black placeholder:text-black/25 resize-none transition-colors leading-relaxed"
            />
            <div className="flex justify-between mt-1.5">
              <span className="text-[11px] text-black/30 font-medium">{prompt.length}/800</span>
              {prompt.length < 3 && prompt.length > 0 && (
                <span className="text-[11px] text-[#C0001A] font-bold">{t("generateImage.minChars")}</span>
              )}
            </div>
          </div>

          {/* Aspect ratio */}
          <div className="bg-white border border-black/8 p-5">
            <p className="text-xs font-black uppercase tracking-widest text-black/40 mb-3">{t("generateImage.proportion")}</p>
            <div className="grid grid-cols-3 gap-2">
              {ASPECT_RATIOS.map((r) => (
                <button key={r.value} onClick={() => setAspectRatio(r.value)}
                  className={`min-h-[44px] text-xs font-black border-2 transition-colors ${aspectRatio === r.value ? "border-[#C0001A] bg-[#C0001A] text-white" : "border-black/8 text-black/40 hover:border-black/20 hover:text-black"}`}>
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {/* Resolution */}
          <div className="bg-white border border-black/8 p-5">
            <p className="text-xs font-black uppercase tracking-widest text-black/40 mb-3">{t("generateImage.resolution")}</p>
            <div className="flex gap-2">
              {RESOLUTIONS.map((r) => (
                <button key={r.value} onClick={() => setResolution(r.value)}
                  className={`flex-1 min-h-[52px] flex flex-col items-center justify-center border-2 transition-colors ${resolution === r.value ? "border-[#C0001A] bg-[#C0001A] text-white" : "border-black/8 text-black/40 hover:border-black/20 hover:text-black"}`}>
                  <span className="text-xs font-black leading-none">{r.label}</span>
                  <span className={`text-[10px] font-medium mt-0.5 ${resolution === r.value ? "text-white/60" : "text-black/25"}`}>{r.sub}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Seed */}
          <div className="bg-white border border-black/8 p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-black uppercase tracking-widest text-black/40">{t("generateImage.seed")}</p>
              <button onClick={() => setSeed(String(Math.floor(Math.random() * 2147483647)))} className="text-[11px] font-black uppercase tracking-widest text-black/30 hover:text-[#C0001A] transition-colors">
                {t("generateImage.randomSeed")}
              </button>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={seed}
                onChange={(e) => setSeed(e.target.value.replace(/[^0-9]/g, ""))}
                placeholder="Aleatório"
                className="flex-1 border-2 border-black/10 focus:border-[#C0001A] outline-none px-4 py-3 text-sm font-medium text-black placeholder:text-black/20 transition-colors"
              />
              {seed && (
                <button onClick={() => setSeed("")} className="px-4 border-2 border-black/10 text-black/30 hover:border-red-400 hover:text-red-400 transition-colors text-sm font-black">✕</button>
              )}
            </div>
            <p className="text-[11px] text-black/25 font-medium mt-2">{t("generateImage.seedHint")}</p>
          </div>

          {/* Generate button */}
          <button
            onClick={handleGenerate}
            disabled={!canGenerate || totalCost > state.credits}
            className="w-full bg-[#C0001A] text-white py-4 min-h-[52px] text-xs font-black uppercase tracking-widest hover:bg-[#a00015] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {generating ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {generatingStatus || "Gerando..."}
              </span>
            ) : (
              <span>Gerar por {totalCost} créditos</span>
            )}
          </button>

          {!referenceImage && !generating && (
            <p className="text-[11px] text-[#C0001A] font-bold text-center -mt-2 uppercase tracking-wide">
              Adicione uma imagem de referência para continuar
            </p>
          )}

          <p className="text-[11px] text-black/25 font-medium text-center -mt-2">
            {t("generateImage.availableCredits")} <span className="font-black text-black/40">{state.credits}</span>
          </p>
        </div>

        {/* ── RIGHT PANEL ────────────────────────────────────────────────────── */}
        <div className="flex-1 min-h-[400px]">

          {genError && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
              className="mb-4 bg-red-50 border border-red-200 px-5 py-4">
              <div className="flex items-start gap-2">
                <span className="text-red-400 text-sm flex-shrink-0 mt-0.5">⚠</span>
                <p className="text-xs text-red-700 font-medium flex-1">{genError}</p>
                <button onClick={() => setGenError(null)} className="text-red-300 hover:text-red-500 text-sm font-black flex-shrink-0">✕</button>
              </div>
              <button
                onClick={async () => {
                  setGenError(null);
                  try { const r = await api.credits.balance(); updateCredits(r.balance); } catch {}
                  window.location.reload();
                }}
                className="mt-2 ml-6 text-[11px] font-black uppercase tracking-widest text-[#C0001A] hover:underline"
              >
                Verificar Histórico
              </button>
            </motion.div>
          )}

          {!generating && results.length === 0 && !genError && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="h-full min-h-[400px] border-2 border-dashed border-black/10 flex flex-col items-center justify-center gap-5 p-8 text-center">
              <span className="text-6xl opacity-10">✦</span>
              <div>
                <p className="text-lg font-black uppercase tracking-tight text-black/25">{t("generateImage.idle")}</p>
                <p className="text-sm text-black/20 font-medium mt-1 max-w-sm">{t("generateImage.idleDesc")}</p>
              </div>
              <div className="text-[11px] text-black/20 font-medium border border-black/8 px-4 py-2">
                Qwen Image 2.0 Pro · Até 2K
              </div>
            </motion.div>
          )}

          {generating && (
            <div>
              <div className="flex items-center gap-3 mb-4 p-5 bg-white border border-black/8">
                <div className="w-5 h-5 border-2 border-[#C0001A]/30 border-t-[#C0001A] rounded-full animate-spin flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-black uppercase tracking-widest text-black">{generatingStatus || "Gerando..."}</p>
                  <p className="text-[11px] text-black/40 font-medium mt-0.5 italic truncate">"{lastPrompt}"</p>
                </div>
                <span className="text-[10px] font-black text-black/20 uppercase tracking-widest flex-shrink-0">Qwen 2.0 Pro</span>
              </div>
              <div className={`${aspectStyle(aspectRatio)} bg-black/5 animate-pulse w-full max-w-md rounded-sm`} />
            </div>
          )}

          {!generating && results.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-black">
                    {results.length} {results.length === 1 ? "imagem gerada" : "imagens geradas"}
                  </p>
                  <p className="text-[11px] text-black/40 font-medium mt-0.5 italic truncate max-w-xs">"{lastPrompt}"</p>
                </div>
                <button onClick={handleGenerate} disabled={!canGenerate || totalCost > state.credits}
                  className="bg-black text-white px-5 py-3 text-xs font-black uppercase tracking-widest hover:bg-[#C0001A] transition-colors disabled:opacity-30 min-h-[44px]">
                  {t("generateImage.generateAgain")}
                </button>
              </div>

              <div className={`grid gap-4 ${results.length === 1 ? "grid-cols-1 max-w-md" : "grid-cols-2"}`}>
                <AnimatePresence>
                  {results.map((url, i) => (
                    <motion.div key={url + i} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.1 }}
                      className={`${aspectStyle(aspectRatio)} relative group overflow-hidden bg-black/5 rounded-sm`}>
                      <img src={url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors flex items-end justify-center pb-4 opacity-0 group-hover:opacity-100">
                        <div className="flex gap-2">
                          <a href={url} target="_blank" rel="noreferrer" download className="bg-white text-black px-5 py-3 text-xs font-black uppercase tracking-widest hover:bg-[#C0001A] hover:text-white transition-colors min-h-[44px] flex items-center">
                            {t("generateImage.download")}
                          </a>
                          <button onClick={() => setResults(results.filter((_, idx) => idx !== i))}
                            className="bg-black/70 text-white px-4 py-3 text-xs font-black uppercase tracking-widest hover:bg-red-600 transition-colors min-h-[44px]">
                            ✕
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          )}

          {state.generations.filter(g => g.type === "image").length > 0 && (
            <div className="mt-8">
              <p className="text-[11px] font-black uppercase tracking-widest text-black/30 mb-3">{t("generateImage.recentGenerations")}</p>
              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                {state.generations.filter(g => g.type === "image").slice(0, 12).map((gen) => (
                  <a key={gen.id} href={gen.url} target="_blank" rel="noreferrer" download className="aspect-square bg-black/5 overflow-hidden relative group cursor-pointer block rounded-sm">
                    <img src={gen.url} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <span className="text-white text-sm font-black">↓</span>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
