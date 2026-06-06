import type { LoginInput, ProfileInput, RegisterInput } from "../schemas/auth";
import type { LecturePracticeProgress, LecturePracticeProgressInput } from "../schemas/lecturePractice";
import type { NewsItem, NewsItemFilters } from "../schemas/news";
import type { PlazaPost, PlazaPostFilters, PlazaPostInput, PlazaPostStatus } from "../schemas/plaza";
import type { CurriculumPlan, ProgramPlanPreview } from "../schemas/programPlan";
import type { SrtpOverview, SrtpRecord, SrtpRecordInput } from "../schemas/srtp";
import type { VolunteerLaborProgress, VolunteerLaborProgressInput } from "../schemas/volunteerLabor";
import type { CustomRequirementInput } from "../schemas/customRequirement";

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

export interface WeatherResponse {
  city: string;
  extensions: "base" | "all";
  lives: unknown[];
  forecasts: unknown[];
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

  if (response.status === 204) {
    return undefined as T;
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

export interface CustomRequirement extends CustomRequirementInput {
  id: string;
  userId: string;
  status: "pending_confirmation" | "completed" | "in_progress" | "not_started";
  progressPercent: number;
  createdAt: string;
  updatedAt: string;
}

export async function listCustomRequirements(): Promise<{ customRequirements: CustomRequirement[] }> {
  return request<{ customRequirements: CustomRequirement[] }>("/api/custom-requirements");
}

export async function createCustomRequirement(input: CustomRequirementInput): Promise<{ customRequirement: CustomRequirement }> {
  return request<{ customRequirement: CustomRequirement }>("/api/custom-requirements", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function updateCustomRequirement(
  id: string,
  input: Partial<CustomRequirementInput>
): Promise<{ customRequirement: CustomRequirement }> {
  return request<{ customRequirement: CustomRequirement }>(`/api/custom-requirements/${id}`, {
    method: "PUT",
    body: JSON.stringify(input)
  });
}

export async function deleteCustomRequirement(id: string): Promise<void> {
  await request<void>(`/api/custom-requirements/${id}`, {
    method: "DELETE"
  });
}

export async function getWeather(city = "320100", extensions: "base" | "all" = "base"): Promise<WeatherResponse> {
  const params = new URLSearchParams({ city, extensions });
  return request<WeatherResponse>(`/api/weather?${params.toString()}`);
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

export async function listNewsItems(
  filters: NewsItemFilters & { cursor?: string; limit?: number }
): Promise<{ items: NewsItem[]; nextCursor: string | null }> {
  return request<{ items: NewsItem[]; nextCursor: string | null }>(
    `/api/news${toQueryString({ ...filters, limit: filters.limit ?? 20 })}`
  );
}

export async function getLecturePracticeProgress(): Promise<{ progress: LecturePracticeProgress }> {
  return request<{ progress: LecturePracticeProgress }>("/api/lecture-practice/me");
}

export async function updateLecturePracticeProgress(
  input: LecturePracticeProgressInput
): Promise<{ progress: LecturePracticeProgress }> {
  return request<{ progress: LecturePracticeProgress }>("/api/lecture-practice/me", {
    method: "PUT",
    body: JSON.stringify(input)
  });
}

export async function getVolunteerLaborProgress(): Promise<{ progress: VolunteerLaborProgress }> {
  return request<{ progress: VolunteerLaborProgress }>("/api/volunteer-labor/me");
}

export async function updateVolunteerLaborProgress(
  input: VolunteerLaborProgressInput
): Promise<{ progress: VolunteerLaborProgress }> {
  return request<{ progress: VolunteerLaborProgress }>("/api/volunteer-labor/me", {
    method: "PUT",
    body: JSON.stringify(input)
  });
}

export async function getSrtpOverview(): Promise<SrtpOverview> {
  return request<SrtpOverview>("/api/srtp/me");
}

export async function createSrtpRecord(input: SrtpRecordInput): Promise<{ record: SrtpRecord }> {
  return request<{ record: SrtpRecord }>("/api/srtp/me/records", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function updateSrtpRecord(id: string, input: SrtpRecordInput): Promise<{ record: SrtpRecord }> {
  return request<{ record: SrtpRecord }>(`/api/srtp/me/records/${id}`, {
    method: "PUT",
    body: JSON.stringify(input)
  });
}

export async function deleteSrtpRecord(id: string): Promise<{ success: true }> {
  return request<{ success: true }>(`/api/srtp/me/records/${id}`, { method: "DELETE" });
}

export async function getCurrentProgramPlan(): Promise<{ plan: ProgramPlanPreview | null }> {
  return request<{ plan: ProgramPlanPreview | null }>("/api/program-plans/me");
}

export async function mockUploadProgramPlan(file: File): Promise<{ preview: ProgramPlanPreview }> {
  const form = new FormData();
  form.set("file", file);
  const token = getToken();
  const headers = new Headers();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  const response = await fetch(`${API_BASE_URL}/api/program-plans/mock-upload`, {
    method: "POST",
    headers,
    body: form
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as ApiErrorBody;
    throw new Error(body.error?.message ?? `Request failed with status ${response.status}`);
  }
  return (await response.json()) as { preview: ProgramPlanPreview };
}

export async function importProgramPlan(input: {
  sourceFilename: string;
  planJson: CurriculumPlan;
}): Promise<{ plan: ProgramPlanPreview; binding: unknown }> {
  return request<{ plan: ProgramPlanPreview; binding: unknown }>("/api/program-plans/import", {
    method: "POST",
    body: JSON.stringify(input)
  });
}
