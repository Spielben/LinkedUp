import { useEffect, useRef, useState } from "react";
import { useStylesStore } from "../stores/styles";
import { importFile } from "../lib/import-file";
import { apiFetch } from "../lib/api";

async function readGenerateError(res: Response): Promise<string> {
  const text = await res.text();
  try {
    const data = JSON.parse(text) as { error?: unknown };
    if (typeof data.error === "string" && data.error) return data.error;
  } catch {
    /* ignore */
  }
  const t = text.trim();
  if (t.length > 0) return t.length > 400 ? `${t.slice(0, 400)}…` : t;
  return res.statusText || `Request failed (${res.status})`;
}

export function StylesList() {
  const { styles, loading, fetch: fetchStyles, create: createStyle, update: updateStyle, remove: deleteStyle } =
    useStylesStore();
  const [generatingId, setGeneratingId] = useState<number | null>(null);
  /** Per-style error after Generate fails */
  const [generateErrors, setGenerateErrors] = useState<Record<number, string>>({});
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState({ name: "", linkedin_url: "", examples: "" });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: "", linkedin_url: "", examples: "" });
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchStyles();
  }, []);

  const startEdit = (style: { id: number; name: string; linkedin_url: string | null; examples: string | null }) => {
    setEditingId(style.id);
    setEditDraft({
      name: style.name || "",
      linkedin_url: style.linkedin_url || "",
      examples: style.examples || "",
    });
    setEditError(null);
    setGenerateErrors((prev) => {
      const next = { ...prev };
      delete next[style.id];
      return next;
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditError(null);
  };

  const saveEdit = async () => {
    if (editingId == null) return;
    const name = editDraft.name.trim();
    if (!name) {
      setEditError("Name is required");
      return;
    }
    setEditSaving(true);
    setEditError(null);
    try {
      await updateStyle(editingId, {
        name,
        linkedin_url: editDraft.linkedin_url.trim() || null,
        examples: editDraft.examples.trim() || null,
      });
      await fetchStyles();
      setEditingId(null);
    } catch (err: unknown) {
      setEditError(err instanceof Error ? err.message : String(err));
    } finally {
      setEditSaving(false);
    }
  };

  const handleGenerate = async (id: number) => {
    setGeneratingId(id);
    setGenerateErrors((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    try {
      const res = await apiFetch(`/api/styles/${id}/generate`, { method: "POST" });
      if (!res.ok) {
        const msg = await readGenerateError(res);
        setGenerateErrors((prev) => ({ ...prev, [id]: msg }));
        return;
      }
      await fetchStyles();
    } catch (err: unknown) {
      setGenerateErrors((prev) => ({
        ...prev,
        [id]: err instanceof Error ? err.message : String(err),
      }));
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

  const canGenerate = (examples: string | null) => Boolean(examples?.trim());

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
          <p>
            A Style captures a <strong>writing voice</strong> — yours, a colleague&apos;s, or a creator you admire. Once
            generated, the AI will imitate that voice when drafting your posts.
          </p>
          <p>
            <strong>How to use it:</strong> Create a style → paste example posts in <strong>Edit</strong> → click{" "}
            <em>Generate</em> (requires pasted examples; LinkedIn profile URL alone is not scraped automatically yet).
          </p>
          <p>
            <strong>Status &quot;generated&quot;</strong> means the style analysis is ready and will be injected into the
            writing prompt.
          </p>
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
          <p className="text-xs text-gray-500 mb-4">
            Give the AI a writing voice to imitate. Use <strong>Edit</strong> after creation to paste example posts,
            then <strong>Generate</strong>.
          </p>
          <form onSubmit={handleCreateSubmit} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <p className="text-xs text-gray-400 mb-1">
                A label to identify this voice (e.g. &quot;My style&quot;, &quot;Thomas Ledoux&quot;, &quot;Casual
                expert&quot;).
              </p>
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
              <p className="text-xs text-gray-400 mb-1">Stored for your reference; generation uses pasted examples.</p>
              <input
                type="url"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={formData.linkedin_url}
                onChange={(e) => setFormData({ ...formData, linkedin_url: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Examples (optional)</label>
              <p className="text-xs text-gray-400 mb-1">
                You can paste examples here or later via <strong>Edit</strong>.
              </p>
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
                onClick={() => {
                  setShowForm(false);
                  setFormData({ name: "", linkedin_url: "", examples: "" });
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
      ) : styles.length === 0 ? (
        <p className="text-gray-500">No styles yet. Import a CSV/JSON or create one.</p>
      ) : (
        <div className={viewMode === "grid" ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" : "grid gap-4"}>
          {styles.map((style) => (
            <div key={style.id} className="bg-white rounded-lg border border-gray-200 p-4 overflow-hidden">
              {editingId === style.id ? (
                <div className="space-y-3" onClick={(e) => e.stopPropagation()}>
                  <h3 className="font-medium text-sm">Edit style</h3>
                  {editError && (
                    <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded px-2 py-1">{editError}</p>
                  )}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Name *</label>
                    <input
                      type="text"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      value={editDraft.name}
                      onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">LinkedIn URL</label>
                    <input
                      type="url"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      value={editDraft.linkedin_url}
                      onChange={(e) => setEditDraft({ ...editDraft, linkedin_url: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Example posts (for Generate)</label>
                    <textarea
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      rows={6}
                      value={editDraft.examples}
                      onChange={(e) => setEditDraft({ ...editDraft, examples: e.target.value })}
                      placeholder="Paste 2–5 LinkedIn posts to analyze..."
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={editSaving}
                      onClick={() => void saveEdit()}
                      className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-50"
                    >
                      {editSaving ? "Saving…" : "Save"}
                    </button>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="bg-gray-200 text-gray-800 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-gray-300"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div
                    className="cursor-pointer"
                    onClick={() => setExpandedId(expandedId === style.id ? null : style.id)}
                  >
                    <h3 className="font-medium hover:text-blue-600 truncate">{style.name}</h3>
                    {style.linkedin_url && (
                      <a
                        href={style.linkedin_url}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-sm text-blue-600 mt-1 block truncate"
                      >
                        {style.linkedin_url}
                      </a>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${
                        style.status === "generated" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {style.status}
                    </span>
                    <button
                      type="button"
                      className="px-2 py-1 text-xs font-medium rounded-lg bg-gray-100 text-gray-800 hover:bg-gray-200 whitespace-nowrap"
                      onClick={() => startEdit(style)}
                    >
                      Edit
                    </button>
                    {!style.instructions && (
                      <button
                        type="button"
                        className="px-3 py-1 text-xs font-medium rounded-lg bg-purple-100 text-purple-700 hover:bg-purple-200 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                        disabled={generatingId === style.id || !canGenerate(style.examples)}
                        title={
                          !canGenerate(style.examples)
                            ? "Paste example posts in Edit first"
                            : "Generate style instructions from examples"
                        }
                        onClick={() => handleGenerate(style.id)}
                      >
                        {generatingId === style.id ? "Generating..." : "Generate"}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDelete(style.id)}
                      className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded-lg whitespace-nowrap ml-auto"
                    >
                      Delete
                    </button>
                  </div>
                  {generateErrors[style.id] && (
                    <p className="mt-2 text-xs text-red-700 bg-red-50 border border-red-100 rounded px-2 py-1 break-words">
                      {generateErrors[style.id]}
                    </p>
                  )}
                  {!canGenerate(style.examples) && !style.instructions && (
                    <p className="mt-2 text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded px-2 py-1">
                      Paste example posts via <strong>Edit</strong>, then click Generate.
                    </p>
                  )}
                  {style.instructions && (
                    <div>
                      <p className={`text-sm text-gray-600 mt-3 ${expandedId === style.id ? "" : "line-clamp-3"}`}>
                        {style.instructions}
                      </p>
                      {expandedId === style.id && (
                        <button
                          type="button"
                          onClick={() => setExpandedId(null)}
                          className="text-xs text-blue-600 mt-2 hover:text-blue-800"
                        >
                          Show less
                        </button>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
