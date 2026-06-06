import type { LoginInput, ProfileInput, RegisterInput } from "../schemas/auth";
import type { PlazaPost, PlazaPostFilters, PlazaPostInput, PlazaPostStatus } from "../schemas/plaza";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";
const TOKEN_KEY = "gradcheck.token";

export interface UserProfile {
  displayName: string;
  college: string;
  major: string;
  grade: number;
  gpaGoal: string;
}

export interface CurrentUser {
  id: string;
  email: string;
  profile: UserProfile | null;
}

export interface AuthResponse {
  token: string;
  user: CurrentUser;
}

interface ApiErrorBody {
  error?: {
    message?: string;
  };
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as ApiErrorBody;
    throw new Error(body.error?.message ?? `Request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

function toQueryString(params: Record<string, string | number | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      query.set(key, String(value));
    }
  }
  const text = query.toString();
  return text ? `?${text}` : "";
}

export async function login(input: LoginInput): Promise<AuthResponse> {
  return request<AuthResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function register(input: RegisterInput): Promise<AuthResponse> {
  return request<AuthResponse>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function getCurrentUser(): Promise<{ user: CurrentUser }> {
  return request<{ user: CurrentUser }>("/api/auth/me");
}

export async function updateProfile(input: ProfileInput): Promise<{ profile: UserProfile }> {
  return request<{ profile: UserProfile }>("/api/users/me/profile", {
    method: "PUT",
    body: JSON.stringify(input)
  });
}

export async function listPlazaPosts(
  filters: PlazaPostFilters & { cursor?: string; limit?: number }
): Promise<{ posts: PlazaPost[]; nextCursor: string | null }> {
  return request<{ posts: PlazaPost[]; nextCursor: string | null }>(
    `/api/plaza/posts${toQueryString({ ...filters, limit: filters.limit ?? 20 })}`
  );
}

export async function createPlazaPost(input: PlazaPostInput): Promise<{ post: PlazaPost }> {
  return request<{ post: PlazaPost }>("/api/plaza/posts", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function updatePlazaPost(id: string, input: PlazaPostInput): Promise<{ post: PlazaPost }> {
  return request<{ post: PlazaPost }>(`/api/plaza/posts/${id}`, {
    method: "PUT",
    body: JSON.stringify(input)
  });
}

export async function updatePlazaPostStatus(id: string, status: PlazaPostStatus): Promise<{ post: PlazaPost }> {
  return request<{ post: PlazaPost }>(`/api/plaza/posts/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status })
  });
}

export async function deletePlazaPost(id: string): Promise<{ success: true }> {
  return request<{ success: true }>(`/api/plaza/posts/${id}`, { method: "DELETE" });
}
