import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { isAuthenticated, clearAllData, type UserState, type Model, type Generation, type UserProfile } from "./store";
import { api, type ApiModel, type ApiGeneration } from "./api";
import { LANG_CHANGE_EVENT, LANG_KEY } from "./I18nContext";
import type { Lang } from "./i18n";

const MAX_GENERATIONS = 200;

const DEFAULT_STATE: UserState = {
  credits: 0,
  models: [],
  generations: [],
  profile: {
    name: "",
    email: "",
    avatar: null,
    language: "pt-BR",
    notifyGenerations: true,
    notifyPromotions: false,
  },
};

function normalizeLang(value: string | undefined): Lang {
  return value === "en" || value === "es" || value === "pt-BR" ? value : "pt-BR";
}

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
  refreshGenerations: () => Promise<void>;
  deleteGeneration: (id: string) => void;
  /** Fonte central de verdade: atualiza saldo com valor vindo do backend */
  updateCredits: (balance: number) => void;
  updateProfile: (patch: Partial<UserProfile>) => Promise<void>;
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
        const language = normalizeLang(userRes.user.language);
        localStorage.setItem(LANG_KEY, language);
        window.dispatchEvent(new CustomEvent(LANG_CHANGE_EVENT, { detail: language }));

        setState({
          profile: {
            name: userRes.user.name,
            email: userRes.user.email,
            avatar: userRes.user.avatar ?? null,
            language,
            notifyGenerations: userRes.user.notify_generations,
            notifyPromotions: userRes.user.notify_promotions,
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

  const refreshGenerations = useCallback(async () => {
    const res = await api.generations.list();
    setState((prev) => ({
      ...prev,
      generations: res.generations.map(mapGeneration),
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

  // Fluxo normal de geracao usa updateCredits(balance) com valor do backend.
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
  const updateProfile = useCallback(async (patch: Partial<UserProfile>) => {
    const apiPatch = {
      name: patch.name,
      email: patch.email,
      avatar: patch.avatar,
      language: patch.language,
      notify_generations: patch.notifyGenerations,
      notify_promotions: patch.notifyPromotions,
    };

    let previousProfile: UserProfile | null = null;
    setState((prev) => {
      previousProfile = prev.profile;
      return { ...prev, profile: { ...prev.profile, ...patch } };
    });

    try {
      const res = await api.user.update(apiPatch);
      const language = normalizeLang(res.user.language);
      localStorage.setItem(LANG_KEY, language);
      window.dispatchEvent(new CustomEvent(LANG_CHANGE_EVENT, { detail: language }));
      setState((prev) => ({
        ...prev,
        profile: {
          name: res.user.name,
          email: res.user.email,
          avatar: res.user.avatar ?? null,
          language,
          notifyGenerations: res.user.notify_generations,
          notifyPromotions: res.user.notify_promotions,
        },
      }));
    } catch (error) {
      if (previousProfile) {
        setState((prev) => ({ ...prev, profile: previousProfile! }));
      }
      throw error;
    }
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
        refreshGenerations,
        deleteGeneration,
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
