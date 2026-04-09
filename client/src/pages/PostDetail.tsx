import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { usePostsStore, type Post } from "../stores/posts";
import { useStylesStore } from "../stores/styles";
import { useTemplatesStore } from "../stores/templates";
import { useContenusStore } from "../stores/contenus";
import { countLinkedInChars } from "../lib/linkedin-chars";

const STATUS_OPTIONS = ["Idée", "Brouillon", "Programmé", "Publié"];
const VERSION_OPTIONS = ["V1", "V2", "V3"];

function CharCount({ text }: { text: string }) {
  const count = countLinkedInChars(text);
  const color = count > 3000 ? "text-red-600" : count > 2000 ? "text-orange-600" : "text-gray-500";
  return <span className={`text-xs ${color}`}>{count} chars</span>;
}

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <button
      onClick={copy}
      disabled={!text}
      className="px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {copied ? "Copied!" : label || "Copy"}
    </button>
  );
}

export function PostDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { posts, fetch: fetchPosts, update, remove, generate, optimize } = usePostsStore();
  const { styles, fetch: fetchStyles } = useStylesStore();
  const { templates, fetch: fetchTemplates } = useTemplatesStore();
  const { contenus, fetch: fetchContenus } = useContenusStore();

  const [post, setPost] = useState<Post | null>(null);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  useEffect(() => {
    fetchPosts();
    fetchStyles();
    fetchTemplates();
    fetchContenus();
  }, []);

  useEffect(() => {
    const found = posts.find((p) => p.id === Number(id));
    if (found) setPost({ ...found });
  }, [posts, id]);

  if (!post) return <p className="text-gray-400">Loading...</p>;

  const save = async (fields: Partial<Post>) => {
    setSaving(true);
    const updated = await update(post.id, fields);
    setPost(updated);
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!confirm("Delete this post?")) return;
    await remove(post.id);
    navigate("/posts");
  };

  const displayVersion = post.final_version || post[`v${post.selected_version?.replace("V", "")}` as keyof Post] as string || "";

  const handleGenerate = async () => {
    setGenerating(true);
    setAiError(null);
    try {
      const updated = await generate(post.id);
      setPost(updated);
    } catch (err: unknown) {
      setAiError(err instanceof Error ? err.message : String(err));
    } finally {
      setGenerating(false);
    }
  };

  const handleOptimize = async () => {
    setOptimizing(true);
    setAiError(null);
    try {
      const updated = await optimize(post.id);
      setPost(updated);
    } catch (err: unknown) {
      setAiError(err instanceof Error ? err.message : String(err));
    } finally {
      setOptimizing(false);
    }
  };

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/posts")} className="text-gray-400 hover:text-gray-600">
            &larr; Posts
          </button>
          <h2 className="text-2xl font-bold">{post.subject || "(untitled)"}</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">{saving ? "Saving..." : ""}</span>
          <button onClick={handleDelete} className="text-red-500 text-sm hover:text-red-700">
            Delete
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Left column — Post config */}
        <div className="col-span-1 space-y-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Subject</label>
              <input
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                value={post.subject || ""}
                onChange={(e) => setPost({ ...post, subject: e.target.value })}
                onBlur={() => save({ subject: post.subject })}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
              <textarea
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                rows={3}
                value={post.description || ""}
                onChange={(e) => setPost({ ...post, description: e.target.value })}
                onBlur={() => save({ description: post.description })}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
              <select
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                value={post.status}
                onChange={(e) => { setPost({ ...post, status: e.target.value }); save({ status: e.target.value }); }}
              >
                {STATUS_OPTIONS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Style</label>
              <select
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                value={post.style_id || ""}
                onChange={(e) => { const v = e.target.value ? Number(e.target.value) : null; save({ style_id: v }); }}
              >
                <option value="">None</option>
                {styles.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Template</label>
              <select
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                value={post.template_id || ""}
                onChange={(e) => { const v = e.target.value ? Number(e.target.value) : null; save({ template_id: v }); }}
              >
                <option value="">None</option>
                {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Content source</label>
              <select
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                value={post.contenu_id || ""}
                onChange={(e) => { const v = e.target.value ? Number(e.target.value) : null; save({ contenu_id: v }); }}
              >
                <option value="">None</option>
                {contenus.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Publication date</label>
              <input
                type="datetime-local"
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                value={post.publication_date?.replace(" ", "T").slice(0, 16) || ""}
                onChange={(e) => save({ publication_date: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">LinkedIn Post URL</label>
              <input
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                placeholder="Paste after publishing"
                value={post.linkedin_post_url || ""}
                onChange={(e) => setPost({ ...post, linkedin_post_url: e.target.value })}
                onBlur={() => save({ linkedin_post_url: post.linkedin_post_url })}
              />
            </div>
          </div>
        </div>

        {/* Right column — Versions + Final */}
        <div className="col-span-2 space-y-4">
          {/* AI error banner */}
          {aiError && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm text-red-700 flex justify-between items-center">
              <span>{aiError}</span>
              <button onClick={() => setAiError(null)} className="ml-3 text-red-400 hover:text-red-600">✕</button>
            </div>
          )}

          {/* Generate button */}
          <button
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!post.subject || generating}
            onClick={handleGenerate}
          >
            {generating ? "Generating…" : "✨ Generate V1 / V2 / V3"}
          </button>

          {/* V1 / V2 / V3 */}
          {(post.v1 || post.v2 || post.v3) && (
            <div className="grid grid-cols-3 gap-3">
              {VERSION_OPTIONS.map((v) => {
                const key = v.toLowerCase() as "v1" | "v2" | "v3";
                const text = post[key] || "";
                const isSelected = post.selected_version === v;
                return (
                  <div
                    key={v}
                    className={`bg-white rounded-lg border p-3 cursor-pointer transition-colors ${
                      isSelected ? "border-blue-500 ring-2 ring-blue-100" : "border-gray-200 hover:border-gray-300"
                    }`}
                    onClick={() => save({ selected_version: v, final_version: text })}
                  >
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-bold text-gray-600">{v}</span>
                      <div className="flex items-center gap-2">
                        <CharCount text={text} />
                        <CopyButton text={text} />
                      </div>
                    </div>
                    <p className="text-xs text-gray-700 whitespace-pre-line line-clamp-6">{text || "(empty)"}</p>
                  </div>
                );
              })}
            </div>
          )}

          {/* Final version */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-medium">Final Version</label>
              <div className="flex items-center gap-3">
                <CharCount text={post.final_version || ""} />
                <CopyButton text={post.final_version || ""} label="Copy to clipboard" />
              </div>
            </div>
            <textarea
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm font-mono"
              rows={10}
              value={post.final_version || ""}
              onChange={(e) => setPost({ ...post, final_version: e.target.value })}
              onBlur={() => save({ final_version: post.final_version })}
              placeholder="Select a version above, or write your post here directly..."
            />
          </div>

          {/* First comment */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-medium">First Comment</label>
              <CopyButton text={post.first_comment || ""} label="Copy comment" />
            </div>
            <textarea
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              rows={3}
              value={post.first_comment || ""}
              onChange={(e) => setPost({ ...post, first_comment: e.target.value })}
              onBlur={() => save({ first_comment: post.first_comment })}
              placeholder="Optional first comment to post after publishing..."
            />
          </div>

          {/* Optimization */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-medium">Optimization Instructions</label>
              <button
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-purple-100 text-purple-700 hover:bg-purple-200 disabled:opacity-40 disabled:cursor-not-allowed"
                disabled={!post.final_version || !post.optimization_instructions || optimizing}
                onClick={handleOptimize}
              >
                {optimizing ? "Optimizing…" : "⚡ Optimize"}
              </button>
            </div>
            <textarea
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              rows={2}
              value={post.optimization_instructions || ""}
              onChange={(e) => setPost({ ...post, optimization_instructions: e.target.value })}
              onBlur={() => save({ optimization_instructions: post.optimization_instructions })}
              placeholder="e.g. Make it shorter, add more emojis, change the CTA..."
            />
          </div>
        </div>
      </div>
    </div>
  );
}
