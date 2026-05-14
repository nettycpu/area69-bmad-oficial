export type ModelStatus = "training" | "ready" | "failed";

export interface Model {
  id: string;
  name: string;
  cover: string | null;
  imagesGenerated: number;
  videosGenerated: number;
  status: ModelStatus;
  progress: number;
  createdAt: number;
  soulId: string | null;
}

export interface Generation {
  id: string;
  modelId: string;
  modelName: string;
  url: string;
  type: "image" | "video";
  prompt: string;
  createdAt: number;
}

export interface UserProfile {
  name: string;
  email: string;
  avatar: string | null;
  language: "pt-BR" | "en" | "es";
  notifyGenerations: boolean;
  notifyPromotions: boolean;
}

export interface UserState {
  credits: number;
  models: Model[];
  generations: Generation[];
  profile: UserProfile;
}

const TOKEN_KEY = "area69_token";
const ALLOWED_URL_SCHEMES = ["https:", "http:", "blob:", "data:"];

export function isSafeUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return ALLOWED_URL_SCHEMES.includes(u.protocol);
  } catch {
    return false;
  }
}

// ── JWT session (tab + persistent via sessionStorage) ─────────────────────────

export function getToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function setSession(token: string): void {
  sessionStorage.setItem(TOKEN_KEY, token);
}

export function clearSession(): void {
  sessionStorage.removeItem(TOKEN_KEY);
}

export function isAuthenticated(): boolean {
  return !!sessionStorage.getItem(TOKEN_KEY);
}

export function clearAllData(): void {
  sessionStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem("area69_lang");
}
