import type { Response } from "./types";
export class ApiError extends Error {
  constructor(
    public status: number,
    public body: {
      message?: string;
      errors?: Record<string, string[]>;
      contested?: string[];
    },
  ) {
    super(body.message || `Request failed (${status}). Please try again.`);
  }
}
const base = (
  import.meta.env.VITE_API_BASE_URL ||
  "https://api.kinoxii.redberryinternship.ge/api"
).replace(/\/$/, "");
export const tokenStore = {
  get: () => localStorage.getItem("kino-token"),
  set: (token: string) => localStorage.setItem("kino-token", token),
  clear: () => localStorage.removeItem("kino-token"),
};
let reauthenticate: null | (() => Promise<void>) = null;
export function setReauthenticate(handler: () => Promise<void>) {
  reauthenticate = handler;
}
export async function api<T>(
  path: string,
  options: RequestInit = {},
  retryAuth = true,
): Promise<Response<T>> {
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  const token = tokenStore.get();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (options.body && !(options.body instanceof FormData))
    headers.set("Content-Type", "application/json");
  let response: globalThis.Response;
  try {
    response = await fetch(`${base}${path}`, { ...options, headers });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new ApiError(0, {
      message: "Unable to connect. Check your connection and try again.",
    });
  }
  const body =
    response.status === 204
      ? { data: null }
      : await response.json().catch(() => ({
          message: "The server returned an invalid response. Please try again.",
        }));
  if (!response.ok) {
    if (
      response.status === 401 &&
      retryAuth &&
      !["/login", "/register", "/me", "/logout"].includes(path) &&
      reauthenticate
    ) {
      await reauthenticate();
      return api<T>(path, options, false);
    }
    throw new ApiError(response.status, body);
  }
  return body;
}
export const post = <T>(path: string, body?: unknown) =>
  api<T>(path, {
    method: "POST",
    body:
      body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });
export function formData(values: Record<string, unknown>) {
  const form = new FormData();
  Object.entries(values).forEach(([k, v]) => {
    if (v instanceof File) form.append(k, v);
    else if (v !== undefined && v !== null) form.append(k, String(v));
  });
  return form;
}
