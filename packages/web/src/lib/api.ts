import type { LoginInput, ProfileInput, RegisterInput } from "../schemas/auth";
import type { GpaCourseInput } from "../schemas/gpa";

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

export interface GpaCourse extends GpaCourseInput {
  id: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface GpaScopeResult {
  weightedGpa: number | null;
  weightedAverageScore: number | null;
  totalCredits: number;
  courseCount: number;
}

export interface GpaCalculationResult {
  requiredFirstAttempt: GpaScopeResult;
  overall: GpaScopeResult;
}

export interface GpaDashboardResponse {
  courses: GpaCourse[];
  result: GpaCalculationResult;
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

export async function getGpaDashboard(): Promise<GpaDashboardResponse> {
  return request<GpaDashboardResponse>("/api/gpa");
}

export async function createGpaCourse(input: GpaCourseInput): Promise<GpaDashboardResponse> {
  return request<GpaDashboardResponse>("/api/gpa/courses", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function updateGpaCourse(courseId: string, input: GpaCourseInput): Promise<GpaDashboardResponse> {
  return request<GpaDashboardResponse>(`/api/gpa/courses/${courseId}`, {
    method: "PUT",
    body: JSON.stringify(input)
  });
}

export async function deleteGpaCourse(courseId: string): Promise<GpaDashboardResponse> {
  return request<GpaDashboardResponse>(`/api/gpa/courses/${courseId}`, {
    method: "DELETE"
  });
}
