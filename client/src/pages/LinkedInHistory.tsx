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

  const filtered = filterStatus === "all" ? posts : posts.filter((p) => p.status === filterStatus);

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">LinkedIn Posts ({posts.length})</h2>
        <div className="flex gap-2 items-center">
          <div className="flex border border-gray-300 rounded-lg overflow-hidden mr-2">
            <button onClick={() => setViewMode("list")} className={`px-2 py-1.5 text-xs ${viewMode === "list" ? "bg-gray-200 font-medium" : "hover:bg-gray-50"}`} title="List view">
              ☰
            </button>
            <button onClick={() => setViewMode("grid")} className={`px-2 py-1.5 text-xs ${viewMode === "grid" ? "bg-gray-200 font-medium" : "hover:bg-gray-50"}`} title="Grid view">
              ▦
            </button>
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing || scraping}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {importing ? "Importing..." : "Import from file"}
          </button>
          <button
            type="button"
            onClick={() => void handleScrape()}
            disabled={importing || scraping}
            className="bg-[#0A66C2] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#004182] disabled:opacity-50"
          >
            {scraping ? "Scraping..." : "Scrape from LinkedIn"}
          </button>
          <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileSelect} className="hidden" />
        </div>
      </div>

      {/* Status filter */}
      <div className="flex flex-wrap gap-2 mb-4">
        {["all", "published", "draft", "idea"].map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
              filterStatus === s ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {s === "all" ? `All (${posts.length})` : `${s} (${posts.filter((p) => p.status === s).length})`}
          </button>
        ))}
      </div>

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

      {loading ? (
        <p className="text-gray-400">Loading...</p>
      ) : filtered.length === 0 ? (
        <p className="text-gray-500">No posts found.</p>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                  className="w-full h-40 object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              )}
              <div className="p-4">
                {post.subject && (
                  <h3 className="font-medium text-sm line-clamp-2 mb-2">{post.subject}</h3>
                )}
                {post.text ? (
                  <p className="text-xs text-gray-600 line-clamp-3">{post.text}</p>
                ) : post.description ? (
                  <p className="text-xs text-gray-500 line-clamp-3 italic">{post.description}</p>
                ) : null}
                <div className="flex items-center justify-between mt-3">
                  <div className="flex gap-3 text-xs text-gray-400 flex-wrap">
                    {post.likes > 0 && <span>{post.likes} likes</span>}
                    {post.comments > 0 && <span>{post.comments} comments</span>}
                    {post.published_date && <span>{post.published_date}</span>}
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    post.status === "published" ? "bg-green-100 text-green-800" :
                    post.status === "draft" ? "bg-yellow-100 text-yellow-800" :
                    "bg-gray-100 text-gray-800"
                  }`}>
                    {post.status}
                  </span>
                </div>

                {expandedId === post.id && (
                  <div className="mt-4 pt-4 border-t space-y-3">
                    {post.text && <p className="text-sm text-gray-800 whitespace-pre-line">{post.text}</p>}
                    {post.first_comment && (
                      <div>
                        <p className="text-xs font-medium text-gray-600 mb-1">First comment:</p>
                        <p className="text-xs text-gray-600 whitespace-pre-line">{post.first_comment}</p>
                      </div>
                    )}
                    <div className="flex gap-2">
                      {post.linkedin_url && (
                        <a href={post.linkedin_url} target="_blank" onClick={(e) => e.stopPropagation()} className="text-xs text-blue-600 hover:text-blue-800">
                          View on LinkedIn
                        </a>
                      )}
                      <button onClick={(e) => { e.stopPropagation(); handleDelete(post.id); }} className="text-xs text-red-600 hover:bg-red-50 px-2 py-1 rounded-lg ml-auto">
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
        <div className="grid gap-3">
          {filtered.map((post) => (
            <div key={post.id} className="bg-white rounded-lg border border-gray-200 p-4 cursor-pointer" onClick={() => setExpandedId(expandedId === post.id ? null : post.id)}>
              <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0 flex gap-3">
                  {post.image_url && (
                    <img src={post.image_url} alt="" className="w-16 h-16 object-cover rounded shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  )}
                  <div className="min-w-0">
                    {post.subject && <h3 className="font-medium text-sm truncate">{post.subject}</h3>}
                    {post.text ? (
                      <p className="text-xs text-gray-600 line-clamp-2 mt-1">{post.text}</p>
                    ) : post.description ? (
                      <p className="text-xs text-gray-500 line-clamp-2 mt-1 italic">{post.description}</p>
                    ) : null}
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4 shrink-0">
                  {post.likes > 0 && <span className="text-xs text-gray-400">{post.likes} likes</span>}
                  {post.comments > 0 && <span className="text-xs text-gray-400">{post.comments} comments</span>}
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    post.status === "published" ? "bg-green-100 text-green-800" :
                    post.status === "draft" ? "bg-yellow-100 text-yellow-800" :
                    "bg-gray-100 text-gray-800"
                  }`}>{post.status}</span>
                  <button onClick={(e) => { e.stopPropagation(); handleDelete(post.id); }} className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded-lg">
                    Delete
                  </button>
                </div>
              </div>
              {expandedId === post.id && (
                <div className="mt-4 pt-4 border-t space-y-2">
                  {post.text && <p className="text-sm text-gray-800 whitespace-pre-line">{post.text}</p>}
                  {post.first_comment && <p className="text-xs text-gray-600 italic mt-2">{post.first_comment}</p>}
                  {post.linkedin_url && (
                    <a href={post.linkedin_url} target="_blank" onClick={(e) => e.stopPropagation()} className="text-xs text-blue-600 block">View on LinkedIn</a>
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
