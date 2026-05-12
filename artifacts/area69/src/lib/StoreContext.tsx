import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { isAuthenticated, clearAllData, type UserState, type Model, type Generation, type UserProfile } from "./store";
import { api, type ApiModel, type ApiGeneration } from "./api";

const MAX_GENERATIONS = 200;

const DEFAULT_STATE: UserState = {
  credits: 0,
  models: [],
  generations: [],
  profile: { name: "", email: "", avatar: null },
};

function mapModel(raw: ApiModel): Model {
  return {
    id: String(raw.id),
    name: raw.name,
    cover: raw.cover && raw.cover.length > 0 ? raw.cover : null,
    imagesGenerated: raw.images_generated ?? 0,
    videosGenerated: raw.videos_generated ?? 0,
    status: (raw.status as ModelStatus) ?? "ready",
    progress: raw.status === "ready" ? 100 : 0,
    createdAt: raw.created_at ? new Date(raw.created_at).getTime() : Date.now(),
    soulId: raw.soul_id ?? null,
  };
}

type ModelStatus = "training" | "ready" | "failed";

function mapGeneration(raw: ApiGeneration): Generation {
  return {
    id: String(raw.id),
    modelId: "",
    modelName: raw.model_name ?? "",
    url: raw.url ?? "",
    type: raw.type ?? "image",
    prompt: raw.prompt ?? "",
    createdAt: raw.created_at ? new Date(raw.created_at).getTime() : Date.now(),
  };
}

interface StoreContextValue {
  state: UserState;
  loading: boolean;
  addModel: (model: Model) => void;
  addModelDirect: (model: Model) => void;
  updateModel: (id: string, patch: Partial<Model>) => void;
  deleteModel: (id: string) => void;
  addGeneration: (gen: Generation) => void;
  deleteGeneration: (id: string) => void;
  /** APENAS DEV/ADMIN. NAO usar em fluxo normal de geracao.
   * Faz POST /api/credits/add (requer CREDITS_SECRET no backend).
   * Prefira updateCredits(balance) vindo da resposta do backend. */
  devAddCreditsUnsafe: (amount: number) => void;
  /** Fonte central de verdade: atualiza saldo com valor vindo do backend */
  updateCredits: (balance: number) => void;
  updateProfile: (patch: Partial<UserProfile>) => void;
  resetAccount: () => void;
}

const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<UserState>(DEFAULT_STATE);
  const [loading, setLoading] = useState(isAuthenticated());

  // ── Fetch initial state from API on mount ─────────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated()) return;

    Promise.all([
      api.user.me(),
      api.models.list(),
      api.generations.list(),
      api.credits.balance(),
    ])
      .then(([userRes, modelsRes, gensRes, creditsRes]) => {
        setState({
          profile: {
            name: userRes.user.name,
            email: userRes.user.email,
            avatar: userRes.user.avatar ?? null,
          },
          models: modelsRes.models.map(mapModel),
          generations: gensRes.generations.map(mapGeneration),
          credits: creditsRes.balance,
        });
      })
      .catch((err) => {
        console.error("Failed to load user data:", err);
        if (err?.status === 401) {
          clearAllData();
          window.location.href = "/sign-in";
        }
      })
      .finally(() => setLoading(false));
  }, []);

  // ── Model mutations ───────────────────────────────────────────────────────────
  const addModel = useCallback((model: Model) => {
    setState((prev) => ({ ...prev, models: [model, ...prev.models] }));

    api.models
      .create({ name: model.name, style: "realistic" })
      .then((res) => {
        const realModel = mapModel(res.model);
        setState((prev) => ({
          ...prev,
          models: prev.models.map((m) =>
            m.id === model.id
              ? { ...realModel, status: m.status, progress: m.progress }
              : m,
          ),
        }));
      })
      .catch(console.error);
  }, []);

  const addModelDirect = useCallback((model: Model) => {
    setState((prev) => ({ ...prev, models: [model, ...prev.models] }));
  }, []);

  const updateModel = useCallback((id: string, patch: Partial<Model>) => {
    setState((prev) => ({
      ...prev,
      models: prev.models.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    }));
    // Apenas name é enviado ao backend — status, soulId, contadores são
    // gerenciados exclusivamente pelo backend (treino/process_completed)
    if (!isNaN(Number(id)) && patch.name !== undefined) {
      api.models.update(id, { name: patch.name }).catch(console.error);
    }
  }, []);

  const deleteModel = useCallback((id: string) => {
    setState((prev) => ({ ...prev, models: prev.models.filter((m) => m.id !== id) }));
    if (!isNaN(Number(id))) {
      api.models.delete(id).catch(console.error);
    }
  }, []);

  // ── Generation mutations ──────────────────────────────────────────────────────
  const addGeneration = useCallback((gen: Generation) => {
    setState((prev) => ({
      ...prev,
      generations: [gen, ...prev.generations].slice(0, MAX_GENERATIONS),
    }));
  }, []);

  const deleteGeneration = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      generations: prev.generations.filter((g) => g.id !== id),
    }));
    if (!isNaN(Number(id))) {
      api.generations.delete(id).catch(console.error);
    }
  }, []);

  // ── Credits mutations (APENAS DEV/ADMIN) ────────────────────────────────
  // Fluxo normal de geracao usa updateCredits(balance) com valor do backend
  const devAddCreditsUnsafe = useCallback((amount: number) => {
    if (!(import.meta.env.DEV && import.meta.env.VITE_ENABLE_DEV_CREDITS === "true")) {
      console.warn("[StoreContext] devAddCreditsUnsafe blocked outside DEV mode");
      return;
    }
    const safeAmount = Math.max(0, Math.floor(amount));
    api.credits
      .add(safeAmount)
      .then((res) => setState((prev) => ({ ...prev, credits: res.balance })))
      .catch(console.error);
  }, []);

  const updateCredits = useCallback((balance: number) => {
    if (typeof balance === "number" && !isNaN(balance)) {
      setState((prev) => ({ ...prev, credits: balance }));
    }
  }, []);

  async function refreshBalance() {
    try {
      const res = await api.credits.balance();
      updateCredits(res.balance);
    } catch { /* silent */ }
  }

  // ── Profile mutations ─────────────────────────────────────────────────────────
  const updateProfile = useCallback((patch: Partial<UserProfile>) => {
    setState((prev) => ({ ...prev, profile: { ...prev.profile, ...patch } }));
    api.user
      .update({ name: patch.name, email: patch.email, avatar: patch.avatar })
      .then((res) =>
        setState((prev) => ({
          ...prev,
          profile: {
            name: res.user.name,
            email: res.user.email,
            avatar: res.user.avatar ?? null,
          },
        })),
      )
      .catch(console.error);
  }, []);

  const resetAccount = useCallback(() => {
    clearAllData();
    window.location.href = "/";
  }, []);

  return (
    <StoreContext.Provider
      value={{
        state,
        loading,
        addModel,
        addModelDirect,
        updateModel,
        deleteModel,
        addGeneration,
        deleteGeneration,
        devAddCreditsUnsafe,
        updateCredits,
        updateProfile,
        resetAccount,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside <StoreProvider>");
  return ctx;
}
