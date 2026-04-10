import { useEffect, useRef, useState } from "react";
import { useLinkedInPostsStore } from "../stores/linkedin-posts";

export function LinkedInHistory() {
  const { posts, loading, fetch: fetchPosts, importFile, scrape } = useLinkedInPostsStore();
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [importing, setImporting] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchPosts();
  }, []);

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setError(null);
    try {
      const result = await importFile(file);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
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
      await scrape();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to scrape");
    } finally {
      setScraping(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-4">LinkedIn Post History</h2>
        <div className="flex gap-3">
          <button
            onClick={handleImportClick}
            disabled={importing}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {importing ? "Importing..." : "Import from file"}
          </button>
          <button
            onClick={handleScrape}
            disabled={scraping}
            className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {scraping ? "Scraping..." : "Scrape from LinkedIn"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
        {error && (
          <div className="mt-3 bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
      </div>

      {loading ? (
        <p className="text-gray-400">Loading...</p>
      ) : posts.length === 0 ? (
        <p className="text-gray-500">No LinkedIn posts imported yet.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {posts.map((post) => (
            <div
              key={post.id}
              className="bg-white rounded-lg border border-gray-200 p-4 cursor-pointer hover:border-blue-300 hover:shadow-sm transition"
              onClick={() => setExpandedId(expandedId === post.id ? null : post.id)}
            >
              <p className="text-sm text-gray-600 line-clamp-4">{post.text || "(empty)"}</p>
              <div className="flex gap-3 text-xs text-gray-400 mt-3">
                <span>{post.likes} likes</span>
                <span>{post.comments} comments</span>
              </div>
              {post.published_date && (
                <p className="text-xs text-gray-500 mt-2">
                  {new Date(post.published_date).toLocaleDateString()}
                </p>
              )}

              {expandedId === post.id && (
                <div className="mt-4 pt-4 border-t space-y-2">
                  <p className="text-sm text-gray-800">{post.text}</p>
                  <div className="grid grid-cols-4 gap-2 text-xs">
                    <div className="bg-gray-50 rounded p-2">
                      <p className="text-gray-600">{post.likes}</p>
                      <p className="text-gray-400">Likes</p>
                    </div>
                    <div className="bg-gray-50 rounded p-2">
                      <p className="text-gray-600">{post.comments}</p>
                      <p className="text-gray-400">Comments</p>
                    </div>
                    <div className="bg-gray-50 rounded p-2">
                      <p className="text-gray-600">{post.shares}</p>
                      <p className="text-gray-400">Shares</p>
                    </div>
                    <div className="bg-gray-50 rounded p-2">
                      <p className="text-gray-600">{post.impressions}</p>
                      <p className="text-gray-400">Impressions</p>
                    </div>
                  </div>
                  {post.linkedin_url && (
                    <a
                      href={post.linkedin_url}
                      target="_blank"
                      onClick={(e) => e.stopPropagation()}
                      className="text-xs text-blue-600 hover:text-blue-800 block"
                    >
                      View on LinkedIn
                    </a>
                  )}
                  <p className="text-xs text-gray-400">Source: {post.source}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
