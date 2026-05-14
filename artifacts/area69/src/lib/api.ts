const API_BASE = "/api";
export const TOKEN_KEY = "area69_token";

export interface ApiUser {
  id: number;
  name: string;
  email: string;
  avatar: string | null;
  credits: number;
  images_generated: number;
  videos_generated: number;
}

export interface ApiModel {
  id: number;
  name: string;
  style: string;
  cover: string | null;
  status: string;
  description: string | null;
  images_generated: number;
  videos_generated: number;
  created_at: string;
  soul_id: string | null;
  higgsfield_request_id: string | null;
  training_images_count: number;
}

export interface ApiGeneration {
  id: number;
  model_name: string;
  type: "image" | "video";
  prompt: string;
  url: string;
  seed: string | null;
  width: number | null;
  height: number | null;
  created_at: string;
}

export class ApiError extends Error {
  status: number;
  data?: Record<string, unknown>;

  constructor(message: string, status: number, data?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.data = data;
    this.name = "ApiError";
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = sessionStorage.getItem(TOKEN_KEY);
  const res = await fetch(API_BASE + path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers ?? {}),
    },
  });

  if (res.status === 204) return undefined as T;

  const body = await res.json().catch(() => ({ error: "Request failed" }));

  if (!res.ok) {
    throw new ApiError(body.error ?? `HTTP ${res.status}`, res.status, body);
  }

  return body as T;
}

export const api = {
  auth: {
    register: (data: { name: string; email: string; password: string }) =>
      request<{ token: string; user: ApiUser }>("/auth/register", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    login: (data: { email: string; password: string }) =>
      request<{ token: string; user: ApiUser }>("/auth/login", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  },
  user: {
    me: () => request<{ user: ApiUser }>("/user/me"),
    update: (data: { name?: string; email?: string; avatar?: string | null }) =>
      request<{ user: ApiUser }>("/user/me", {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    changePassword: (data: { current_password: string; new_password: string }) =>
      request<{ message: string }>("/user/me/password", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  },
  models: {
    list: () => request<{ models: ApiModel[] }>("/avatar_models"),
    create: (data: {
      name: string;
      style?: string;
      description?: string | null;
    }) =>
      request<{ model: ApiModel }>("/avatar_models", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (
      id: string,
      data: {
        name?: string;
        description?: string | null;
        style?: string;
      },
    ) =>
      request<{ model: ApiModel }>(`/avatar_models/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      request<void>(`/avatar_models/${id}`, { method: "DELETE" }),
  },
  generations: {
    list: () => request<{ generations: ApiGeneration[] }>("/generations"),
    delete: (id: string) =>
      request<void>(`/generations/${id}`, { method: "DELETE" }),
  },
  credits: {
    balance: () => request<{ balance: number }>("/credits"),
  },
  generate: {
    image: (data: {
      prompt: string;
      images: string[];
      aspect_ratio?: string;
      resolution?: string;
      seed?: string;
    }) =>
      request<{ prediction_id: string; status: string; job_id?: number; credits?: number; outputs?: string[] }>("/generate/image", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    imageStatus: (id: string) =>
      request<{ status: string; outputs: string[]; error?: string; credits?: number }>(
        `/generate/image/${id}`,
      ),
    video: (data: {
      prompt: string;
      image: string;
      aspect_ratio?: string;
      duration?: number;
      resolution?: string;
      generate_audio?: boolean;
      camera_fixed?: boolean;
      seed?: string;
    }) =>
      request<{ prediction_id: string; status: string; job_id?: number; credits?: number; outputs?: string[] }>("/generate/video", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    videoStatus: (id: string) =>
      request<{ status: string; outputs: string[]; error?: string; credits?: number }>(
        `/generate/video/${id}`,
      ),
    higgsfield: (data: {
      model_id: string;
      prompt: string;
      images?: string[];
      seed?: string;
      aspect_ratio?: string;
      resolution?: string;
      character_strength?: number;
      result_images?: number;
      enhance_prompt?: boolean;
    }) =>
      request<{ prediction_id: string; status: string; job_id?: number; credits?: number }>(
        "/generate/character",
        { method: "POST", body: JSON.stringify(data) },
      ),
    higgsfieldStatus: (id: string) =>
      request<{ status: string; outputs: string[]; error?: string; credits?: number }>(
        `/generate/character/${id}/status`,
      ),
  },
  training: {
    startSoulId: (data: { name: string; images: string[] }) =>
      request<{ model: ApiModel; credits: number }>("/training/character", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    status: (id: string | number) =>
      request<{ model: ApiModel; credits?: number }>(`/training/${id}/status`),
  },
  checkout: {
    stripe: (data: { credits: number }) =>
      request<{ url: string }>("/checkout/stripe", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    confirmStripe: (data: { session_id: string }) =>
      request<{
        status: string;
        credits_added: number;
        balance: number;
        duplicate?: boolean;
        payment_status?: string;
      }>("/checkout/stripe/confirm", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  },
  pricing: () =>
    request<{
      qwen_image: number;
      seedance_video: number;
      higgsfield_character: number;
      higgsfield_training: number;
      credit_packs: number[];
    }>("/pricing"),
  health: {
    check: () => request<{ status: string }>("/healthz"),
  },
};
