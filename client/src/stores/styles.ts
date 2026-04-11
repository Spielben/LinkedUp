import { create } from "zustand";
import { apiFetch } from "../lib/api";

export interface Style {
  id: number;
  name: string;
  linkedin_url: string | null;
  status: string;
  instructions: string | null;
  examples: string | null;
  created_at: string;
}

interface StylesStore {
  styles: Style[];
  loading: boolean;
  fetch: () => Promise<void>;
  create: (data: Partial<Style>) => Promise<void>;
  update: (id: number, data: Partial<Style>) => Promise<void>;
  remove: (id: number) => Promise<void>;
}

export const useStylesStore = create<StylesStore>((set, get) => ({
  styles: [],
  loading: false,

  fetch: async () => {
    set({ loading: true });
    const res = await apiFetch("/api/styles");
    const styles = await res.json();
    set({ styles, loading: false });
  },

  create: async (data) => {
    await apiFetch("/api/styles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    await get().apiFetch();
  },

  update: async (id, data) => {
    const res = await apiFetch(`/api/styles/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const updated = await res.json();
    set({ styles: get().styles.map((s) => (s.id === id ? updated : s)) });
  },

  remove: async (id) => {
    await apiFetch(`/api/styles/${id}`, { method: "DELETE" });
    set({ styles: get().styles.filter((s) => s.id !== id) });
  },
}));
