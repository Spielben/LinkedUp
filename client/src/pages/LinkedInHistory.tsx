import { useEffect, useRef, useState } from "react";
import { useLinkedInPostsStore } from "../stores/linkedin-posts";
import { usePostsStore, type Post } from "../stores/posts";
import { apiUrl } from "../lib/api";
import { mediaRowsFromPost } from "../lib/post-media";

// ── Types ─────────────────────────────────────────────────────────────────────

interface UnifiedPost {
  key: string;
  source: "linkdup" | "scraped";
  subject: string | null;
  text: string;
  imageUrl: string | null;
  sortDate: string;       // for sorting (raw, comparable)
  displayDate: string;    // formatted for display
  status: string;         // "published" | "draft" | "idea" | …
  linkedinUrl: string | null;
  likes: number;
  comments: number;
  isRepost: boolean;
  firstComment: string | null;
  // originals — for delete + edit link
  scrapedId?: number;
  linkdupPost?: Post;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getPublishedText(post: Post): string {
  if (post.final_version?.trim()) return post.final_version.trim();
  const sel = post.selected_version?.trim().toUpperCase();
  if (sel === "V1" && post.v1?.trim()) return post.v1.trim();
  if (sel === "V2" && post.v2?.trim()) return post.v2.trim();
  if (sel === "V3" && post.v3?.trim()) return post.v3.trim();
  return "";
}

function getPublishedImage(post: Post): string | null {
  const rows = mediaRowsFromPost(post);
  if (!rows[0]) return null;
  const r = rows[0];
  return r.kind === "url"
    ? r.ref.trim() || null
    : apiUrl(`/${r.ref.trim().replace(/^\/+/, "")}`);
}

function formatDateDisplay(raw: string | null | undefined): string {
  if (!raw) return "";
  try {
    const d = new Date(raw.includes("T") ? raw : raw.replace(" ", "T") + "Z");
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return raw;
  }
}

const statusBadgeClass = (status: string) =>
  `px-2 py-0.5 rounded-full text-xs font-medium ${
    status === "published" || status === "Published"
      ? "bg-green-100 text-green-800"
      : status === "draft" || status === "Draft"
      ? "bg-blue-100 text-blue-800"
      : "bg-gray-100 text-gray-800"
  }`;

// ── Main component ────────────────────────────────────────────────────────────

export function LinkedInHistory() {
  const { posts: scrapedPosts, loading, fetch: fetchScraped, importFile, scrape, remove } =
    useLinkedInPostsStore();
  const allPosts = usePostsStore((s) => s.posts);
  const fetchAllPosts = usePostsStore((s) => s.fetch);

  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [importing, setImporting]     = useState(false);
  const [scraping, setScraping]       = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [message, setMessage]         = useState<string | null>(null);
  const [viewMode, setViewMode]       = useState<"grid" | "list">("grid");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [sortDir, setSortDir]         = useState<"desc" | "asc">("desc");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchScraped();
    fetchAllPosts();
  }, []);

  // ── Build unified list ────────────────────────────────────────────────────

  const linkdupUnified: UnifiedPost[] = allPosts
    .filter((p) => p.status === "Published")
    .map((p) => ({
      key: `linkdup-${p.id}`,
      source: "linkdup" as const,
      subject: p.subject || null,
      text: getPublishedText(p),
      imageUrl: getPublishedImage(p),
      sortDate: p.publication_date || p.created_at || "",
      displayDate: formatDateDisplay(p.publication_date || p.created_at),
      status: "published",
      linkedinUrl: p.linkedin_post_url || null,
      likes: 0,
      comments: 0,
      isRepost: false,
      firstComment: null,
      linkdupPost: p,
    }));

  const scrapedUnified: UnifiedPost[] = scrapedPosts.map((p) => ({
    key: `scraped-${p.id}`,
    source: "scraped" as const,
    subject: p.subject || null,
    text: (p.text || p.description || p.subject || "").trim(),
    imageUrl: p.image_url || null,
    sortDate: p.published_date || "",
    displayDate: formatDateDisplay(p.published_date),
    status: p.status || "unknown",
    linkedinUrl: p.linkedin_url || null,
    likes: p.likes ?? 0,
    comments: p.comments ?? 0,
    isRepost: p.is_repost === true || p.is_repost === 1 || Number(p.is_repost) === 1,
    firstComment: p.first_comment || null,
    scrapedId: p.id,
  }));

  // ── Counts for filter buttons ─────────────────────────────────────────────

  const counts = {
    all: linkdupUnified.length + scrapedUnified.length,
    published: linkdupUnified.length + scrapedUnified.filter((p) => p.status === "published").length,
    draft: scrapedUnified.filter((p) => p.status === "draft").length,
    idea: scrapedUnified.filter((p) => p.status === "idea").length,
  };

  // ── Apply filter ──────────────────────────────────────────────────────────

  let filtered: UnifiedPost[];
  if (filterStatus === "all") {
    filtered = [...linkdupUnified, ...scrapedUnified];
  } else if (filterStatus === "published") {
    filtered = [
      ...linkdupUnified,
      ...scrapedUnified.filter((p) => p.status === "published"),
    ];
  } else {
    // draft / idea / other — scraped only
    filtered = scrapedUnified.filter((p) => p.status === filterStatus);
  }

  // ── Sort ──────────────────────────────────────────────────────────────────

  filtered = filtered.slice().sort((a, b) => {
    const da = a.sortDate;
    const db = b.sortDate;
    if (da === db) return 0;
    if (!da) return 1;
    if (!db) return -1;
    return sortDir === "desc" ? db.localeCompare(da) : da.localeCompare(db);
  });

  // ── Actions ───────────────────────────────────────────────────────────────

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setError(null);
    try {
      const result = await importFile(file);
      setMessage(`Imported ${result.imported} posts, ${result.duplicates || 0} duplicates skipped`);
      setTimeout(() => setMessage(null), 5000);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to import");
    } finally {
      setImporting(false);
    }
  };

  const handleScrape = async () => {
    setScraping(true);
    setError(null);
    try {
      const result = await scrape();
      const dup   = result.skippedDuplicates ?? 0;
      const noTxt = result.skippedNoText ?? 0;
      const err   = result.skippedErrors ?? 0;
      setMessage(
        `Scrape: ${result.imported} new · ${dup} already in DB · ${noTxt} no text · ${err} errors · ${result.postsProcessed ?? 0} items processed`
      );
      setTimeout(() => setMessage(null), 6000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Scrape failed");
    } finally {
      setScraping(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm("Delete this post?")) {
      await remove(id);
    }
  };

  // ── Render a single card (grid or list) ──────────────────────────────────

  function GridCard({ post }: { post: UnifiedPost }) {
    const isExpanded = expandedKey === post.key;
    return (
      <div
        className={`bg-white rounded-lg border overflow-hidden cursor-pointer hover:shadow-sm transition ${
          post.source === "linkdup"
            ? "border-green-200 hover:border-green-400"
            : "border-gray-200 hover:border-blue-300"
        }`}
        onClick={() => setExpandedKey(isExpanded ? null : post.key)}
      >
        {post.imageUrl && (
          <img
            src={post.imageUrl}
            alt={post.subject || "Post image"}
            className="w-full h-36 sm:h-40 object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        )}
        <div className="p-3 sm:p-4 min-h-[7rem]">
          {post.subject && (
            <h3 className="font-medium text-sm line-clamp-2 mb-1.5">{post.subject}</h3>
          )}
          {post.text ? (
            <p className="text-sm text-gray-700 leading-relaxed line-clamp-8 whitespace-pre-line break-words">
              {post.text}
            </p>
          ) : (
            <p className="text-xs text-gray-400 italic">No preview text</p>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between mt-3 gap-2 flex-wrap">
            <div className="flex flex-wrap gap-2 text-xs text-gray-400 min-w-0 items-center">
              {post.isRepost && (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-900 shrink-0">
                  Repost
                </span>
              )}
              {post.source === "linkdup" && (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200 shrink-0">
                  via LinkDup
                </span>
              )}
              {post.likes > 0 && <span>{post.likes} likes</span>}
              {post.comments > 0 && <span>{post.comments} comments</span>}
              {post.displayDate && <span>{post.displayDate}</span>}
            </div>
            <span className={statusBadgeClass(post.status)}>{post.status}</span>
          </div>

          {/* Expanded section */}
          {isExpanded && (
            <div className="mt-4 pt-4 border-t space-y-3">
              {post.firstComment && (
                <div>
                  <p className="text-xs font-medium text-gray-600 mb-1">First comment:</p>
                  <p className="text-xs text-gray-600 whitespace-pre-line">{post.firstComment}</p>
                </div>
              )}
              <div className="flex gap-2 items-center">
                {post.linkedinUrl && (
                  <a
                    href={post.linkedinUrl}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-xs text-blue-600 hover:text-blue-800"
                  >
                    View on LinkedIn
                  </a>
                )}
                {post.source === "scraped" && post.scrapedId !== undefined && (
                  <button
                    onClick={(e) => { e.stopPropagation(); void handleDelete(post.scrapedId!); }}
                    className="text-xs text-red-600 hover:bg-red-50 px-2 py-1 rounded-lg ml-auto"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  function ListRow({ post }: { post: UnifiedPost }) {
    const isExpanded = expandedKey === post.key;
    return (
      <div
        className={`bg-white rounded-lg border p-3 sm:p-4 cursor-pointer transition ${
          post.source === "linkdup"
            ? "border-green-200 hover:border-green-400"
            : "border-gray-200 hover:border-blue-200"
        }`}
        onClick={() => setExpandedKey(isExpanded ? null : post.key)}
      >
        <div className="flex gap-3 items-start">
          {post.imageUrl && (
            <img
              src={post.imageUrl}
              alt=""
              className="w-12 h-12 sm:w-14 sm:h-14 object-cover rounded shrink-0"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          )}
          <div className="flex-1 min-w-0">
            {post.subject && (
              <h3 className="font-medium text-sm leading-snug line-clamp-2 pr-1">{post.subject}</h3>
            )}
            {post.text ? (
              <p className="text-sm text-gray-700 leading-relaxed line-clamp-4 mt-1 whitespace-pre-line break-words">
                {post.text}
              </p>
            ) : (
              <p className="text-xs text-gray-400 italic mt-1">No preview text</p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-2 pt-2 border-t border-gray-100">
          {post.isRepost && (
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-900 shrink-0">
              Repost
            </span>
          )}
          {post.source === "linkdup" && (
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200 shrink-0">
              via LinkDup
            </span>
          )}
          {post.displayDate && (
            <span className="text-xs text-gray-400">{post.displayDate}</span>
          )}
          {post.likes > 0 && (
            <span className="text-xs text-gray-400">{post.likes} likes</span>
          )}
          {post.comments > 0 && (
            <span className="text-xs text-gray-400">{post.comments} comments</span>
          )}
          <span className={`${statusBadgeClass(post.status)} ml-auto`}>{post.status}</span>
          {post.source === "scraped" && post.scrapedId !== undefined && (
            <button
              onClick={(e) => { e.stopPropagation(); void handleDelete(post.scrapedId!); }}
              className="px-2 py-0.5 text-xs text-red-600 hover:bg-red-50 rounded-lg"
            >
              Delete
            </button>
          )}
        </div>

        {isExpanded && (
          <div className="mt-3 pt-3 border-t space-y-2">
            {post.firstComment && (
              <p className="text-xs text-gray-600 italic">{post.firstComment}</p>
            )}
            {post.linkedinUrl && (
              <a
                href={post.linkedinUrl}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-xs text-blue-600 block"
              >
                View on LinkedIn
              </a>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-7xl mx-auto">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
        <h2 className="text-xl sm:text-2xl font-bold shrink-0">
          LinkedIn Posts ({counts.all})
        </h2>
        <div className="flex flex-wrap gap-2 sm:ml-auto items-center">
          {/* View toggle */}
          <div className="flex border border-gray-300 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode("list")}
              className={`px-2.5 py-1.5 text-xs ${viewMode === "list" ? "bg-gray-200 font-medium" : "hover:bg-gray-50"}`}
              title="List view"
            >☰</button>
            <button
              onClick={() => setViewMode("grid")}
              className={`px-2.5 py-1.5 text-xs ${viewMode === "grid" ? "bg-gray-200 font-medium" : "hover:bg-gray-50"}`}
              title="Grid view"
            >▦</button>
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing || scraping}
            className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
          >
            {importing ? "Importing…" : "Import from file"}
          </button>
          <button
            type="button"
            onClick={() => void handleScrape()}
            disabled={importing || scraping}
            className="bg-[#0A66C2] text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-[#004182] disabled:opacity-50 whitespace-nowrap"
          >
            {scraping ? "Scraping…" : "Scrape from LinkedIn"}
          </button>
          <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileSelect} className="hidden" />
        </div>
      </div>

      {/* ── Filters + Sort ── */}
      <div className="flex flex-wrap gap-2 mb-4 items-center">
        {(["all", "published", "draft", "idea"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
              filterStatus === s ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {s === "all"
              ? `All (${counts.all})`
              : `${s.charAt(0).toUpperCase() + s.slice(1)} (${counts[s]})`}
          </button>
        ))}

        <button
          onClick={() => setSortDir(sortDir === "desc" ? "asc" : "desc")}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition sm:ml-auto"
          title={sortDir === "desc" ? "Newest first — click to reverse" : "Oldest first — click to reverse"}
        >
          <span>Date</span>
          <span className="text-sm leading-none">{sortDir === "desc" ? "↓" : "↑"}</span>
          <span className="text-gray-500">{sortDir === "desc" ? "Newest" : "Oldest"}</span>
        </button>
      </div>

      {/* ── Alerts ── */}
      {error && (
        <div className="mb-3 bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm text-red-700 flex justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-3 text-red-400 hover:text-red-600">✕</button>
        </div>
      )}
      {message && (
        <div className="mb-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 text-sm text-blue-700">
          {message}
        </div>
      )}

      <details className="mb-4 text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
        <summary className="cursor-pointer font-medium text-gray-700">How LinkedIn scrape works</summary>
        <ul className="mt-2 list-disc list-inside space-y-1 pl-1">
          <li>Posts are fetched from Apify (your profile URL in Settings).</li>
          <li>Each post is saved with <code className="bg-gray-200 px-1 rounded">INSERT OR IGNORE</code> on <code className="bg-gray-200 px-1 rounded">linkedin_url</code> — same URL already in the DB is skipped.</li>
          <li>Items with no extractable caption are skipped.</li>
          <li>Re-running scrape only adds new URLs; it does not refresh metrics on existing rows.</li>
        </ul>
      </details>

      {/* ── Unified feed ── */}
      {loading ? (
        <p className="text-gray-400 py-8 text-center">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="text-gray-500 py-8 text-center">No posts found.</p>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          {filtered.map((post) => <GridCard key={post.key} post={post} />)}
        </div>
      ) : (
        <div className="grid gap-2 md:gap-3">
          {filtered.map((post) => <ListRow key={post.key} post={post} />)}
        </div>
      )}
    </div>
  );
}
