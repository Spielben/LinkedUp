import { useEffect, useRef, useState } from "react";
import { useLinkedInPostsStore } from "../stores/linkedin-posts";

export function LinkedInHistory() {
  const { posts, loading, fetch: fetchPosts, importFile, scrape, remove } = useLinkedInPostsStore();
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [importing, setImporting] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchPosts();
  }, []);

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
      setMessage(`Scraped ${result.imported} new posts (${result.profilesScanned} profile runs)`);
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

  const statusBadge = (status: string) =>
    `px-2 py-0.5 rounded-full text-xs font-medium ${
      status === "published" ? "bg-green-100 text-green-800" :
      status === "draft"     ? "bg-yellow-100 text-yellow-800" :
                               "bg-gray-100 text-gray-800"
    }`;

  const filtered = (filterStatus === "all" ? posts : posts.filter((p) => p.status === filterStatus))
    .slice()
    .sort((a, b) => {
      const da = a.published_date ?? "";
      const db = b.published_date ?? "";
      if (da === db) return 0;
      if (!da) return 1;
      if (!db) return -1;
      return sortDir === "desc" ? db.localeCompare(da) : da.localeCompare(db);
    });

  return (
    <div className="max-w-7xl mx-auto">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
        <h2 className="text-xl sm:text-2xl font-bold shrink-0">
          LinkedIn Posts ({posts.length})
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
        {["all", "published", "draft", "idea"].map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
              filterStatus === s ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {s === "all"
              ? `All (${posts.length})`
              : `${s} (${posts.filter((p) => p.status === s).length})`}
          </button>
        ))}

        {/* Sort — pushed to the right on wide screens, wraps naturally on mobile */}
        <div className="flex items-center gap-1 sm:ml-auto">
          <span className="text-xs text-gray-500 hidden xs:inline">Date:</span>
          <button
            onClick={() => setSortDir("desc")}
            className={`px-2.5 py-1 rounded text-xs font-medium transition ${
              sortDir === "desc" ? "bg-gray-700 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
            title="Newest first"
          >
            ↓ Newest
          </button>
          <button
            onClick={() => setSortDir("asc")}
            className={`px-2.5 py-1 rounded text-xs font-medium transition ${
              sortDir === "asc" ? "bg-gray-700 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
            title="Oldest first"
          >
            ↑ Oldest
          </button>
        </div>
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

      {/* ── Content ── */}
      {loading ? (
        <p className="text-gray-400 py-8 text-center">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="text-gray-500 py-8 text-center">No posts found.</p>
      ) : viewMode === "grid" ? (

        /* Grid view — 1 col mobile / 2 tablet / 3 desktop */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          {filtered.map((post) => (
            <div
              key={post.id}
              className="bg-white rounded-lg border border-gray-200 overflow-hidden cursor-pointer hover:border-blue-300 hover:shadow-sm transition"
              onClick={() => setExpandedId(expandedId === post.id ? null : post.id)}
            >
              {post.image_url && (
                <img
                  src={post.image_url}
                  alt={post.subject || "Post image"}
                  className="w-full h-36 sm:h-40 object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              )}
              <div className="p-3 sm:p-4">
                {post.subject && (
                  <h3 className="font-medium text-sm line-clamp-2 mb-2">{post.subject}</h3>
                )}
                {post.text ? (
                  <p className="text-xs text-gray-600 line-clamp-3">{post.text}</p>
                ) : post.description ? (
                  <p className="text-xs text-gray-500 line-clamp-3 italic">{post.description}</p>
                ) : null}
                <div className="flex items-center justify-between mt-3 gap-2">
                  <div className="flex flex-wrap gap-2 text-xs text-gray-400 min-w-0">
                    {post.likes > 0 && <span>{post.likes} likes</span>}
                    {post.comments > 0 && <span>{post.comments} comments</span>}
                    {post.published_date && (
                      <span className="truncate">{post.published_date}</span>
                    )}
                  </div>
                  <span className={statusBadge(post.status)}>{post.status}</span>
                </div>

                {expandedId === post.id && (
                  <div className="mt-4 pt-4 border-t space-y-3">
                    {post.text && (
                      <p className="text-sm text-gray-800 whitespace-pre-line">{post.text}</p>
                    )}
                    {post.first_comment && (
                      <div>
                        <p className="text-xs font-medium text-gray-600 mb-1">First comment:</p>
                        <p className="text-xs text-gray-600 whitespace-pre-line">{post.first_comment}</p>
                      </div>
                    )}
                    <div className="flex gap-2 items-center">
                      {post.linkedin_url && (
                        <a
                          href={post.linkedin_url}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-xs text-blue-600 hover:text-blue-800"
                        >
                          View on LinkedIn
                        </a>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); void handleDelete(post.id); }}
                        className="text-xs text-red-600 hover:bg-red-50 px-2 py-1 rounded-lg ml-auto"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

      ) : (

        /* List view */
        <div className="grid gap-2 md:gap-3">
          {filtered.map((post) => (
            <div
              key={post.id}
              className="bg-white rounded-lg border border-gray-200 p-3 sm:p-4 cursor-pointer hover:border-blue-200 transition"
              onClick={() => setExpandedId(expandedId === post.id ? null : post.id)}
            >
              <div className="flex gap-3 items-start">
                {post.image_url && (
                  <img
                    src={post.image_url}
                    alt=""
                    className="w-12 h-12 sm:w-16 sm:h-16 object-cover rounded shrink-0"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      {post.subject && (
                        <h3 className="font-medium text-sm truncate">{post.subject}</h3>
                      )}
                      {post.text ? (
                        <p className="text-xs text-gray-600 line-clamp-2 mt-0.5">{post.text}</p>
                      ) : post.description ? (
                        <p className="text-xs text-gray-500 line-clamp-2 mt-0.5 italic">{post.description}</p>
                      ) : null}
                      {post.published_date && (
                        <p className="text-xs text-gray-400 mt-1">{post.published_date}</p>
                      )}
                    </div>
                    <div className="flex flex-col sm:flex-row items-end sm:items-center gap-1.5 shrink-0">
                      <span className={statusBadge(post.status)}>{post.status}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); void handleDelete(post.id); }}
                        className="px-2 py-0.5 text-xs text-red-600 hover:bg-red-50 rounded-lg"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  {/* Engagement row — hidden on very small screens */}
                  {(post.likes > 0 || post.comments > 0) && (
                    <div className="hidden sm:flex gap-3 mt-1.5 text-xs text-gray-400">
                      {post.likes > 0 && <span>{post.likes} likes</span>}
                      {post.comments > 0 && <span>{post.comments} comments</span>}
                    </div>
                  )}
                </div>
              </div>

              {expandedId === post.id && (
                <div className="mt-3 pt-3 border-t space-y-2">
                  {post.text && (
                    <p className="text-sm text-gray-800 whitespace-pre-line">{post.text}</p>
                  )}
                  {post.first_comment && (
                    <p className="text-xs text-gray-600 italic">{post.first_comment}</p>
                  )}
                  {post.linkedin_url && (
                    <a
                      href={post.linkedin_url}
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
          ))}
        </div>
      )}
    </div>
  );
}
