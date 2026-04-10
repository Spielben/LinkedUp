import { useEffect, useRef, useState } from "react";
import { useContenusStore } from "../stores/contenus";

export function ContenusList() {
  const { contenus, loading, fetch: fetchContenus, create: createContenu, remove: deleteContenu } = useContenusStore();
  const [ingestingId, setIngestingId] = useState<number | null>(null);
  const [ingestError, setIngestError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    url: "",
    type: "Web",
  });
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchContenus();
  }, []);

  const handleIngest = async (id: number) => {
    setIngestingId(id);
    setIngestError(null);
    try {
      const res = await fetch(`/api/contenus/${id}/ingest`, { method: "POST" });
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
    await createContenu(formData);
    setFormData({ name: "", description: "", url: "", type: "Web" });
    setShowForm(false);
  };

  const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportMessage(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("table", "contenus");

      const res = await fetch("/api/import/csv", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      setImportMessage(`Imported ${data.imported} rows, skipped ${data.skipped}`);
      await fetchContenus();

      if (csvInputRef.current) {
        csvInputRef.current.value = "";
      }

      setTimeout(() => setImportMessage(null), 3000);
    } catch (err: unknown) {
      setImportMessage(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Contenus</h2>
        <div className="flex gap-2">
          <button
            className="bg-gray-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-700 disabled:opacity-50"
            disabled={importing}
            onClick={() => csvInputRef.current?.click()}
          >
            {importing ? "Importing..." : "Import CSV"}
          </button>
          <button
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
            onClick={() => setShowForm(!showForm)}
          >
            + New Content
          </button>
          <input
            ref={csvInputRef}
            type="file"
            accept=".csv"
            onChange={handleImportCSV}
            className="hidden"
          />
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
              <input
                type="text"
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
              <input
                type="text"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type (optional)</label>
                <select
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                >
                  <option value="Web">Web</option>
                  <option value="YouTube">YouTube</option>
                  <option value="PDF">PDF</option>
                  <option value="Article">Article</option>
                  <option value="Podcast">Podcast</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">URL (optional)</label>
                <input
                  type="url"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
              >
                Create
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setFormData({ name: "", description: "", url: "", type: "Web" });
                }}
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
      ) : contenus.length === 0 ? (
        <p className="text-gray-500">No content sources yet.</p>
      ) : (
        <>
          {ingestError && (
            <div className="mb-3 bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm text-red-700 flex justify-between">
              <span>{ingestError}</span>
              <button onClick={() => setIngestError(null)} className="ml-3 text-red-400 hover:text-red-600">✕</button>
            </div>
          )}
          <div className="grid gap-3">
            {contenus.map((c) => (
              <div key={c.id} className="bg-white rounded-lg border border-gray-200 p-4">
                <div
                  className="flex justify-between items-start cursor-pointer"
                  onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}
                >
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm hover:text-blue-600">{c.name}</h3>
                    {c.url && (
                      <a
                        href={c.url}
                        target="_blank"
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs text-blue-600 mt-1 block truncate"
                      >
                        {c.url}
                      </a>
                    )}
                    {c.description && (
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">{c.description}</p>
                    )}
                    {c.summary && (
                      <p className={`text-xs text-gray-600 mt-2 ${expandedId === c.id ? "" : "line-clamp-2"} italic`}>
                        {c.summary}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2 ml-4 shrink-0">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      c.status === "generated" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
                    }`}>
                      {c.status}
                    </span>
                    {c.url && !c.summary && (
                      <button
                        className="px-3 py-1 text-xs font-medium rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={ingestingId === c.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleIngest(c.id);
                        }}
                      >
                        {ingestingId === c.id ? "Ingesting…" : "⬇ Ingest"}
                      </button>
                    )}
                  </div>
                </div>

                {expandedId === c.id && (
                  <div className="mt-4 pt-4 border-t space-y-2">
                    {c.content_raw && (
                      <div>
                        <button
                          onClick={() => {
                            const el = document.getElementById(`content-${c.id}`);
                            if (el) el.classList.toggle("hidden");
                          }}
                          className="text-xs text-blue-600 hover:text-blue-800"
                        >
                          Show/Hide raw content
                        </button>
                        <p id={`content-${c.id}`} className="hidden text-xs text-gray-600 mt-1 max-h-40 overflow-auto">
                          {c.content_raw}
                        </p>
                      </div>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(c.id);
                      }}
                      className="text-xs text-red-600 hover:bg-red-50 px-2 py-1 rounded-lg mt-2"
                    >
                      Delete
                    </button>
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
