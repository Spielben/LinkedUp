import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { usePostsStore, type Post } from "../stores/posts";
import { useStylesStore } from "../stores/styles";
import { useTemplatesStore } from "../stores/templates";
import { useContenusStore } from "../stores/contenus";
import { countLinkedInChars } from "../lib/linkedin-chars";
import { apiFetch, apiUrl, readApiJson } from "../lib/api";
import {
  MAX_LINKEDIN_IMAGES,
  type MediaRow,
  mediaRowsFromPost,
  persistMediaPayload,
} from "../lib/post-media";

const STATUS_OPTIONS = ["Idea", "Draft", "Scheduled", "Published"];
const VERSION_OPTIONS = ["V1", "V2", "V3"];

// ── Mini aperçu LinkedIn (visible uniquement si image présente) ───────────────
function LinkedInMiniPreview({
  post,
  mediaRows,
  authorName,
  timezone,
}: {
  post: Post;
  mediaRows: MediaRow[];
  authorName: string;
  timezone: string;
}) {
  const [modalOpen, setModalOpen] = useState(false);

  const text = (() => {
    if (post.final_version?.trim()) return post.final_version.trim();
    const sel = post.selected_version?.trim().toUpperCase();
    if (sel === "V1" && post.v1?.trim()) return post.v1.trim();
    if (sel === "V2" && post.v2?.trim()) return post.v2.trim();
    if (sel === "V3" && post.v3?.trim()) return post.v3.trim();
    return "";
  })();

  const firstImage = mediaRows[0];
  if (!firstImage) return null;

  const imageUrl =
    firstImage.kind === "url"
      ? firstImage.ref.trim()
      : apiUrl(`/${firstImage.ref.trim().replace(/^\/+/, "")}`);

  if (!imageUrl) return null;

  const dateStr = post.publication_date
    ? new Intl.DateTimeFormat("en-GB", {
        timeZone: timezone,
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(post.publication_date.replace(" ", "T") + "Z"))
    : "Not scheduled";

  const PreviewCard = ({ compact }: { compact: boolean }) => (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 p-3 pb-2">
        <div className="w-8 h-8 rounded-full bg-[#0A66C2] flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
          {authorName.charAt(0).toUpperCase()}
        </div>
        <div>
          <p className="font-semibold text-xs text-gray-900">{authorName}</p>
          <p className="text-[10px] text-gray-400">{dateStr} • 🌐</p>
        </div>
      </div>
      {/* Texte */}
      {text && (
        <p className={`px-3 pb-2 text-xs text-gray-700 whitespace-pre-line leading-relaxed ${compact ? "line-clamp-3" : ""}`}>
          {text}
        </p>
      )}
      {/* Image */}
      <img
        src={imageUrl}
        alt="Media preview"
        className={`w-full object-cover ${compact ? "max-h-40" : "max-h-[60vh]"}`}
        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
      />
      {/* Barre d'engagement */}
      <div className="px-3 py-1.5 border-t border-gray-100 flex gap-1">
        {["👍 Like", "💬 Comment", "↩ Repost", "✉ Send"].map((label) => (
          <span key={label} className="flex-1 text-[10px] text-gray-400 text-center py-1">
            {label}
          </span>
        ))}
      </div>
    </div>
  );

  return (
    <>
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <label className="text-sm font-medium text-gray-700">LinkedIn Preview</label>
          <button
            onClick={() => setModalOpen(true)}
            className="text-xs text-[#0A66C2] hover:underline font-medium"
          >
            Expand →
          </button>
        </div>
        <div
          className="cursor-pointer hover:opacity-90 transition-opacity"
          onClick={() => setModalOpen(true)}
          title="Cliquer pour voir en grand"
        >
          <PreviewCard compact={true} />
        </div>
      </div>

      {/* Modal plein écran */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="bg-gray-50 rounded-2xl w-full max-w-lg max-h-[94vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 sticky top-0 bg-gray-50 rounded-t-2xl z-10">
              <div>
                <h3 className="font-semibold text-gray-900">LinkedIn Preview</h3>
                <p className="text-xs text-gray-500 mt-0.5">As it would appear on LinkedIn</p>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors text-lg"
              >
                ×
              </button>
            </div>
            <div className="p-5">
              <PreviewCard compact={false} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function linkedinPostHref(url: string): string {
  const u = url.trim();
  if (!u) return "#";
  if (/^https?:\/\//i.test(u)) return u;
  return `https://${u.replace(/^\/+/, "")}`;
}

const PUBLISHED_STATUSES = new Set(["Published"]);

/** Match server: body is publishable if final is non-empty or selected variant has text. */
function hasPublishableBody(p: Post): boolean {
  if ((p.final_version || "").trim()) return true;
  const sel = p.selected_version?.trim().toUpperCase();
  if (sel === "V1" && (p.v1 || "").trim()) return true;
  if (sel === "V2" && (p.v2 || "").trim()) return true;
  if (sel === "V3" && (p.v3 || "").trim()) return true;
  return false;
}

/** Datetime-local input (heure locale) → UTC stocké en base SQLite */
/**
 * Convertit une saisie datetime-local (heure dans `timezone`) → UTC pour SQLite.
 * Indépendant du timezone du navigateur — utilise toujours le timezone des Settings.
 */
function datetimeLocalToUtcSqlite(v: string, timezone: string): string | null {
  const t = v.trim();
  if (!t) return null;
  const norm = t.includes("T") ? t : t.replace(" ", "T");

  // Étape 1 : on traite la saisie naïvement comme UTC
  const naiveUtc = new Date(norm + "Z");
  if (isNaN(naiveUtc.getTime())) return null;

  // Étape 2 : on affiche cette "naiveUtc" dans le timezone voulu (ex: Bangkok)
  const tzStr = new Intl.DateTimeFormat("sv-SE", {
    timeZone: timezone,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  }).format(naiveUtc).replace(" ", "T");

  // Étape 3 : l'offset = différence entre représentation locale et naiveUtc
  // Ex: Bangkok UTC+7 → naiveUtc=23:20UTC, tzStr=06:20 lendemain → offsetMs = +7h
  const tzAsUtc = new Date(tzStr + "Z");
  const offsetMs = tzAsUtc.getTime() - naiveUtc.getTime();

  // Étape 4 : vraie UTC = naiveUtc - offsetMs
  const actualUtc = new Date(naiveUtc.getTime() - offsetMs);
  return actualUtc.toISOString().replace("T", " ").slice(0, 19);
}

/** UTC stocké en base → valeur datetime-local affichée dans `timezone` */
function sqliteUtcToDatetimeLocal(v: string | null | undefined, timezone: string): string {
  if (!v) return "";
  const date = new Date(v.replace(" ", "T") + "Z");
  if (isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: timezone,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
    hour12: false,
  }).format(date).replace(" ", "T").slice(0, 16);
}

function CharCount({ text }: { text: string }) {
  const count = countLinkedInChars(text);
  const color = count > 3000 ? "text-red-600" : count > 2000 ? "text-orange-600" : "text-gray-500";
  return <span className={`text-xs ${color}`}>{count} chars</span>;
}

function CopyButton({ text, label, stopPropagation }: { text: string; label?: string; stopPropagation?: boolean }) {
  const [copied, setCopied] = useState(false);

  const copy = (e: React.MouseEvent) => {
    if (stopPropagation) e.stopPropagation();
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <button
      type="button"
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
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [mediaRows, setMediaRows] = useState<MediaRow[]>([]);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [publicationDateDraft, setPublicationDateDraft] = useState("");
  const [pubDateDirty, setPubDateDirty] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [authorName, setAuthorName] = useState("Spielben & Co");
  const [timezone, setTimezone] = useState("Asia/Bangkok");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [isEditMode, setIsEditMode] = useState(true);
  const editModeInitRef = useRef(false);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    fetchPosts();
    fetchStyles();
    fetchTemplates();
    fetchContenus();
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const res = await apiFetch("/api/settings");
        const data = (await res.json()) as { signature?: string | null; name?: string | null; timezone?: string | null };
        setSignature(data.signature ?? null);
        if (data.name?.trim()) setAuthorName(data.name.trim());
        if (data.timezone?.trim()) setTimezone(data.timezone.trim());
      } catch {
        setSignature(null);
      }
    })();
  }, []);

  useEffect(() => {
    const found = posts.find((p) => p.id === Number(id));
    if (found) {
      setPost({ ...found });
      if (!editModeInitRef.current) {
        editModeInitRef.current = true;
        const alreadyPublished =
          !!found.linkedin_post_url?.trim() && PUBLISHED_STATUSES.has(found.status);
        if (alreadyPublished) setIsEditMode(false);
      }
    }
  }, [posts, id]);

  useEffect(() => {
    setPubDateDirty(false);
    setConfirmDelete(false);
    editModeInitRef.current = false;
    setIsEditMode(true);
  }, [id]);

  useEffect(() => {
    if (!post || pubDateDirty) return;
    setPublicationDateDraft(sqliteUtcToDatetimeLocal(post.publication_date, timezone));
  }, [post?.id, post?.publication_date, pubDateDirty]);

  useEffect(() => {
    if (post) setMediaRows(mediaRowsFromPost(post));
  }, [post?.id, post?.media_json, post?.image_path]);

  if (!post) return <p className="text-gray-400">Loading...</p>;

  const isActuallyPublished =
    !!post.linkedin_post_url?.trim() && PUBLISHED_STATUSES.has(post.status);

  const save = async (fields: Partial<Post>, options?: { successMessage?: string }) => {
    setSaveError(null);
    setSaving(true);
    try {
      const updated = await update(post.id, fields);
      setPost(updated);
      if (options?.successMessage) showToast(options.successMessage);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setSaveError(msg);
      showToast(msg, "error");
    } finally {
      setSaving(false);
    }
  };

  const applyPublicationDate = async () => {
    setSaveError(null);
    setSaving(true);
    try {
      const normalized = datetimeLocalToUtcSqlite(publicationDateDraft, timezone);
      const updated = await update(post.id, { publication_date: normalized });
      setPost(updated);
      setPubDateDirty(false);
      setPublicationDateDraft(updated.publication_date?.replace(" ", "T").slice(0, 16) ?? "");
      showToast("Scheduled date saved \u2713");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setSaveError(msg);
      showToast(msg, "error");
    } finally {
      setSaving(false);
    }
  };

  const clearPublicationDate = async () => {
    setSaveError(null);
    setSaving(true);
    try {
      const updated = await update(post.id, { publication_date: null });
      setPost(updated);
      setPubDateDirty(false);
      setPublicationDateDraft("");
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const saveMedia = async (rows: MediaRow[]) => {
    setMediaError(null);
    setSaving(true);
    try {
      const payload = persistMediaPayload(rows);
      const updated = await update(post.id, payload);
      setPost(updated);
      setMediaRows(mediaRowsFromPost(updated));
    } catch (err: unknown) {
      setMediaError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setMediaError(null);
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(apiUrl(`/api/posts/${post.id}/upload-media`), { method: "POST", body: fd });
      const data = (await res.json()) as { path?: string; error?: string };
      if (!res.ok) {
        setMediaError(data.error || "Upload failed");
        return;
      }
      if (!data.path) {
        setMediaError("No path returned");
        return;
      }
      const next = [...mediaRows, { kind: "local" as const, ref: data.path }].slice(0, MAX_LINKEDIN_IMAGES);
      await saveMedia(next);
    } catch (err: unknown) {
      setMediaError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    try {
      await remove(post.id);
      navigate("/posts");
    } catch (err: unknown) {
      setConfirmDelete(false);
      showToast(err instanceof Error ? err.message : "Delete failed", "error");
    }
  };

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

  const handlePublish = async () => {
    setPublishing(true);
    setPublishError(null);
    try {
      const res = await apiFetch(`/api/posts/${post.id}/publish`, { method: "POST" });
      const data = await readApiJson<Post & { error?: string }>(res);
      if (!res.ok) {
        setPublishError(data.error || "Publication failed");
      } else {
        setPost(data);
        await fetchPosts();
      }
    } catch (err: unknown) {
      setPublishError(err instanceof Error ? err.message : String(err));
    } finally {
      setPublishing(false);
    }
  };

  const handleOptimize = async () => {
    setOptimizing(true);
    setAiError(null);
    try {
      const updated = await optimize(post.id);
      setPost(updated);
      showToast("Post optimized and saved \u2713");
    } catch (err: unknown) {
      setAiError(err instanceof Error ? err.message : String(err));
    } finally {
      setOptimizing(false);
    }
  };

  // ── Vue lecture seule pour les posts publiés ─────────────────────────────
  if (isActuallyPublished && !isEditMode) {
    const viewText = (() => {
      if (post.final_version?.trim()) return post.final_version.trim();
      const sel = post.selected_version?.trim().toUpperCase();
      if (sel === "V1" && post.v1?.trim()) return post.v1.trim();
      if (sel === "V2" && post.v2?.trim()) return post.v2.trim();
      if (sel === "V3" && post.v3?.trim()) return post.v3.trim();
      return "";
    })();
    const viewImage = mediaRows[0]
      ? mediaRows[0].kind === "url"
        ? mediaRows[0].ref.trim()
        : apiUrl(`/${mediaRows[0].ref.trim().replace(/^\/+/, "")}`)
      : null;

    return (
      <div className="max-w-2xl">
        {toast && (
          <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium flex items-center gap-2 ${
            toast.type === "success" ? "bg-green-50 border border-green-200 text-green-800" : "bg-red-50 border border-red-200 text-red-800"
          }`}>
            <span>{toast.type === "success" ? "✅" : "❌"}</span>
            {toast.message}
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => navigate("/posts")} className="text-gray-400 hover:text-gray-600">
            &larr; Posts
          </button>
          <div className="flex items-center gap-2">
            {confirmDelete ? (
              <>
                <span className="text-xs text-red-600 font-medium">Confirm deletion?</span>
                <button onClick={() => void handleDelete()} className="text-xs px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium">
                  Yes, delete
                </button>
                <button onClick={() => setConfirmDelete(false)} className="text-xs px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50">
                  Cancel
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setIsEditMode(true)}
                  className="text-sm px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 font-medium"
                >
                  ✏️ Éditer
                </button>
                <button onClick={() => void handleDelete()} className="text-red-500 text-sm hover:text-red-700">
                  Supprimer
                </button>
              </>
            )}
          </div>
        </div>

        {/* Titre + badge Publié */}
        <div className="flex flex-wrap items-center gap-3 mb-5">
          <h2 className="text-2xl font-bold">{post.subject || "(sans titre)"}</h2>
          <span className="inline-flex items-center gap-1.5 text-sm text-green-700 bg-green-50 border border-green-200 px-3 py-1 rounded-full font-medium">
            <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
            Published on LinkedIn
          </span>
        </div>

        {/* Aperçu LinkedIn pleine largeur */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-4">
          <div className="flex items-start gap-3 p-4 pb-3">
            <div className="w-12 h-12 rounded-full bg-[#0A66C2] flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
              {authorName.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-gray-900">{authorName}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                🗓{" "}
                {post.publication_date
                  ? new Intl.DateTimeFormat("en-GB", {
                      timeZone: timezone,
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    }).format(new Date(post.publication_date.replace(" ", "T") + "Z"))
                  : "—"}{" "}
                · 🌐
              </p>
            </div>
          </div>
          {viewText && (
            <div className="px-4 pb-3">
              <p className="text-sm text-gray-800 whitespace-pre-line leading-relaxed">{viewText}</p>
            </div>
          )}
          {viewImage && (
            <img
              src={viewImage}
              alt="Post media"
              className="w-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          )}
          <div className="px-4 py-2 border-t border-gray-100 flex">
            {["👍 Like", "💬 Comment", "↩ Repost", "✉ Send"].map((l) => (
              <span key={l} className="flex-1 text-xs text-gray-400 text-center py-1">{l}</span>
            ))}
          </div>
        </div>

        {/* Lien LinkedIn */}
        <a
          href={linkedinPostHref(post.linkedin_post_url!)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm text-[#0A66C2] hover:text-[#004182] font-medium hover:underline"
        >
          View post on LinkedIn →
        </a>
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium flex items-center gap-2 transition-all ${
            toast.type === "success"
              ? "bg-green-50 border border-green-200 text-green-800"
              : "bg-red-50 border border-red-200 text-red-800"
          }`}
        >
          <span>{toast.type === "success" ? "\u2705" : "\u274C"}</span>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/posts")} className="text-gray-400 hover:text-gray-600">
            &larr; Posts
          </button>
          {isActuallyPublished && (
            <button
              onClick={() => setIsEditMode(false)}
              className="text-sm text-[#0A66C2] hover:underline"
            >
              ← Published view
            </button>
          )}
          <h2 className="text-2xl font-bold">{post.subject || "(untitled)"}</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">{saving ? "Saving..." : ""}</span>
          {saveError && (
            <span className="text-xs text-red-600 max-w-xs truncate" title={saveError}>
              {saveError}
            </span>
          )}
          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-red-600 font-medium">Confirm deletion?</span>
              <button
                type="button"
                onClick={() => void handleDelete()}
                className="text-xs px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
              >
                Yes, delete
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="text-xs px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => void handleDelete()}
              className="text-red-500 text-sm hover:text-red-700"
            >
              Supprimer
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left column — Post config */}
        <div className="md:col-span-1 space-y-4">
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
              <p className="text-[11px] text-gray-400 mb-1.5 leading-snug">
                Choose date and time, then confirm — nothing is stored until you click Save.
              </p>
              <input
                type="datetime-local"
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                value={publicationDateDraft}
                onChange={(e) => {
                  setPubDateDirty(true);
                  setPublicationDateDraft(e.target.value);
                }}
              />
              <div className="flex flex-wrap gap-2 mt-2">
                <button
                  type="button"
                  className="text-xs px-3 py-1.5 rounded-lg bg-gray-800 text-white hover:bg-gray-700 disabled:opacity-40"
                  disabled={saving}
                  onClick={() => void applyPublicationDate()}
                >
                  Save scheduled date
                </button>
                <button
                  type="button"
                  className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-40"
                  disabled={saving || !post.publication_date}
                  onClick={() => void clearPublicationDate()}
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="border-t border-gray-100 pt-3 space-y-2">
              <label className="block text-xs font-medium text-gray-500">
                LinkedIn images (carousel)
              </label>
              <p className="text-[11px] text-gray-400 leading-snug">
                Up to {MAX_LINKEDIN_IMAGES} images. HTTPS URLs (e.g. Cloudinary) or files under{" "}
                <code className="bg-gray-100 px-0.5 rounded">data/</code>. Video not supported yet.
              </p>
              {mediaError && (
                <p className="text-xs text-red-600">{mediaError}</p>
              )}
              <div className="space-y-2">
                {mediaRows.map((row, idx) => (
                  <div key={idx} className="rounded border border-gray-200 p-2 space-y-1.5 bg-gray-50/80">
                    <div className="flex gap-1 items-center">
                      <select
                        className="text-xs border border-gray-300 rounded px-1 py-1 flex-1 min-w-0"
                        value={row.kind}
                        onChange={(e) => {
                          const next = mediaRows.map((r, i) =>
                            i === idx ? { ...r, kind: e.target.value as "local" | "url" } : r
                          );
                          setMediaRows(next);
                          void saveMedia(next);
                        }}
                      >
                        <option value="local">Local path</option>
                        <option value="url">HTTPS URL</option>
                      </select>
                      <button
                        type="button"
                        className="text-xs text-red-600 hover:text-red-800 px-1"
                        onClick={() => {
                          const next = mediaRows.filter((_, i) => i !== idx);
                          setMediaRows(next);
                          void saveMedia(next);
                        }}
                      >
                        Remove
                      </button>
                    </div>
                    <input
                      className="w-full border border-gray-300 rounded px-2 py-1 text-xs font-mono"
                      placeholder={row.kind === "url" ? "https://…" : "data/media/… or absolute path"}
                      value={row.ref}
                      onChange={(e) => {
                        const next = mediaRows.map((r, i) =>
                          i === idx ? { ...r, ref: e.target.value } : r
                        );
                        setMediaRows(next);
                      }}
                      onBlur={() => void saveMedia(mediaRows)}
                    />
                    {row.ref.trim() && (
                      <div className="pt-1">
                        <img
                          src={row.kind === "url" ? row.ref.trim() : apiUrl(`/${row.ref.replace(/^\/+/, "")}`)}
                          className="w-full max-h-28 object-contain rounded border border-gray-200 bg-white"
                          alt="Preview"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <label className="text-xs px-2 py-1.5 rounded bg-gray-800 text-white cursor-pointer hover:bg-gray-700">
                  Upload image
                  <input type="file" accept="image/jpeg,image/png,image/gif,image/webp" className="hidden" onChange={handleMediaUpload} />
                </label>
                <button
                  type="button"
                  className="text-xs px-2 py-1.5 rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-40"
                  disabled={mediaRows.length >= MAX_LINKEDIN_IMAGES}
                  onClick={() => {
                    const next = [...mediaRows, { kind: "url" as const, ref: "" }].slice(0, MAX_LINKEDIN_IMAGES);
                    setMediaRows(next);
                  }}
                >
                  Add URL row
                </button>
                <button
                  type="button"
                  className="text-xs px-2 py-1.5 rounded border border-gray-300 hover:bg-gray-50"
                  onClick={() => void saveMedia(mediaRows)}
                >
                  Save media
                </button>
              </div>
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
        <div className="md:col-span-2 space-y-4">
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
                    onClick={() => {
                      const textWithSig =
                        signature?.trim() && !text.includes(signature.trim())
                          ? `${text.trimEnd()}\n\n${signature.trim()}`
                          : text;
                      void save({ selected_version: v, final_version: textWithSig });
                    }}
                  >
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-bold text-gray-600">{v}</span>
                      <div className="flex items-center gap-2">
                        <CharCount text={text} />
                        <CopyButton text={text} stopPropagation />
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
              onBlur={(e) => save({ final_version: e.target.value })}
              placeholder="Select a version above, or write your post here directly..."
            />
          </div>

          {/* Aperçu LinkedIn — visible uniquement si image présente */}
          {mediaRows.length > 0 && (
            <LinkedInMiniPreview
              post={post}
              mediaRows={mediaRows}
              authorName={authorName}
              timezone={timezone}
            />
          )}

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
              onBlur={(e) => save({ first_comment: e.target.value })}
              placeholder="Optional first comment to post after publishing..."
            />
          </div>

          {/* Optimization */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <label className="block text-sm font-medium mb-2">Optimization instructions</label>
            <textarea
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              rows={2}
              value={post.optimization_instructions || ""}
              onChange={(e) => setPost({ ...post, optimization_instructions: e.target.value })}
              onBlur={(e) => save({ optimization_instructions: e.target.value })}
              placeholder="e.g. Shorten the post, add more emojis, change the CTA..."
            />
            <button
              type="button"
              className="mt-3 w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-4 rounded-xl font-bold text-lg hover:from-purple-700 hover:to-indigo-700 shadow-lg shadow-purple-200 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
              disabled={!post.final_version || !post.optimization_instructions || optimizing}
              onClick={() => void handleOptimize()}
            >
              {optimizing ? "⏳ Optimisation en cours…" : "⚡ OPTIMISER CE POST"}
            </button>
          </div>

          <hr className="border-gray-200 my-6" />

          {/* Publish to LinkedIn */}
          {publishError && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm text-red-700 flex justify-between items-center">
              <span>{publishError}</span>
              <button onClick={() => setPublishError(null)} className="ml-3 text-red-400 hover:text-red-600">✕</button>
            </div>
          )}

          {isActuallyPublished ? (
            <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-500" />
                  <span className="text-sm text-green-800 font-medium">Published on LinkedIn</span>
                </div>
                <a
                  href={linkedinPostHref(post.linkedin_post_url!)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium shrink-0"
                >
                  View post &rarr;
                </a>
              </div>
              <button
                type="button"
                onClick={() =>
                  void save(
                    { linkedin_post_url: null, linkedin_post_id: null, status: "Draft" },
                    { successMessage: "Post mis à jour \u2713" }
                  )
                }
                className="text-xs text-gray-500 hover:text-red-600 underline"
              >
                Reset and republish
              </button>
            </div>
          ) : (
            <button
              className="w-full bg-[#0A66C2] text-white py-3 rounded-lg font-medium hover:bg-[#004182] disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!hasPublishableBody(post) || publishing}
              onClick={handlePublish}
            >
              {publishing ? "Publishing..." : "Publish on LinkedIn"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
