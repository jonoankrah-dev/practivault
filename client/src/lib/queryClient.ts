import { QueryClient, QueryFunction } from "@tanstack/react-query";

const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";

// Global auth token holder — updated by AuthContext
let authToken: string | null = null;
export function setAuthToken(token: string | null) {
  authToken = token;
}
export function getAuthToken() {
  return authToken;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
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
  // Use module-level authToken (set by AuthContext or DemoApp via setAuthToken)
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

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: { on401: UnauthorizedBehavior }) => QueryFunction<T> =
  ({ on401 }) =>
  async ({ queryKey }) => {
    const url = queryKey.join("/") as string;
    const res = await fetch(`${API_BASE}${url}`, { headers: authHeaders(false) });
    if (on401 === "returnNull" && res.status === 401) return null as any;
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
