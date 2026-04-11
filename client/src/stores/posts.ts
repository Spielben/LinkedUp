import { create } from "zustand";
import { apiFetch } from "../lib/api";

export interface Post {
  id: number;
  subject: string | null;
  description: string | null;
  model: string;
  status: string;
  v1: string | null;
  v2: string | null;
  v3: string | null;
  selected_version: string | null;
  final_version: string | null;
  optimization_instructions: string | null;
  publication_date: string | null;
  image_path: string | null;
  first_comment: string | null;
  first_comment_posted: number;
  linkedin_post_url: string | null;
  linkedin_post_id: string | null;
  style_id: number | null;
  template_id: number | null;
  contenu_id: number | null;
  likes: number;
  impressions: number;
  comments: number;
  shares: number;
  publish_error: string | null;
  created_at: string;
  updated_at: string;
  style_name: string | null;
  template_name: string | null;
  contenu_name: string | null;
}

interface PostsStore {
  posts: Post[];
  loading: boolean;
  fetch: () => Promise<void>;
  create: (data: Partial<Post>) => Promise<Post>;
  update: (id: number, data: Partial<Post>) => Promise<Post>;
  remove: (id: number) => Promise<void>;
  generate: (id: number) => Promise<Post>;
  optimize: (id: number) => Promise<Post>;
}

export const usePostsStore = create<PostsStore>((set, get) => ({
  posts: [],
  loading: false,

  fetch: async () => {
    set({ loading: true });
    const res = await apiFetch("/api/posts");
    const posts = await res.json();
    set({ posts, loading: false });
  },

  create: async (data) => {
    const res = await apiFetch("/api/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const { id } = await res.json();
    await get().apiFetch();
    return get().posts.find((p) => p.id === id)!;
  },

  update: async (id, data) => {
    const res = await apiFetch(`/api/posts/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const updated = await res.json();
    set({ posts: get().posts.map((p) => (p.id === id ? updated : p)) });
    return updated;
  },

  remove: async (id) => {
    await apiFetch(`/api/posts/${id}`, { method: "DELETE" });
    set({ posts: get().posts.filter((p) => p.id !== id) });
  },

  generate: async (id) => {
    const res = await apiFetch(`/api/posts/${id}/generate`, { method: "POST" });
    if (!res.ok) throw new Error((await res.json()).error);
    const updated = await res.json();
    set({ posts: get().posts.map((p) => (p.id === id ? updated : p)) });
    return updated;
  },

  optimize: async (id) => {
    const res = await apiFetch(`/api/posts/${id}/optimize`, { method: "POST" });
    if (!res.ok) throw new Error((await res.json()).error);
    const updated = await res.json();
    set({ posts: get().posts.map((p) => (p.id === id ? updated : p)) });
    return updated;
  },
}));
