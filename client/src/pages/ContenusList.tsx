import { useEffect, useRef, useState } from "react";
import { useContenusStore } from "../stores/contenus";
import { importFile } from "../lib/import-file";
import { apiFetch } from "../lib/api";

export function ContenusList() {
  const { contenus, loading, fetch: fetchContenus, create: createContenu, remove: deleteContenu } = useContenusStore();
  const [ingestingId, setIngestingId] = useState<number | null>(null);
  const [ingestError, setIngestError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: "", description: "", url: "", type: "Web", file: null as File | null });
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchContenus();
  }, []);

  const handleIngest = async (id: number) => {
    setIngestingId(id);
    setIngestError(null);
    try {
      const res = await apiFetch(`/api/contenus/${id}/ingest`, { method: "POST" });
      if (!res.ok) throw new Error((await res.json()).error);
      await fetchContenus();
    } catch (err: unknown) {
      setIngestError(err instanceof Error ? err.message : String(err));
    } finally {
      setIngestingId(null);
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm("Delete this content?")) {
      await deleteContenu(id);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    // If file is attached, read it and include content_raw
    if (formData.file) {
      const text = await formData.file.text();
      await createContenu({ name: formData.name, description: formData.description, type: formData.type, content_raw: text });
    } else {
      await createContenu({ name: formData.name, description: formData.description, url: formData.url, type: formData.type });
    }
    setFormData({ name: "", description: "", url: "", type: "Web", file: null });
    setShowForm(false);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportMessage(null);

    try {
      const data = await importFile(file, "contenus");
      setImportMessage(`Imported ${data.imported} contenus, skipped ${data.skipped}`);
      await fetchContenus();
      if (fileInputRef.current) fileInputRef.current.value = "";
      setTimeout(() => setImportMessage(null), 4000);
    } catch (err: unknown) {
      setImportMessage(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  };

  const typeColors: Record<string, string> = {
    YouTube: "bg-red-100 text-red-800",
    Youtube: "bg-red-100 text-red-800",
    Web: "bg-blue-100 text-blue-800",
    PDF: "bg-orange-100 text-orange-800",
    Article: "bg-green-100 text-green-800",
    Podcast: "bg-purple-100 text-purple-800",
  };

  return (
    <div className="w-full min-w-0 max-w-full">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
        <h2 className="text-xl sm:text-2xl font-bold shrink-0">Contenus ({contenus.length})</h2>
        <div className="flex flex-wrap gap-2 items-center sm:ml-auto">
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
            className="bg-gray-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-700 disabled:opacity-50 whitespace-nowrap"
            disabled={importing}
            onClick={() => fileInputRef.current?.click()}
          >
            {importing ? "Importing…" : "Import CSV"}
          </button>
          <button
            className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700 whitespace-nowrap"
            onClick={() => setShowForm(!showForm)}
          >
            + New Content
          </button>
          <input ref={fileInputRef} type="file" accept=".csv,.json" onChange={handleImport} className="hidden" />
        </div>
      </div>

      {importMessage && (
        <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 text-sm text-blue-700">
          {importMessage}
        </div>
      )}

      {showForm && (
        <div className="mb-6 bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="font-medium mb-4">Create New Content</h3>
          <form onSubmit={handleCreateSubmit} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input type="text" required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <input type="text" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value })}>
                  <option value="Web">Web</option>
                  <option value="YouTube">YouTube</option>
                  <option value="PDF">PDF</option>
                  <option value="Article">Article</option>
                  <option value="Podcast">Podcast</option>
                </select>
              </div>
              {(formData.type === "Article" || formData.type === "PDF") ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Upload file</label>
                  <input
                    type="file"
                    accept={formData.type === "PDF" ? ".pdf" : ".html,.txt,.md,.doc,.docx"}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    onChange={(e) => setFormData({ ...formData, file: e.target.files?.[0] || null })}
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">URL</label>
                  <input type="url" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={formData.url} onChange={(e) => setFormData({ ...formData, url: e.target.value })} />
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">Create</button>
              <button type="button" onClick={() => { setShowForm(false); setFormData({ name: "", description: "", url: "", type: "Web", file: null }); }} className="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-300">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <p className="text-gray-400">Loading...</p>
      ) : contenus.length === 0 ? (
        <p className="text-gray-500">No content sources yet. Import a CSV/JSON or create one.</p>
      ) : (
        <>
          {ingestError && (
            <div className="mb-3 bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm text-red-700 flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-start">
              <span className="min-w-0 break-words">{ingestError}</span>
              <button type="button" onClick={() => setIngestError(null)} className="shrink-0 self-end sm:self-start text-red-400 hover:text-red-600">✕</button>
            </div>
          )}
          <div className={viewMode === "grid"
            ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4"
            : "grid gap-2 md:gap-3 w-full min-w-0"
          }>
            {contenus.map((c) => (
              <div
                key={c.id}
                className="bg-white rounded-lg border border-gray-200 p-3 sm:p-4 cursor-pointer hover:border-blue-200 transition w-full min-w-0 max-w-full overflow-hidden box-border"
                onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}
              >
                {/* Content body */}
                <div className="min-w-0 max-w-full">
                  <h3 className="font-medium text-sm leading-snug hover:text-blue-600 break-words [overflow-wrap:anywhere] line-clamp-4 sm:line-clamp-2">
                    {c.name}
                  </h3>
                  {c.url && (
                    <a
                      href={c.url}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-xs text-blue-600 mt-1 block break-all [overflow-wrap:anywhere]"
                    >
                      {c.url}
                    </a>
                  )}
                  {c.description && (
                    <p className="text-xs text-gray-500 mt-1 line-clamp-3 break-words">{c.description}</p>
                  )}
                  {c.summary && (
                    <p className={`text-xs text-gray-600 mt-1 italic break-words ${expandedId === c.id ? "" : "line-clamp-3 sm:line-clamp-2"}`}>
                      {c.summary}
                    </p>
                  )}
                </div>

                {/* Footer: badges then actions — stacked on narrow screens */}
                <div className="mt-2 pt-2 border-t border-gray-100 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                  <div className="flex flex-wrap gap-2 min-w-0">
                    {c.type && (
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${typeColors[c.type] || "bg-gray-100 text-gray-800"}`}>
                        {c.type}
                      </span>
                    )}
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${
                      c.status === "generated" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
                    }`}>
                      {c.status}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 w-full sm:w-auto justify-end sm:justify-end shrink-0">
                    {c.url && !c.summary && (
                      <button
                        type="button"
                        className="px-2.5 py-1 text-xs font-medium rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 disabled:opacity-50 min-h-[2rem] sm:min-h-0"
                        disabled={ingestingId === c.id}
                        onClick={(e) => { e.stopPropagation(); void handleIngest(c.id); }}
                      >
                        {ingestingId === c.id ? "Ingesting…" : "Ingest"}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); void handleDelete(c.id); }}
                      className="px-2.5 py-1 text-xs text-red-600 hover:bg-red-50 rounded-lg min-h-[2rem] sm:min-h-0"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {expandedId === c.id && (
                  <div className="mt-3 pt-3 border-t space-y-2">
                    {c.content_raw && (
                      <div>
                        <p className="text-xs font-medium text-gray-600 mb-1">Raw content:</p>
                        <p className="text-xs text-gray-600 max-h-40 overflow-auto whitespace-pre-line">{c.content_raw}</p>
                      </div>
                    )}
                    {c.summary && (
                      <div>
                        <p className="text-xs font-medium text-gray-600 mb-1">Summary:</p>
                        <p className="text-xs text-gray-600 whitespace-pre-line">{c.summary}</p>
                      </div>
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
