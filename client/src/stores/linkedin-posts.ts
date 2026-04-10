import { create } from "zustand";

export interface LinkedInPost {
  id: number;
  text: string | null;
  published_date: string | null;
  linkedin_url: string | null;
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
  importFile: (file: File) => Promise<{ imported: number; skipped: number }>;
  scrape: () => Promise<{ imported: number }>;
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
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/linkedin-posts/import", {
      method: "POST",
      body: formData,
    });
    const result = await res.json();
    await get().fetch();
    return result;
  },

  scrape: async () => {
    const res = await fetch("/api/linkedin-posts/scrape", {
      method: "POST",
    });
    const result = await res.json();
    await get().fetch();
    return result;
  },
}));
