import { useEffect, useRef, useState } from "react";
import { useStylesStore } from "../stores/styles";
import { importFile } from "../lib/import-file";
import { apiFetch } from "../lib/api";

export function StylesList() {
  const { styles, loading, fetch: fetchStyles, create: createStyle, remove: deleteStyle } = useStylesStore();
  const [generatingId, setGeneratingId] = useState<number | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: "", linkedin_url: "", examples: "" });
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchStyles();
  }, []);

  const handleGenerate = async (id: number) => {
    setGeneratingId(id);
    setGenerateError(null);
    try {
      const res = await apiFetch(`/api/styles/${id}/generate`, { method: "POST" });
      if (!res.ok) throw new Error((await res.json()).error);
      await fetchStyles();
    } catch (err: unknown) {
      setGenerateError(err instanceof Error ? err.message : String(err));
    } finally {
      setGeneratingId(null);
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm("Delete this style?")) {
      await deleteStyle(id);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    await createStyle(formData);
    setFormData({ name: "", linkedin_url: "", examples: "" });
    setShowForm(false);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportMessage(null);

    try {
      const data = await importFile(file, "styles");
      setImportMessage(`Imported ${data.imported} styles, skipped ${data.skipped}`);
      await fetchStyles();
      if (fileInputRef.current) fileInputRef.current.value = "";
      setTimeout(() => setImportMessage(null), 4000);
    } catch (err: unknown) {
      setImportMessage(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Styles ({styles.length})</h2>
        <div className="flex gap-2 items-center">
          <div className="flex border border-gray-300 rounded-lg overflow-hidden mr-2">
            <button
              onClick={() => setViewMode("list")}
              className={`px-2 py-1.5 text-xs ${viewMode === "list" ? "bg-gray-200 font-medium" : "hover:bg-gray-50"}`}
              title="List view"
            >
              ☰
            </button>
            <button
              onClick={() => setViewMode("grid")}
              className={`px-2 py-1.5 text-xs ${viewMode === "grid" ? "bg-gray-200 font-medium" : "hover:bg-gray-50"}`}
              title="Grid view"
            >
              ▦
            </button>
          </div>
          <button
            className="bg-gray-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-700 disabled:opacity-50"
            disabled={importing}
            onClick={() => fileInputRef.current?.click()}
          >
            {importing ? "Importing..." : "Import CSV"}
          </button>
          <button
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
            onClick={() => setShowForm(!showForm)}
          >
            + New Style
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.json"
            onChange={handleImport}
            className="hidden"
          />
        </div>
      </div>

      {/* ── How Styles work ── */}
      <details className="mb-4 text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
        <summary className="cursor-pointer font-medium text-gray-700">What is a Style?</summary>
        <div className="mt-2 space-y-1.5 pl-1">
          <p>A Style captures a <strong>writing voice</strong> — yours, a colleague's, or a creator you admire. Once generated, the AI will imitate that voice when drafting your posts.</p>
          <p><strong>How to use it:</strong> Create a style → paste example posts or link a LinkedIn profile → click <em>Generate</em> to let the AI analyze the tone, vocabulary and rhythm → attach the style when creating a post.</p>
          <p><strong>Status "generated"</strong> means the style analysis is ready and will be injected into the writing prompt.</p>
        </div>
      </details>

      {importMessage && (
        <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 text-sm text-blue-700">
          {importMessage}
        </div>
      )}

      {showForm && (
        <div className="mb-6 bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="font-medium mb-1">Create New Style</h3>
          <p className="text-xs text-gray-500 mb-4">Give the AI a writing voice to imitate. You need at least one of: example posts or a LinkedIn profile URL.</p>
          <form onSubmit={handleCreateSubmit} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <p className="text-xs text-gray-400 mb-1">A label to identify this voice (e.g. "My style", "Thomas Ledoux", "Casual expert").</p>
              <input
                type="text"
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">LinkedIn URL (optional)</label>
              <p className="text-xs text-gray-400 mb-1">Link to a LinkedIn profile. The scraper will pull recent posts from this account to analyze.</p>
              <input
                type="url"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={formData.linkedin_url}
                onChange={(e) => setFormData({ ...formData, linkedin_url: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Examples (optional)</label>
              <p className="text-xs text-gray-400 mb-1">Paste 2–5 LinkedIn posts written in the style you want to replicate. The more varied the examples, the better the analysis.</p>
              <textarea
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                rows={4}
                value={formData.examples}
                onChange={(e) => setFormData({ ...formData, examples: e.target.value })}
                placeholder="Paste LinkedIn posts to analyze..."
              />
            </div>
            <div className="flex gap-2">
              <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
                Create
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setFormData({ name: "", linkedin_url: "", examples: "" }); }}
                className="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <p className="text-gray-400">Loading...</p>
      ) : styles.length === 0 ? (
        <p className="text-gray-500">No styles yet. Import a CSV/JSON or create one.</p>
      ) : (
        <>
          {generateError && (
            <div className="mb-3 bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm text-red-700 flex justify-between">
              <span>{generateError}</span>
              <button onClick={() => setGenerateError(null)} className="ml-3 text-red-400 hover:text-red-600">✕</button>
            </div>
          )}
          <div className={viewMode === "grid" ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" : "grid gap-4"}>
            {styles.map((style) => (
              <div key={style.id} className="bg-white rounded-lg border border-gray-200 p-4 overflow-hidden">
                <div className="cursor-pointer" onClick={() => setExpandedId(expandedId === style.id ? null : style.id)}>
                  <h3 className="font-medium hover:text-blue-600 truncate">{style.name}</h3>
                  {style.linkedin_url && (
                    <a href={style.linkedin_url} target="_blank" onClick={(e) => e.stopPropagation()} className="text-sm text-blue-600 mt-1 block truncate">
                      {style.linkedin_url}
                    </a>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${
                    style.status === "generated" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
                  }`}>
                    {style.status}
                  </span>
                  {style.examples && !style.instructions && (
                    <button
                      className="px-3 py-1 text-xs font-medium rounded-lg bg-purple-100 text-purple-700 hover:bg-purple-200 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                      disabled={generatingId === style.id}
                      onClick={() => handleGenerate(style.id)}
                    >
                      {generatingId === style.id ? "Generating..." : "Generate"}
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(style.id)}
                    className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded-lg whitespace-nowrap ml-auto"
                  >
                    Delete
                  </button>
                </div>
                {style.instructions && (
                  <div>
                    <p className={`text-sm text-gray-600 mt-3 ${expandedId === style.id ? "" : "line-clamp-3"}`}>
                      {style.instructions}
                    </p>
                    {expandedId === style.id && (
                      <button onClick={() => setExpandedId(null)} className="text-xs text-blue-600 mt-2 hover:text-blue-800">
                        Show less
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
