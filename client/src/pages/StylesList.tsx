import { useEffect, useState } from "react";
import { useStylesStore } from "../stores/styles";

export function StylesList() {
  const { styles, loading, fetch: fetchStyles, create: createStyle, remove: deleteStyle } = useStylesStore();
  const [generatingId, setGeneratingId] = useState<number | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: "", linkedin_url: "", examples: "" });

  useEffect(() => {
    fetchStyles();
  }, []);

  const handleGenerate = async (id: number) => {
    setGeneratingId(id);
    setGenerateError(null);
    try {
      const res = await fetch(`/api/styles/${id}/generate`, { method: "POST" });
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

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Styles</h2>
        <button
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
          onClick={() => setShowForm(!showForm)}
        >
          + New Style
        </button>
      </div>

      {showForm && (
        <div className="mb-6 bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="font-medium mb-4">Create New Style</h3>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">LinkedIn URL (optional)</label>
              <input
                type="url"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={formData.linkedin_url}
                onChange={(e) => setFormData({ ...formData, linkedin_url: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Examples (optional)</label>
              <textarea
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                rows={4}
                value={formData.examples}
                onChange={(e) => setFormData({ ...formData, examples: e.target.value })}
                placeholder="Paste LinkedIn posts to analyze..."
              />
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
        <p className="text-gray-500">No styles yet. Add a LinkedIn profile to analyze.</p>
      ) : (
        <>
          {generateError && (
            <div className="mb-3 bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm text-red-700 flex justify-between">
              <span>{generateError}</span>
              <button onClick={() => setGenerateError(null)} className="ml-3 text-red-400 hover:text-red-600">✕</button>
            </div>
          )}
          <div className="grid gap-4">
            {styles.map((style) => (
              <div key={style.id} className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1 cursor-pointer" onClick={() => setExpandedId(expandedId === style.id ? null : style.id)}>
                    <h3 className="font-medium hover:text-blue-600">{style.name}</h3>
                    {style.linkedin_url && (
                      <a href={style.linkedin_url} target="_blank" onClick={(e) => e.stopPropagation()} className="text-sm text-blue-600 mt-1 block">
                        {style.linkedin_url}
                      </a>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      style.status === "generated" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
                    }`}>
                      {style.status}
                    </span>
                    {style.examples && !style.instructions && (
                      <button
                        className="px-3 py-1 text-xs font-medium rounded-lg bg-purple-100 text-purple-700 hover:bg-purple-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={generatingId === style.id}
                        onClick={() => handleGenerate(style.id)}
                      >
                        {generatingId === style.id ? "Generating…" : "✨ Generate"}
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(style.id)}
                      className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                {style.instructions && (
                  <div>
                    <p className={`text-sm text-gray-600 mt-3 ${expandedId === style.id ? "" : "line-clamp-3"}`}>
                      {style.instructions}
                    </p>
                    {expandedId === style.id && (
                      <button
                        onClick={() => setExpandedId(null)}
                        className="text-xs text-blue-600 mt-2 hover:text-blue-800"
                      >
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
