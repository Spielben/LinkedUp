import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { usePostsStore, type Post } from "../stores/posts";
import { useStylesStore } from "../stores/styles";
import { useTemplatesStore } from "../stores/templates";
import { useContenusStore } from "../stores/contenus";
import { apiFetch, apiUrl } from "../lib/api";
import { mediaRowsFromPost } from "../lib/post-media";

// ── Helpers ──────────────────────────────────────────────────────────────────

function getFirstImageUrl(post: Post): string | null {
  const rows = mediaRowsFromPost(post);
  if (rows.length === 0) return null;
  const first = rows[0];
  if (first.kind === "url") return first.ref.trim() || null;
  const ref = first.ref.trim();
  if (!ref) return null;
  return apiUrl(`/${ref.replace(/^\/+/, "")}`);
}

function getPostText(post: Post): string {
  if (post.final_version?.trim()) return post.final_version.trim();
  const sel = post.selected_version?.trim().toUpperCase();
  if (sel === "V1" && post.v1?.trim()) return post.v1.trim();
  if (sel === "V2" && post.v2?.trim()) return post.v2.trim();
  if (sel === "V3" && post.v3?.trim()) return post.v3.trim();
  return "";
}

function formatDate(
  dateStr: string | null,
  opts: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }
): string {
  if (!dateStr) return "—";
  try {
    // SQLite stores as "YYYY-MM-DD HH:MM:SS" — replace space with T for Safari
    return new Date(dateStr.replace(" ", "T")).toLocaleString("fr-FR", opts);
  } catch {
    return dateStr;
  }
}

// ── LinkedIn-style post preview ───────────────────────────────────────────────

function LinkedInPostPreview({
  post,
  authorName,
}: {
  post: Post;
  authorName: string;
}) {
  const text = getPostText(post);
  const imageUrl = getFirstImageUrl(post);
  const [expanded, setExpanded] = useState(false);
  const MAX_CHARS = 300;
  const isLong = text.length > MAX_CHARS;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Profile header */}
      <div className="flex items-start gap-3 p-4 pb-3">
        <div className="w-12 h-12 rounded-full bg-[#0A66C2] flex items-center justify-center text-white font-bold text-lg flex-shrink-0 shadow-sm">
          {authorName.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-gray-900 truncate">
            {authorName}
          </p>
          <p className="text-xs text-gray-500">Phuket, Thailand · Production</p>
          <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
            🗓 {formatDate(post.publication_date)}
            <span className="inline-block w-1 h-1 rounded-full bg-gray-300 mx-1" />
            🌐
          </p>
        </div>
        <button className="ml-auto text-[#0A66C2] text-xs font-semibold border border-[#0A66C2] rounded-full px-3 py-1 hover:bg-blue-50 transition-colors flex-shrink-0">
          + Follow
        </button>
      </div>

      {/* Post text */}
      {text ? (
        <div className="px-4 pb-3">
          <p className="text-sm text-gray-800 whitespace-pre-line leading-relaxed">
            {isLong && !expanded
              ? text.slice(0, MAX_CHARS) + "…"
              : text}
          </p>
          {isLong && (
            <button
              className="text-xs text-gray-500 hover:text-gray-700 mt-1 font-medium"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? "…voir moins" : "…voir plus"}
            </button>
          )}
        </div>
      ) : (
        <div className="px-4 pb-3">
          <p className="text-sm text-gray-400 italic">
            (Aucun contenu — sélectionne ou écris la version finale dans ce post)
          </p>
        </div>
      )}

      {/* Image */}
      {imageUrl && (
        <div className="border-t border-gray-100">
          <img
            src={imageUrl}
            alt="Post media"
            className="w-full object-cover max-h-80"
          />
        </div>
      )}

      {/* Engagement bar (decorative) */}
      <div className="px-4 py-2 border-t border-gray-100 flex gap-1">
        {(["👍 Like", "💬 Comment", "↩ Repost", "✉ Send"] as const).map(
          (label) => (
            <button
              key={label}
              className="flex-1 text-xs text-gray-500 py-1.5 rounded hover:bg-gray-100 transition-colors font-medium"
            >
              {label}
            </button>
          )
        )}
      </div>
    </div>
  );
}

// ── Scheduled post card (grid) ────────────────────────────────────────────────

function ScheduledPostCard({
  post,
  onClick,
}: {
  post: Post;
  onClick: () => void;
}) {
  const text = getPostText(post);
  const imageUrl = getFirstImageUrl(post);

  return (
    <div
      className="bg-white rounded-xl border border-gray-200 overflow-hidden cursor-pointer hover:shadow-md hover:border-teal-300 transition-all group"
      onClick={onClick}
    >
      {/* Thumbnail */}
      {imageUrl ? (
        <div className="w-full h-32 overflow-hidden bg-gray-100">
          <img
            src={imageUrl}
            alt={post.subject || ""}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        </div>
      ) : (
        <div className="w-full h-16 bg-gradient-to-br from-teal-50 to-blue-50 flex items-center justify-center border-b border-gray-100">
          <span className="text-2xl opacity-60">📋</span>
        </div>
      )}

      {/* Content */}
      <div className="p-3">
        <p className="font-semibold text-sm text-gray-900 truncate mb-1">
          {post.subject || "(sans titre)"}
        </p>
        <p className="text-xs text-teal-600 font-medium mb-2 flex items-center gap-1">
          <span>🗓</span>
          {formatDate(post.publication_date, {
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
        {text ? (
          <p className="text-xs text-gray-500 line-clamp-3 leading-relaxed">
            {text}
          </p>
        ) : (
          <p className="text-xs text-gray-400 italic">Contenu non rédigé</p>
        )}
      </div>

      <div className="px-3 pb-3">
        <span className="text-xs text-teal-700 font-medium group-hover:underline">
          Éditer →
        </span>
      </div>
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────

export function Dashboard() {
  const navigate = useNavigate();
  const posts = usePostsStore((s) => s.posts);
  const styles = useStylesStore((s) => s.styles);
  const templates = useTemplatesStore((s) => s.templates);
  const contenus = useContenusStore((s) => s.contenus);

  const fetchPosts = usePostsStore((s) => s.fetch);
  const fetchStyles = useStylesStore((s) => s.fetch);
  const fetchTemplates = useTemplatesStore((s) => s.fetch);
  const fetchContenus = useContenusStore((s) => s.fetch);

  const [authorName, setAuthorName] = useState("Spielben & Co");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);

  useEffect(() => {
    fetchPosts();
    fetchStyles();
    fetchTemplates();
    fetchContenus();
  }, []);

  // Fetch author name from settings
  useEffect(() => {
    void (async () => {
      try {
        const res = await apiFetch("/api/settings");
        const data = (await res.json()) as { name?: string | null };
        if (data.name?.trim()) setAuthorName(data.name.trim());
      } catch {
        /* keep default */
      }
    })();
  }, []);

  const cards = [
    { label: "Posts", count: posts.length, href: "/posts", color: "text-blue-600" },
    { label: "Styles", count: styles.length, href: "/styles", color: "text-purple-600" },
    { label: "Templates", count: templates.length, href: "/templates", color: "text-orange-600" },
    { label: "Contenus", count: contenus.length, href: "/contenus", color: "text-green-600" },
  ];

  const published = posts.filter((p) => p.status === "Publié" || p.status === "Publie").length;
  const drafts = posts.filter((p) => p.status === "Brouillon").length;

  // Scheduled posts sorted by publication_date ascending
  const scheduledPosts = posts
    .filter((p) => p.status === "Programmé")
    .sort((a, b) => {
      if (!a.publication_date) return 1;
      if (!b.publication_date) return -1;
      return a.publication_date.localeCompare(b.publication_date);
    });

  const scheduled = scheduledPosts.length;
  const nextThree = scheduledPosts.slice(0, 3);

  const openPreview = () => {
    setPreviewIndex(0);
    setPreviewOpen(true);
  };

  const closePreview = () => setPreviewOpen(false);

  const prevPost = () => setPreviewIndex((i) => Math.max(0, i - 1));
  const nextPost = () =>
    setPreviewIndex((i) => Math.min(scheduledPosts.length - 1, i + 1));

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Dashboard</h2>

      {/* ── Summary cards ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map(({ label, count, href, color }) => (
          <a
            key={label}
            href={href}
            className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow"
          >
            <p className={`text-3xl font-bold ${color}`}>{count}</p>
            <p className="text-sm text-gray-500 mt-1">{label}</p>
          </a>
        ))}
      </div>

      {/* ── Post Status ────────────────────────────────────────────────────── */}
      {posts.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <h3 className="font-medium mb-3">Post Status</h3>
          <div className="flex flex-wrap gap-6 text-sm">
            <button
              onClick={() => navigate("/posts?status=Publié")}
              className="text-green-600 hover:text-green-800 hover:underline cursor-pointer"
            >
              {published} published
            </button>

            {/* Scheduled → open preview modal */}
            <button
              onClick={scheduled > 0 ? openPreview : () => navigate("/posts?status=Programmé")}
              className="text-teal-600 hover:text-teal-800 hover:underline cursor-pointer flex items-center gap-1"
            >
              {scheduled} scheduled
              {scheduled > 0 && (
                <span className="text-xs bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded-full font-medium">
                  aperçu
                </span>
              )}
            </button>

            <button
              onClick={() => navigate("/posts?status=Brouillon")}
              className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
            >
              {drafts} drafts
            </button>
            <button
              onClick={() => navigate("/posts?status=Idée")}
              className="text-yellow-600 hover:text-yellow-800 hover:underline cursor-pointer"
            >
              {posts.length - published - scheduled - drafts} ideas
            </button>
          </div>
        </div>
      )}

      {/* ── Grid : 3 prochains posts programmés ───────────────────────────── */}
      {nextThree.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-700">
              Prochains posts programmés
            </h3>
            {scheduledPosts.length > 3 && (
              <button
                onClick={() => navigate("/posts?status=Programmé")}
                className="text-xs text-teal-600 hover:text-teal-800 hover:underline"
              >
                Voir tous ({scheduledPosts.length}) →
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {nextThree.map((post) => (
              <ScheduledPostCard
                key={post.id}
                post={post}
                onClick={() => navigate(`/posts/${post.id}`)}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Modal : LinkedIn preview ───────────────────────────────────────── */}
      {previewOpen && scheduledPosts.length > 0 && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={closePreview}
        >
          <div
            className="bg-gray-50 rounded-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 sticky top-0 bg-gray-50 z-10 rounded-t-2xl">
              <div>
                <h3 className="font-semibold text-gray-900">
                  Aperçu LinkedIn
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Comme si c'était publié
                </p>
              </div>

              <div className="flex items-center gap-3">
                {/* Navigation between scheduled posts */}
                {scheduledPosts.length > 1 && (
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <button
                      onClick={prevPost}
                      disabled={previewIndex === 0}
                      className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      ‹
                    </button>
                    <span className="font-medium tabular-nums">
                      {previewIndex + 1}&thinsp;/&thinsp;{scheduledPosts.length}
                    </span>
                    <button
                      onClick={nextPost}
                      disabled={previewIndex === scheduledPosts.length - 1}
                      className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      ›
                    </button>
                  </div>
                )}
                <button
                  onClick={closePreview}
                  className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors text-lg"
                >
                  ×
                </button>
              </div>
            </div>

            {/* Preview content */}
            <div className="p-5">
              <LinkedInPostPreview
                post={scheduledPosts[previewIndex]}
                authorName={authorName}
              />

              {/* Subject label */}
              <p className="mt-3 text-xs text-gray-400 text-center truncate px-2">
                {scheduledPosts[previewIndex].subject || "(sans titre)"}
              </p>

              {/* Action buttons */}
              <div className="mt-4 flex items-center justify-between">
                <button
                  onClick={closePreview}
                  className="text-xs text-gray-400 hover:text-gray-600"
                >
                  Fermer
                </button>
                <button
                  onClick={() => {
                    navigate(`/posts/${scheduledPosts[previewIndex].id}`);
                    closePreview();
                  }}
                  className="text-sm text-white bg-[#0A66C2] hover:bg-[#004182] px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  Éditer ce post →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
