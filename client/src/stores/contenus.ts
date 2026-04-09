import { create } from "zustand";

export interface Contenu {
  id: number;
  name: string;
  description: string | null;
  url: string | null;
  type: string | null;
  pdf_path: string | null;
  content_raw: string | null;
  summary: string | null;
  status: string;
  created_at: string;
}

interface ContenusStore {
  contenus: Contenu[];
  loading: boolean;
  fetch: () => Promise<void>;
  create: (data: Partial<Contenu>) => Promise<void>;
  update: (id: number, data: Partial<Contenu>) => Promise<void>;
  remove: (id: number) => Promise<void>;
}

export const useContenusStore = create<ContenusStore>((set, get) => ({
  contenus: [],
  loading: false,

  fetch: async () => {
    set({ loading: true });
    const res = await fetch("/api/contenus");
    const contenus = await res.json();
    set({ contenus, loading: false });
  },

  create: async (data) => {
    await fetch("/api/contenus", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    await get().fetch();
  },

  update: async (id, data) => {
    const res = await fetch(`/api/contenus/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const updated = await res.json();
    set({ contenus: get().contenus.map((c) => (c.id === id ? updated : c)) });
  },

  remove: async (id) => {
    await fetch(`/api/contenus/${id}`, { method: "DELETE" });
    set({ contenus: get().contenus.filter((c) => c.id !== id) });
  },
}));
