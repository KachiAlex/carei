const API_BASE = import.meta.env.VITE_API_URL || "";

function getToken() {
  try { return sessionStorage.getItem("carei_token"); } catch { return null; }
}

async function fetchJson(path: string, init?: RequestInit) {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  auth: {
    login: (email: string, password: string) =>
      fetchJson("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
    register: (body: { name: string; email: string; password: string; role?: string }) =>
      fetchJson("/api/auth/register", { method: "POST", body: JSON.stringify(body) }),
  },
  clients: {
    list: () => fetchJson("/api/clients"),
  },
  visits: {
    list: (params?: { date?: string; carerId?: number; status?: string }) => {
      const qs = params ? "?" + new URLSearchParams(params as any).toString() : "";
      return fetchJson(`/api/visits${qs}`);
    },
    create: (body: any) => fetchJson("/api/visits", { method: "POST", body: JSON.stringify(body) }),
    update: (body: any) => fetchJson("/api/visits", { method: "PUT", body: JSON.stringify(body) }),
  },
  notes: {
    list: (params?: { clientId?: number; visitId?: number }) => {
      const qs = params ? "?" + new URLSearchParams(params as any).toString() : "";
      return fetchJson(`/api/notes${qs}`);
    },
    create: (body: any) => fetchJson("/api/notes", { method: "POST", body: JSON.stringify(body) }),
  },
  meds: {
    list: (params?: { visitId?: number }) => {
      const qs = params ? "?" + new URLSearchParams(params as any).toString() : "";
      return fetchJson(`/api/meds${qs}`);
    },
    create: (body: any) => fetchJson("/api/meds", { method: "POST", body: JSON.stringify(body) }),
  },
};

export type ApiUser = {
  id: number;
  name: string;
  email: string;
  role: string;
  phone: string | null;
  avatar: string | null;
};

export type ApiClient = {
  id: number;
  name: string;
  age: number | null;
  condition: string | null;
  address: string | null;
  phone: string | null;
  emergencyContact: string | null;
  nextVisit: string | null;
  avatar: string | null;
  needs: string[] | null;
  meds: { id: number; clientId: number | null; name: string; dose: string | null; schedule: string | null }[];
};

export type ApiVisit = {
  id: number;
  clientId: number | null;
  carerId: number | null;
  date: string;
  type: string | null;
  duration: number | null;
  status: string;
  notes: string | null;
};
