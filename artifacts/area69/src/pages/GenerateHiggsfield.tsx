import React, { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useStore } from "@/lib/useStore";
import { useI18n } from "@/lib/I18nContext";
import { api } from "@/lib/api";
import type { Generation } from "@/lib/store";

const MAX_REF_FILE_BYTES = 10 * 1024 * 1024;
const COST_PER_IMAGE = 5;
const POLL_INTERVAL_MS = 2500;
const MAX_POLL_ATTEMPTS = 60;

export default function GenerateHiggsfield() {
  const { state, addGeneration, updateModel, updateCredits } = useStore();
  const { t } = useI18n();

  const trainedModels = state.models.filter(
    (m) => m.status === "ready" && m.soulId,
  );
  const [selectedModel, setSelectedModel] = useState<string>(
    trainedModels[0]?.id ?? "",
  );
  const [prompt, setPrompt] = useState("");
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const refInputRef = useRef<HTMLInputElement>(null);
  const [seed, setSeed] = useState<string>("");
  const [generating, setGenerating] = useState(false);
  const [generatingStatus, setGeneratingStatus] = useState<string>("");
  const [results, setResults] = useState<string[]>([]);
  const [lastPrompt, setLastPrompt] = useState("");
  const [genError, setGenError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedSoulId =
    trainedModels.find((m) => m.id === selectedModel)?.soulId ?? null;
  const canGenerate =
    prompt.trim().length >= 3 && selectedSoulId && !generating;

  function loadFile(file: File) {
    if (file.size > MAX_REF_FILE_BYTES) {
      alert("Imagem muito grande. Máximo: 10MB.");
      return;
    }
    if (referenceImages.length >= 6) {
      alert("Máximo de 6 imagens de referência.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const url = ev.target?.result as string;
      setReferenceImages((prev) => [...prev, url]);
    };
    reader.readAsDataURL(file);
  }

  function removeRefImage(index: number) {
    setReferenceImages((prev) => prev.filter((_, i) => i !== index));
  }

  function stopPolling() {
    if (pollRef.current) {
      clearTimeout(pollRef.current);
      pollRef.current = null;
    }
  }

  async function pollStatus(predictionId: string, attempt: number) {
    if (attempt >= MAX_POLL_ATTEMPTS) {
      stopPolling();
      setGenerating(false);
      setGenError("Tempo esgotado. A geração demorou mais que o esperado.");
      refreshCredits();
      return;
    }

    try {
      const res = await api.generate.higgsfieldStatus(predictionId);

      if (res.status === "completed" && res.outputs.length > 0) {
        stopPolling();
        setResults(res.outputs);
        setGenerating(false);
        setGenError(null);

        const model = state.models.find((m) => m.id === selectedModel);
        res.outputs.forEach((url) => {
          const gen: Generation = {
            id: crypto.randomUUID(),
            modelId: selectedModel || "",
            modelName: model?.name ?? "Higgsfield Soul 2.0",
            url,
            type: "image",
            prompt: lastPrompt,
            createdAt: Date.now(),
          };
          addGeneration(gen);
        });
        if (model && selectedModel) {
          updateModel(selectedModel, {
            imagesGenerated:
              (model.imagesGenerated ?? 0) + res.outputs.length,
          });
        }
      } else if (res.status === "failed") {
        stopPolling();
        setGenerating(false);
        setGenError(res.error ?? "A geração falhou. Seus créditos foram devolvidos.");
        refreshCredits();
      } else {
        const statusLabel = res.status === "processing" ? "Processando" : "Aguardando";
        setGeneratingStatus(`${statusLabel}...`);
        pollRef.current = setTimeout(
          () => pollStatus(predictionId, attempt + 1),
          POLL_INTERVAL_MS,
        );
      }
    } catch {
      pollRef.current = setTimeout(
        () => pollStatus(predictionId, attempt + 1),
        POLL_INTERVAL_MS,
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
    if (!canGenerate || !selectedSoulId) return;

    setGenerating(true);
    setResults([]);
    setGenError(null);
    setGeneratingStatus("Enviando...");
    const currentPrompt = prompt.trim();
    setLastPrompt(currentPrompt);

    try {
      const res = await api.generate.higgsfield({
        model_id: selectedModel,
        prompt: currentPrompt,
        images: referenceImages.length > 0 ? referenceImages : undefined,
        seed: seed || undefined,
      });

      setGeneratingStatus("Gerando...");
      pollRef.current = setTimeout(
        () => pollStatus(res.prediction_id, 0),
        POLL_INTERVAL_MS,
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao iniciar geração";
      setGenerating(false);
      setGenError(msg + " — seus créditos foram devolvidos.");
      refreshCredits();
    }
  }

  return (
    <DashboardLayout
      title="Soul 2.0 Character"
      subtitle="Geração por IA com seu modelo treinado"
    >
      <div className="flex flex-col xl:flex-row gap-6 h-full">
        {/* ── LEFT PANEL ─────────────────────────────────────────────────────── */}
        <div className="w-full xl:w-96 flex-shrink-0 flex flex-col gap-4">
          {/* Model badge */}
          <div className="bg-[#7C3AED]/6 border border-[#7C3AED]/20 px-4 py-2.5 flex items-center gap-2">
            <span className="text-[#7C3AED] text-sm">⚡</span>
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-[#7C3AED] leading-none">
                Soul 2.0 Character
              </p>
              <p className="text-[8px] text-black/40 font-medium mt-0.5">
                Higgsfield AI · Soul ID
                {selectedSoulId && (
                  <span className="ml-1 text-[#7C3AED]/60">
                    · {selectedSoulId.slice(0, 8)}...
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Model selector — REQUIRED */}
          <div className="bg-white border border-black/8 p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-black/40">
                  Modelo Treinado
                </p>
                <p className="text-[8px] text-[#7C3AED] font-bold mt-0.5 uppercase tracking-wide">
                  Obrigatório — usa seu Soul ID
                </p>
              </div>
            </div>
            {trainedModels.length === 0 ? (
              <div className="border border-dashed border-black/10 p-4 text-center">
                <p className="text-[9px] font-medium text-black/30 mb-2">
                  Nenhum modelo com Soul ID encontrado
                </p>
                <p className="text-[8px] text-black/20 font-medium">
                  Treine um modelo em Dashboard → Modelos para desbloquear
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {trainedModels.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setSelectedModel(m.id)}
                    className={`flex items-center gap-3 p-2.5 border-2 transition-colors text-left ${
                      selectedModel === m.id
                        ? "border-[#7C3AED] bg-[#7C3AED]/5"
                        : "border-black/8 hover:border-black/20"
                    }`}
                  >
                    <div className="w-9 h-9 bg-black/5 flex-shrink-0 overflow-hidden">
                      {m.cover ? (
                        <img
                          src={m.cover}
                          alt={m.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-black/20 text-lg">
                          ◈
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-black uppercase tracking-tight text-black leading-none truncate">
                        {m.name}
                      </p>
                      <p className="text-[8px] text-black/40 font-medium mt-0.5 truncate">
                        Soul: {m.soulId?.slice(0, 12)}... · {m.imagesGenerated}{" "}
                        imgs
                      </p>
                    </div>
                    {selectedModel === m.id && (
                      <span className="ml-auto text-[#7C3AED] text-sm font-black flex-shrink-0">
                        ✓
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Reference images — OPTIONAL */}
          <div className="bg-white border border-black/8 p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-black/40">
                  Imagens de Referência
                </p>
              </div>
              <span className="text-[8px] font-bold text-black/25 uppercase tracking-widest border border-black/10 px-1.5 py-0.5">
                Opcional
              </span>
            </div>

            {referenceImages.length > 0 && (
              <div className="flex gap-2 mb-3 flex-wrap">
                {referenceImages.map((url, i) => (
                  <div key={i} className="relative w-16 h-16 group">
                    <img
                      src={url}
                      alt={`Ref ${i + 1}`}
                      className="w-full h-full object-cover bg-black/3"
                    />
                    <button
                      onClick={() => removeRefImage(i)}
                      className="absolute -top-1 -right-1 w-4 h-4 bg-black text-white text-[8px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div
              onClick={() => refInputRef.current?.click()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files[0];
                if (file) loadFile(file);
              }}
              onDragOver={(e) => e.preventDefault()}
              className="border-2 border-dashed border-[#7C3AED]/30 hover:border-[#7C3AED] transition-colors p-4 text-center cursor-pointer group"
            >
              <p className="text-lg mb-1 opacity-40 group-hover:opacity-70 transition-opacity">
                🖼
              </p>
              <p className="text-[9px] font-black uppercase tracking-widest text-black/40 group-hover:text-black/60 transition-colors">
                Arraste ou clique
              </p>
              <p className="text-[8px] text-black/20 font-medium mt-1">
                PNG, JPG, WebP · máx 10MB cada · até 6
              </p>
              <input
                ref={refInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) loadFile(file);
                }}
              />
            </div>
            <p className="text-[8px] text-black/25 font-medium mt-2">
              A IA usa estas imagens como referência visual (opcional)
            </p>
          </div>

          {/* Prompt */}
          <div className="bg-white border border-black/8 p-4">
            <p className="text-[9px] font-black uppercase tracking-widest text-black/40 mb-3">
              Prompt
            </p>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Descreva a imagem que você quer gerar com seu modelo..."
              rows={4}
              maxLength={800}
              className="w-full border-2 border-black/10 focus:border-[#7C3AED] outline-none px-3 py-2.5 text-xs font-medium text-black placeholder:text-black/25 resize-none transition-colors leading-relaxed"
            />
            <div className="flex justify-between mt-1">
              <span className="text-[8px] text-black/30 font-medium">
                {prompt.length}/800
              </span>
              {prompt.length < 3 && prompt.length > 0 && (
                <span className="text-[8px] text-[#7C3AED] font-bold">
                  Mínimo 3 caracteres
                </span>
              )}
            </div>
          </div>

          {/* Seed */}
          <div className="bg-white border border-black/8 p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[9px] font-black uppercase tracking-widest text-black/40">
                Seed
              </p>
              <button
                onClick={() =>
                  setSeed(
                    String(Math.floor(Math.random() * 2147483647)),
                  )
                }
                className="text-[8px] font-black uppercase tracking-widest text-black/30 hover:text-[#7C3AED] transition-colors"
              >
                Aleatório
              </button>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={seed}
                onChange={(e) =>
                  setSeed(e.target.value.replace(/[^0-9]/g, ""))
                }
                placeholder="Aleatório"
                className="flex-1 border-2 border-black/10 focus:border-[#7C3AED] outline-none px-3 py-2.5 text-xs font-medium text-black placeholder:text-black/20 transition-colors"
              />
              {seed && (
                <button
                  onClick={() => setSeed("")}
                  className="px-3 border-2 border-black/10 text-black/30 hover:border-red-400 hover:text-red-400 transition-colors text-sm font-black"
                >
                  ✕
                </button>
              )}
            </div>
            <p className="text-[8px] text-black/25 font-medium mt-2">
              Mesmo seed + mesmo prompt = resultados consistentes
            </p>
          </div>

          {/* Generate button */}
          <button
            onClick={handleGenerate}
            disabled={
              !canGenerate || COST_PER_IMAGE > state.credits
            }
            className="w-full bg-[#7C3AED] text-white py-4 text-[11px] font-black uppercase tracking-widest hover:bg-[#6D28D9] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {generating ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {generatingStatus || "Gerando..."}
              </span>
            ) : (
              <span>Gerar por {COST_PER_IMAGE} créditos</span>
            )}
          </button>

          {!selectedSoulId && !generating && trainedModels.length > 0 && (
            <p className="text-[9px] text-[#7C3AED] font-bold text-center -mt-2 uppercase tracking-wide">
              Selecione um modelo com Soul ID para continuar
            </p>
          )}

          <p className="text-[9px] text-black/25 font-medium text-center -mt-2">
            Créditos disponíveis:{" "}
            <span className="font-black text-black/40">{state.credits}</span>
          </p>
        </div>

        {/* ── RIGHT PANEL ────────────────────────────────────────────────────── */}
        <div className="flex-1 min-h-[400px]">
          {genError && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 bg-red-50 border border-red-200 px-4 py-3 flex items-start gap-2"
            >
              <span className="text-red-400 text-sm flex-shrink-0 mt-0.5">
                ⚠
              </span>
              <p className="text-[10px] text-red-700 font-medium">{genError}</p>
              <button
                onClick={() => setGenError(null)}
                className="ml-auto text-red-300 hover:text-red-500 text-xs font-black flex-shrink-0"
              >
                ✕
              </button>
            </motion.div>
          )}

          {!generating && results.length === 0 && !genError && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="h-full min-h-[400px] border-2 border-dashed border-black/10 flex flex-col items-center justify-center gap-4 p-8 text-center"
            >
              <span className="text-5xl opacity-10">⚡</span>
              <div>
                <p className="text-sm font-black uppercase tracking-tight text-black/25">
                  Geração com Soul ID
                </p>
                <p className="text-xs text-black/20 font-medium mt-1 max-w-xs">
                  Selecione um modelo treinado, escreva um prompt e gere imagens
                  com a identidade visual do seu Soul ID
                </p>
              </div>
              <div className="text-[9px] text-black/20 font-medium border border-black/8 px-3 py-1.5">
                Higgsfield AI · Soul 2.0 Character
                {selectedSoulId && (
                  <span> · {selectedSoulId.slice(0, 8)}...</span>
                )}
              </div>
            </motion.div>
          )}

          {generating && (
            <div>
              <div className="flex items-center gap-3 mb-4 p-4 bg-white border border-black/8">
                <div className="w-4 h-4 border-2 border-[#7C3AED]/30 border-t-[#7C3AED] rounded-full animate-spin flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-black uppercase tracking-widest text-black">
                    {generatingStatus || "Gerando..."}
                  </p>
                  <p className="text-[9px] text-black/40 font-medium mt-0.5 italic truncate">
                    "{lastPrompt}"
                  </p>
                </div>
                <span className="text-[8px] font-black text-black/20 uppercase tracking-widest flex-shrink-0">
                  Soul 2.0
                </span>
              </div>
              <div className="aspect-square bg-black/5 animate-pulse w-full max-w-sm" />
            </div>
          )}

          {!generating && results.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-widest text-black">
                    {results.length}{" "}
                    {results.length === 1
                      ? "imagem gerada"
                      : "imagens geradas"}
                  </p>
                  <p className="text-[9px] text-black/40 font-medium mt-0.5 italic truncate max-w-xs">
                    "{lastPrompt}"
                  </p>
                </div>
                <button
                  onClick={handleGenerate}
                  disabled={
                    !canGenerate || COST_PER_IMAGE > state.credits
                  }
                  className="bg-black text-white px-4 py-2 text-[9px] font-black uppercase tracking-widest hover:bg-[#7C3AED] transition-colors disabled:opacity-30"
                >
                  Gerar Novamente
                </button>
              </div>

              <div
                className={`grid gap-3 ${
                  results.length === 1
                    ? "grid-cols-1 max-w-sm"
                    : "grid-cols-2"
                }`}
              >
                <AnimatePresence>
                  {results.map((url, i) => (
                    <motion.div
                      key={url + i}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.1 }}
                      className="aspect-square relative group overflow-hidden bg-black/5"
                    >
                      <img
                        src={url}
                        alt=""
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors flex items-end justify-center pb-4 opacity-0 group-hover:opacity-100">
                        <div className="flex gap-2">
                          <a
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            download
                            className="bg-white text-black px-4 py-2 text-[9px] font-black uppercase tracking-widest hover:bg-[#7C3AED] hover:text-white transition-colors"
                          >
                            Download
                          </a>
                          <button
                            onClick={() =>
                              setResults(
                                results.filter((_, idx) => idx !== i),
                              )
                            }
                            className="bg-black/70 text-white px-3 py-2 text-[9px] font-black uppercase tracking-widest hover:bg-red-600 transition-colors"
                          >
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

          {state.generations.filter((g) => g.type === "image").length >
            0 && (
            <div className="mt-8">
              <p className="text-[9px] font-black uppercase tracking-widest text-black/30 mb-3">
                Gerações Recentes
              </p>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                {state.generations
                  .filter((g) => g.type === "image")
                  .slice(0, 12)
                  .map((gen) => (
                    <a
                      key={gen.id}
                      href={gen.url}
                      target="_blank"
                      rel="noreferrer"
                      download
                      className="aspect-square bg-black/5 overflow-hidden relative group cursor-pointer block"
                    >
                      <img
                        src={gen.url}
                        alt=""
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                        <span className="text-white text-[10px] font-black">
                          ↓
                        </span>
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
