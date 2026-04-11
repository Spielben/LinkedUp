import { create } from "zustand";
import { apiFetch } from "../lib/api";

export interface Template {
  id: number;
  name: string;
  description: string | null;
  linkedin_post_url: string | null;
  category: string | null;
  author: string | null;
  template_text: string | null;
  example_text: string | null;
  image_url: string | null;
  likes: number;
  comments: number;
  shares: number;
  publication_date: string | null;
  created_at: string;
}

interface TemplatesStore {
  templates: Template[];
  loading: boolean;
  fetch: () => Promise<void>;
  create: (data: Partial<Template>) => Promise<void>;
  update: (id: number, data: Partial<Template>) => Promise<void>;
  remove: (id: number) => Promise<void>;
}

export const useTemplatesStore = create<TemplatesStore>((set, get) => ({
  templates: [],
  loading: false,

  fetch: async () => {
    set({ loading: true });
    const res = await apiFetch("/api/templates");
    const templates = await res.json();
    set({ templates, loading: false });
  },

  create: async (data) => {
    await apiFetch("/api/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    await get().fetch();
  },

  update: async (id, data) => {
    const res = await apiFetch(`/api/templates/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const updated = await res.json();
    set({ templates: get().templates.map((t) => (t.id === id ? updated : t)) });
  },

  remove: async (id) => {
    await apiFetch(`/api/templates/${id}`, { method: "DELETE" });
    set({ templates: get().templates.filter((t) => t.id !== id) });
  },
}));
