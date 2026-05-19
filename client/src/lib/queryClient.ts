import { QueryClient, QueryFunction } from "@tanstack/react-query";

// Empty string = relative URLs — works on any domain (Railway, local, etc)
const API_BASE = "";

// Global auth token holder — updated by AuthContext
let authToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}
export function getAuthToken() {
  return authToken;
}
export function setOnUnauthorized(handler: (() => void) | null) {
  onUnauthorized = handler;
}

function handleUnauthorized() {
  authToken = null;
  onUnauthorized?.();
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    if (res.status === 401) handleUnauthorized();
    let text = "";
    try {
      text = (await res.text()) || res.statusText;
    } catch {
      text = res.statusText;
    }
    throw new Error(`${res.status}: ${text}`);
  }
}

function authHeaders(hasBody: boolean): HeadersInit {
  const h: Record<string, string> = {};
  if (hasBody) h["Content-Type"] = "application/json";
  if (authToken) h["Authorization"] = `Bearer ${authToken}`;
  return h;
}

export async function apiRequest(method: string, url: string, data?: unknown): Promise<Response> {
  const res = await fetch(`${API_BASE}${url}`, {
    method,
    headers: authHeaders(!!data),
    body: data ? JSON.stringify(data) : undefined,
  });
  await throwIfResNotOk(res);
  return res;
}

async function authedJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const hasBody = !!init.body;
  const explicitHeaders = init.headers ?? {};
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...authHeaders(hasBody),
      ...explicitHeaders,
    },
  });
  await throwIfResNotOk(res);
  return (await res.json()) as T;
}

export const safiMemoryApi = {
  recentEvents: (limit = 50) =>
    authedJson<{ events: any[] }>(`/api/activity-events?limit=${limit}`),
  pendingActions: () =>
    authedJson<{ actions: any[] }>("/api/agent-actions?pending=1"),
  approvedActions: () =>
    authedJson<{ actions: any[] }>("/api/agent-actions?status=approved"),
  approveAction: (id: string) =>
    authedJson<{ action: any }>(`/api/agent-actions/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "approved" }),
    }),
  rejectAction: (id: string, reason?: string) =>
    authedJson<{ action: any }>(`/api/agent-actions/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "rejected", rejected_reason: reason ?? null }),
    }),
  prepareExecution: (id: string) =>
    authedJson<{ action: any; executed: boolean }>(`/api/agent-actions/${id}/prepare-execution`, {
      method: "POST",
    }),
};

/** Alias for Saffi-branded pages */
export const saffiMemoryApi = safiMemoryApi;

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: { on401: UnauthorizedBehavior }) => QueryFunction<T> =
  ({ on401 }) =>
  async ({ queryKey }) => {
    const url = queryKey.join("/") as string;
    const res = await fetch(`${API_BASE}${url}`, { headers: authHeaders(false) });
    if (res.status === 401) {
      handleUnauthorized();
      if (on401 === "returnNull") return null as any;
    }
    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
      retry: false,
    },
    mutations: { retry: false },
  },
});
