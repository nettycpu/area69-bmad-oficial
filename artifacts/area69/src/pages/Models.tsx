import React, { useState, useRef, useEffect, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useStore } from "@/lib/useStore";
import { useI18n } from "@/lib/I18nContext";
import { api, ApiError } from "@/lib/api";
import type { Model } from "@/lib/store";

const POLL_INTERVAL_MS = 8000;
const TRAINING_COST = 150;

function ModelCard({ model, onDelete, onStatusUpdate }: {
  model: Model;
  onDelete: () => void;
  onStatusUpdate: (id: string, status: string, soulId?: string, credits?: number) => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const { t, lang } = useI18n();

  // Poll backend status for training models that have a real backend ID
  useEffect(() => {
    if (model.status !== "training") return;
    const numericId = Number(model.id);
    if (isNaN(numericId) || numericId <= 0) return;

    const interval = setInterval(async () => {
      try {
        const res = await api.training.status(numericId);
        if (res.model.status !== "training") {
          onStatusUpdate(model.id, res.model.status, res.model.soul_id ?? undefined, res.credits);
          clearInterval(interval);
        }
      } catch {
        // ignore poll errors
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [model.id, model.status, onStatusUpdate]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="bg-white border border-black/8 overflow-hidden group hover:border-[#C0001A] transition-colors"
    >
      <div className="aspect-[3/4] bg-black/5 relative overflow-hidden">
        {model.cover ? (
          <img src={model.cover} alt={model.name} className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2">
            <span className="text-4xl opacity-10">◈</span>
          </div>
        )}

        <div className="absolute top-2 left-2">
          {model.status === "ready" && (
            <span className="bg-white text-black text-[11px] font-black uppercase tracking-widest px-2 py-0.5 shadow-sm">{t("models.status.ready")}</span>
          )}
          {model.status === "training" && (
            <span className="bg-[#C0001A] text-white text-[11px] font-black uppercase tracking-widest px-2 py-0.5">{t("models.status.training")}</span>
          )}
          {model.status === "failed" && (
            <span className="bg-black text-white text-[11px] font-black uppercase tracking-widest px-2 py-0.5">{t("models.status.failed")}</span>
          )}
        </div>

        {model.status === "training" && (
          <>
            {model.cover && (
              <img src={model.cover} alt={model.name} className="absolute inset-0 w-full h-full object-cover object-top opacity-30" />
            )}
            <div className="absolute inset-0 bg-black/75 flex flex-col items-center justify-center gap-3 p-4">
              <div className="w-10 h-10 border-4 border-white/20 border-t-white rounded-full animate-spin" />
              <p className="text-white text-xs font-black uppercase tracking-widest">{t("models.status.inTraining")}</p>
              <p className="text-white/50 text-[11px] font-medium text-center">Treinamento AREA69</p>
              <div className="w-full h-1 bg-white/20 rounded-full overflow-hidden">
                <div className="h-full bg-[#C0001A] animate-pulse w-2/3" />
              </div>
              <p className="text-white/40 text-[11px] font-medium">~20 min</p>
            </div>
          </>
        )}

        {model.status === "failed" && (
          <div className="absolute inset-0 bg-black/75 flex flex-col items-center justify-center gap-2 p-4">
            <span className="text-3xl">✕</span>
            <p className="text-white text-xs font-black uppercase tracking-widest">{t("models.status.failed")}</p>
            <p className="text-white/50 text-[11px] font-medium text-center">Créditos reembolsados</p>
          </div>
        )}
      </div>

      <div className="p-4">
        <p className="text-sm font-black uppercase tracking-tight text-black leading-tight">{model.name}</p>
        {model.soulId && (
          <p className="text-[11px] text-[#C0001A] font-bold mt-0.5 truncate" title={model.soulId}>
            Character ID: {model.soulId.slice(0, 20)}…
          </p>
        )}
        <div className="flex gap-3 mt-1">
          <p className="text-xs text-black/40 font-medium">{model.imagesGenerated} {t("models.imagesCount")}</p>
          <p className="text-xs text-black/40 font-medium">{model.videosGenerated} {t("models.videosCount")}</p>
        </div>
        <p className="text-[11px] text-black/30 font-medium mt-0.5">
          {t("models.createdAt")} {new Date(model.createdAt).toLocaleDateString(lang)}
        </p>

        <div className="flex gap-2 mt-3">
          {model.status === "ready" && (
            <Link href={`/dashboard/higgsfield?model=${model.id}`}
              className="flex-1 bg-[#C0001A] text-white py-3 text-xs font-black uppercase tracking-widest hover:bg-[#a00015] transition-colors text-center min-h-[44px] flex items-center justify-center">
              {t("models.useModel")}
            </Link>
          )}
          {!confirm ? (
            <button onClick={() => setConfirm(true)}
              className="px-4 py-3 border border-black/10 text-xs font-black uppercase tracking-widest text-black/40 hover:border-red-500 hover:text-red-500 transition-colors min-h-[44px]">
              ✕
            </button>
          ) : (
            <div className="flex gap-1 flex-1">
              <button onClick={onDelete}
                className="flex-1 bg-red-500 text-white py-3 text-xs font-black uppercase tracking-widest hover:bg-red-600 transition-colors min-h-[44px]">
                {t("models.confirm")}
              </button>
              <button onClick={() => setConfirm(false)}
                className="px-4 py-3 border border-black/10 text-xs font-black uppercase tracking-widest text-black/40 hover:bg-black/5 transition-colors min-h-[44px]">
                {t("models.cancelDelete")}
              </button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

type Step = "name" | "upload" | "confirm";

function NewModelModal({ onClose, onCreated, availableCredits, trainingCost, onCreditsSync }: {
  onClose: () => void;
  onCreated: (model: Model, newCredits: number) => void;
  availableCredits: number;
  trainingCost: number;
  onCreditsSync: (credits: number) => void;
}) {
  const [step, setStep] = useState<Step>("name");
  const [name, setName] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { t } = useI18n();

  const MAX_FILE_BYTES = 10 * 1024 * 1024;
  const MIN_PHOTOS = 10;
  const MAX_PHOTOS = 30;

  const handleFiles = (incoming: FileList | null) => {
    if (!incoming || incoming.length === 0) return;
    const valid = Array.from(incoming).filter(
      (f) => f.size <= MAX_FILE_BYTES && f.type.startsWith("image/")
    );

    setFiles((prev) => {
      const merged = [...prev, ...valid].slice(0, MAX_PHOTOS);
      // Generate previews for new files
      merged.forEach((f, i) => {
        if (i >= prev.length) {
          const reader = new FileReader();
          reader.onload = (e) => {
            if (e.target?.result) {
              setPreviews((p) => {
                const next = [...p];
                next[i] = e.target!.result as string;
                return next.slice(0, MAX_PHOTOS);
              });
            }
          };
          reader.readAsDataURL(f);
        }
      });
      return merged;
    });
  };

  const removeFile = (idx: number) => {
    setFiles((p) => p.filter((_, i) => i !== idx));
    setPreviews((p) => p.filter((_, i) => i !== idx));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  };

  const handleCreate = async () => {
    if (availableCredits < trainingCost) {
      setError(`Créditos insuficientes — você tem ${availableCredits} créditos`);
      return;
    }
    if (files.length < MIN_PHOTOS) {
      setError(`Envie pelo menos ${MIN_PHOTOS} fotos`);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Convert all files to base64 data URLs
      const imageDataUrls = await Promise.all(
        files.map(
          (f) =>
            new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = (e) => resolve(e.target!.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(f);
            })
        )
      );

      const res = await api.training.startSoulId({
        name: name.trim(),
        images: imageDataUrls,
      });

      const model: Model = {
        id: String(res.model.id),
        name: res.model.name,
        cover: res.model.cover,
        imagesGenerated: 0,
        videosGenerated: 0,
        status: "training",
        progress: 0,
        createdAt: new Date(res.model.created_at).getTime(),
        soulId: res.model.soul_id ?? null,
      };

      onCreated(model, res.credits);
      onClose();
    } catch (err) {
      if (err instanceof ApiError && typeof err.data?.credits === "number") {
        onCreditsSync(err.data.credits);
      }
      setError(err instanceof Error ? err.message : "Erro ao iniciar treinamento. Tente novamente.");
      setLoading(false);
    }
  };

  const steps: Step[] = ["name", "upload", "confirm"];
  const stepIndex = steps.indexOf(step);
  const hasEnoughCredits = availableCredits >= trainingCost;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        className="bg-white w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col"
      >
        <div className="px-6 py-5 border-b border-black/8 flex items-center justify-between flex-shrink-0">
          <div>
            <p className="text-sm font-black uppercase tracking-tight text-black">{t("models.modal.title")}</p>
            <p className="text-[10px] text-black/40 font-medium mt-0.5">
              {t("models.modal.step", { n: stepIndex + 1 })}
              <span className="ml-2 text-[#C0001A]">Treinamento AREA69</span>
            </p>
          </div>
          <button onClick={onClose} disabled={loading} className="text-black/30 hover:text-black transition-colors text-lg leading-none disabled:opacity-30">✕</button>
        </div>

        <div className="h-1 bg-black/5 flex-shrink-0">
          <div className="h-full bg-[#C0001A] transition-all duration-500" style={{ width: `${((stepIndex + 1) / 3) * 100}%` }} />
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          <AnimatePresence mode="wait">
            {step === "name" && (
              <motion.div key="name" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <p className="text-[10px] font-black uppercase tracking-widest text-black/40 mb-1">{t("models.modal.step1Label")}</p>
                <h2 className="text-xl font-black uppercase tracking-tighter text-black mb-4">{t("models.modal.step1Title")}</h2>
                <p className="text-xs text-black/50 font-medium mb-5">{t("models.modal.step1Desc")}</p>

                {!hasEnoughCredits && (
                  <div className="bg-red-50 border border-red-200 px-4 py-3 mb-4">
                    <p className="text-xs font-bold text-red-600">Créditos insuficientes</p>
                    <p className="text-[11px] text-red-500 mt-0.5">Você tem {availableCredits} créditos. O treinamento custa {trainingCost} créditos.</p>
                    <Link href="/dashboard/billing" className="text-[11px] font-black text-[#C0001A] uppercase tracking-widest mt-2 block hover:underline">
                      → Comprar créditos
                    </Link>
                  </div>
                )}

                <input
                  type="text" value={name} onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && name.trim().length >= 2 && hasEnoughCredits && setStep("upload")}
                  placeholder={t("models.modal.step1Placeholder")} autoFocus
                  className="w-full border-2 border-black/10 focus:border-[#C0001A] outline-none px-4 py-3 text-sm font-medium text-black placeholder:text-black/25 transition-colors"
                />
                <button onClick={() => setStep("upload")} disabled={name.trim().length < 2 || !hasEnoughCredits}
                  className="w-full mt-4 bg-[#C0001A] text-white py-3.5 text-[10px] font-black uppercase tracking-widest hover:bg-[#a00015] transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                  {t("models.modal.step1Next")}
                </button>
              </motion.div>
            )}

            {step === "upload" && (
              <motion.div key="upload" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <p className="text-[10px] font-black uppercase tracking-widest text-black/40 mb-1">{t("models.modal.step2Label")}</p>
                <h2 className="text-xl font-black uppercase tracking-tighter text-black mb-1">{t("models.modal.step2Title")}</h2>
                <p className="text-xs text-black/50 font-medium mb-5">{t("models.modal.step2Desc")}</p>

                <div onDrop={handleDrop} onDragOver={(e) => e.preventDefault()} onClick={() => fileRef.current?.click()}
                  className="border-2 border-dashed border-black/15 hover:border-[#C0001A] transition-colors p-8 text-center cursor-pointer mb-4">
                  <p className="text-2xl mb-2">📁</p>
                  <p className="text-xs font-black uppercase tracking-widest text-black/40">{t("models.modal.step2Drag")}</p>
                  <p className="text-[10px] text-black/25 font-medium mt-1">JPG, PNG, WEBP · máx {MAX_PHOTOS} fotos · máx 10MB por foto</p>
                  <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
                </div>

                {previews.filter(Boolean).length > 0 && (
                  <div className="grid grid-cols-5 gap-1.5 mb-4 max-h-48 overflow-y-auto">
                    {previews.map((src, i) =>
                      src ? (
                        <div key={i} className="aspect-square bg-black/5 relative overflow-hidden">
                          <img src={src} alt="" className="w-full h-full object-cover" />
                          <button onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                            className="absolute top-0.5 right-0.5 w-4 h-4 bg-black/70 text-white text-[8px] flex items-center justify-center hover:bg-red-500 transition-colors">
                            ✕
                          </button>
                        </div>
                      ) : null
                    )}
                  </div>
                )}

                <div className="mb-4">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[10px] font-bold text-black/50">
                      {files.length} foto{files.length !== 1 ? "s" : ""} selecionada{files.length !== 1 ? "s" : ""}
                    </p>
                    <p className={`text-[10px] font-bold ${files.length >= MIN_PHOTOS ? "text-green-600" : "text-[#C0001A]"}`}>
                      {files.length < MIN_PHOTOS ? `Mínimo: ${MIN_PHOTOS}` : "✓ Pronto"}
                    </p>
                  </div>
                  <div className="h-1.5 bg-black/5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${files.length >= MIN_PHOTOS ? "bg-green-500" : "bg-[#C0001A]"}`}
                      style={{ width: `${Math.min(100, (files.length / MIN_PHOTOS) * 100)}%` }}
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <button onClick={() => setStep("name")}
                    className="px-4 py-3 border-2 border-black/10 text-[10px] font-black uppercase tracking-widest text-black/40 hover:bg-black/5 transition-colors">
                    {t("models.modal.step2Back")}
                  </button>
                  <button onClick={() => setStep("confirm")} disabled={files.length < MIN_PHOTOS}
                    className="flex-1 bg-[#C0001A] text-white py-3 text-[10px] font-black uppercase tracking-widest hover:bg-[#a00015] transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                    {t("models.modal.step2Next")}
                  </button>
                </div>
              </motion.div>
            )}

            {step === "confirm" && (
              <motion.div key="confirm" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <p className="text-[10px] font-black uppercase tracking-widest text-black/40 mb-1">{t("models.modal.step3Label")}</p>
                <h2 className="text-xl font-black uppercase tracking-tighter text-black mb-4">{t("models.modal.step3Title")}</h2>

                {/* AREA69 training badge */}
                <div className="bg-black text-white px-4 py-2.5 mb-5 flex items-center gap-3">
                  <div className="w-5 h-5 flex-shrink-0">
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-[#C0001A]">
                      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                    </svg>
                  </div>
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-white/60">Tecnologia AREA69</p>
                    <p className="text-[11px] font-black uppercase tracking-widest">AREA69 Character ID</p>
                  </div>
                </div>

                <div className="bg-black/3 border border-black/8 p-4 mb-5 space-y-3">
                  <div className="flex justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest text-black/40">{t("models.modal.nameLabel")}</span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-black">{name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest text-black/40">{t("models.modal.photosLabel")}</span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-black">{files.length} fotos</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest text-black/40">{t("models.modal.costLabel")}</span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-[#C0001A]">{trainingCost} créditos</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest text-black/40">Saldo após</span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-black">{availableCredits - trainingCost} créditos</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest text-black/40">{t("models.modal.timeLabel")}</span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-black">~20 minutos</span>
                  </div>
                </div>

                {previews.filter(Boolean).length > 0 && (
                  <div className="flex gap-1 mb-5 overflow-hidden">
                    {previews.filter(Boolean).slice(0, 6).map((src, i) => (
                      <div key={i} className="w-12 h-12 flex-shrink-0 bg-black/5 overflow-hidden">
                        <img src={src} alt="" className="w-full h-full object-cover" />
                      </div>
                    ))}
                    {files.length > 6 && (
                      <div className="w-12 h-12 flex-shrink-0 bg-black/10 flex items-center justify-center">
                        <span className="text-[10px] font-black text-black/40">+{files.length - 6}</span>
                      </div>
                    )}
                  </div>
                )}

                {error && (
                  <div className="bg-red-50 border border-red-200 px-4 py-3 mb-4">
                    <p className="text-xs font-bold text-red-600">{error}</p>
                  </div>
                )}

                <div className="flex gap-2">
                  <button onClick={() => setStep("upload")} disabled={loading}
                    className="px-4 py-3 border-2 border-black/10 text-[10px] font-black uppercase tracking-widest text-black/40 hover:bg-black/5 transition-colors disabled:opacity-30">
                    {t("models.modal.back")}
                  </button>
                  <button onClick={handleCreate} disabled={loading}
                    className="flex-1 bg-[#C0001A] text-white py-3 text-[10px] font-black uppercase tracking-widest hover:bg-[#a00015] transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                    {loading && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                    {loading ? "Enviando fotos..." : t("models.modal.startTraining")}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}

export default function Models() {
  const [showModal, setShowModal] = useState(false);
  const [filter, setFilter] = useState<"all" | "ready" | "training">("all");
  const [trainingCost, setTrainingCost] = useState(TRAINING_COST);
  const { state, deleteModel, updateModel, addModelDirect, updateCredits } = useStore();
  const { t } = useI18n();
  const [, setLocation] = useLocation();

  useEffect(() => {
    api.pricing()
      .then((pricing) => setTrainingCost(pricing.higgsfield_training))
      .catch(() => {});
  }, []);

  const filtered = state.models.filter((m) => {
    if (filter === "all") return true;
    return m.status === filter;
  });

  const handleCreated = useCallback((model: Model, newCredits: number) => {
    addModelDirect(model);
    updateCredits(newCredits);
    setLocation("/dashboard/models");
  }, [addModelDirect, updateCredits, setLocation]);

  const handleStatusUpdate = useCallback((id: string, status: string, soulId?: string, credits?: number) => {
    updateModel(id, { status: status as "training" | "ready" | "failed", soulId: soulId ?? null });
    if (typeof credits === "number") updateCredits(credits);
  }, [updateModel, updateCredits]);

  const readyCount = state.models.filter(m => m.status === "ready").length;
  const subtitle = state.models.length === 1
    ? t("models.subtitleOne", { n: state.models.length, r: readyCount })
    : t("models.subtitleMany", { n: state.models.length, r: readyCount });

  return (
    <DashboardLayout title={t("models.title")} subtitle={subtitle}>
      <AnimatePresence>
        {showModal && (
          <NewModelModal
            onClose={() => setShowModal(false)}
            onCreated={handleCreated}
            availableCredits={state.credits}
            trainingCost={trainingCost}
            onCreditsSync={updateCredits}
          />
        )}
      </AnimatePresence>

      <div className="flex items-center justify-between mb-6">
        <div className="flex gap-1">
          {(["all", "ready", "training"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-4 min-h-[44px] text-xs font-black uppercase tracking-widest transition-colors ${
                filter === f ? "bg-black text-white" : "bg-white border border-black/10 text-black/40 hover:text-black"
              }`}>
              {f === "all" ? t("models.filterAll") : f === "ready" ? t("models.filterReady") : t("models.filterTraining")}
              <span className="ml-1.5 opacity-60">
                ({f === "all" ? state.models.length : state.models.filter(m => m.status === f).length})
              </span>
            </button>
          ))}
        </div>
        <button onClick={() => setShowModal(true)}
          className="bg-[#C0001A] text-white px-5 min-h-[44px] text-xs font-black uppercase tracking-widest hover:bg-[#a00015] transition-colors">
          {t("models.newModel")}
        </button>
      </div>

      {state.models.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-24 text-center">
          <span className="text-6xl mb-6 opacity-10">◈</span>
          <p className="text-lg font-black uppercase tracking-tighter text-black/30">{t("models.empty")}</p>
          <p className="text-sm text-black/25 font-medium mt-2 max-w-sm">{t("models.emptyDesc")}</p>
          <button onClick={() => setShowModal(true)}
            className="mt-8 bg-[#C0001A] text-white px-8 py-4 text-xs font-black uppercase tracking-widest hover:bg-[#a00015] transition-colors">
            {t("models.emptyCta")}
          </button>
        </motion.div>
      ) : filtered.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-sm font-black uppercase tracking-tighter text-black/30">{t("models.empty")}</p>
        </motion.div>
      ) : (
        <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence>
            {filtered.map((model) => (
              <ModelCard
                key={model.id}
                model={model}
                onDelete={() => deleteModel(model.id)}
                onStatusUpdate={handleStatusUpdate}
              />
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </DashboardLayout>
  );
}
