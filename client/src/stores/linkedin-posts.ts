import { create } from "zustand";

export interface LinkedInPost {
  id: number;
  subject: string | null;
  description: string | null;
  text: string | null;
  image_url: string | null;
  published_date: string | null;
  linkedin_url: string | null;
  first_comment: string | null;
  status: string;
  likes: number;
  comments: number;
  shares: number;
  impressions: number;
  source: string;
  created_at: string;
}

interface LinkedInPostsStore {
  posts: LinkedInPost[];
  loading: boolean;
  fetch: () => Promise<void>;
  importFile: (file: File) => Promise<{ imported: number; skipped: number; duplicates: number }>;
  scrape: () => Promise<{ imported: number; profilesScanned: number }>;
  remove: (id: number) => Promise<void>;
}

export const useLinkedInPostsStore = create<LinkedInPostsStore>((set, get) => ({
  posts: [],
  loading: false,

  fetch: async () => {
    set({ loading: true });
    try {
      const res = await fetch("/api/linkedin-posts");
      const posts = await res.json();
      set({ posts, loading: false });
    } catch (e) {
      set({ loading: false });
    }
  },

  importFile: async (file) => {
    const content = await file.text();
    const res = await fetch("/api/linkedin-posts/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Import failed");
    }
    const result = await res.json();
    await get().fetch();
    return result;
  },

  scrape: async () => {
    const res = await fetch("/api/linkedin-posts/scrape", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as { error?: string }).error || "Scrape failed");
    }
    const result = await res.json();
    await get().fetch();
    return result;
  },

  remove: async (id) => {
    await fetch(`/api/linkedin-posts/${id}`, { method: "DELETE" });
    set({ posts: get().posts.filter((p) => p.id !== id) });
  },
}));
