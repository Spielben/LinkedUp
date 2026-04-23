import { useEffect, useRef, useState } from "react";
import { useTemplatesStore } from "../stores/templates";
import { importFile } from "../lib/import-file";
import { formatCompactInt } from "../lib/formatMetrics";

const categoryColors: Record<string, string> = {
  "Lead Magnet": "bg-purple-100 text-purple-800",
  "Storytelling": "bg-orange-100 text-orange-800",
  "Hacks": "bg-cyan-100 text-cyan-800",
  "Business": "bg-blue-100 text-blue-800",
  "Actu": "bg-green-100 text-green-800",
};

export function TemplatesList() {
  const { templates, loading, fetch: fetchTemplates, create: createTemplate, remove: deleteTemplate } = useTemplatesStore();
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    author: "",
    category: "Business",
    linkedin_post_url: "",
    example_text: "",
    template_text: "",
    impressions: 0,
    comments: 0,
    shares: 0,
    likes: 0,
  });
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const handleDelete = async (id: number) => {
    if (confirm("Delete this template?")) {
      await deleteTemplate(id);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    await createTemplate(formData);
    setFormData({
      name: "",
      description: "",
      author: "",
      category: "Business",
      linkedin_post_url: "",
      example_text: "",
      template_text: "",
      impressions: 0,
      comments: 0,
      shares: 0,
      likes: 0,
    });
    setShowForm(false);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportMessage(null);

    try {
      const data = await importFile(file, "templates");
      setImportMessage(`Imported ${data.imported} templates, skipped ${data.skipped}`);
      await fetchTemplates();
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
        <h2 className="text-2xl font-bold">Templates ({templates.length})</h2>
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
            + New Template
          </button>
          <input ref={fileInputRef} type="file" accept=".csv,.json" onChange={handleImport} className="hidden" />
        </div>
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap gap-2 mb-4">
        {["all", "Business", "Lead Magnet", "Storytelling", "Hacks", "Actu"].map((cat) => (
          <button
            key={cat}
            onClick={() => setFilterCategory(cat)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
              filterCategory === cat
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {cat === "all" ? "All" : cat}
          </button>
        ))}
      </div>

      {/* ── How Templates work ── */}
      <details className="mb-4 text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
        <summary className="cursor-pointer font-medium text-gray-700">What is a Template?</summary>
        <div className="mt-2 space-y-1.5 pl-1">
          <p>A Template defines the <strong>structure</strong> of a LinkedIn post — the skeleton, not the content. The AI fills it with your subject matter while respecting the format.</p>
          <p><strong>Template Text</strong> is the skeleton itself, written with placeholders — e.g. <em>"[Hook question]\n\n[3 insight bullets]\n\n[Call to action]"</em>.</p>
          <p><strong>Example Text</strong> is a real, complete post that uses this structure. It helps the AI understand the tone and flow without being told explicitly.</p>
          <p><strong>LinkedIn Post URL</strong> is optional — link to the original post if you're reverse-engineering a creator's structure.</p>
          <p><strong>How to use it:</strong> Create a template → attach it to a post when generating → the AI drafts 3 versions that follow that exact structure.</p>
        </div>
      </details>

      {importMessage && (
        <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 text-sm text-blue-700">
          {importMessage}
        </div>
      )}

      {showForm && (
        <div className="mb-6 bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="font-medium mb-1">Create New Template</h3>
          <p className="text-xs text-gray-500 mb-4">Define a post structure. At minimum fill in Name and Template Text — everything else is optional but improves AI output quality.</p>
          <form onSubmit={handleCreateSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <p className="text-xs text-gray-400 mb-1">Short label, e.g. "Problem → Insight → CTA" or "5-bullet list".</p>
                <input type="text" required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Author</label>
                <p className="text-xs text-gray-400 mb-1">Who created or popularized this format.</p>
                <input type="text" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={formData.author} onChange={(e) => setFormData({ ...formData, author: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <p className="text-xs text-gray-400 mb-1">One sentence describing when or why to use this template.</p>
              <input type="text" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <p className="text-xs text-gray-400 mb-1">Used for filtering your library.</p>
                <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })}>
                  <option value="Business">Business</option>
                  <option value="Lead Magnet">Lead Magnet</option>
                  <option value="Storytelling">Storytelling</option>
                  <option value="Hacks">Hacks</option>
                  <option value="Actu">Actu</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">LinkedIn Post URL</label>
                <p className="text-xs text-gray-400 mb-1">Link to the original post you're borrowing the structure from.</p>
                <input type="url" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={formData.linkedin_post_url} onChange={(e) => setFormData({ ...formData, linkedin_post_url: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Example Text</label>
              <p className="text-xs text-gray-400 mb-1">A complete, real post that follows this structure — shows the AI the intended tone and flow.</p>
              <textarea className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" rows={3} value={formData.example_text} onChange={(e) => setFormData({ ...formData, example_text: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Template Text</label>
              <p className="text-xs text-gray-400 mb-1">The skeleton with placeholders — e.g. "[Hook]\n\n[3 key points]\n\n[CTA]". This is what the AI will follow to structure each post.</p>
              <textarea className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" rows={3} value={formData.template_text} onChange={(e) => setFormData({ ...formData, template_text: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">LinkedIn metrics (optional)</label>
              <p className="text-xs text-gray-400 mb-2">Shown next to the title in the post editor template menu (impressions, replies, reposts). Likes kept for reference.</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div>
                  <label className="text-[11px] text-gray-500">Impressions</label>
                  <input
                    type="number"
                    min={0}
                    className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                    value={formData.impressions}
                    onChange={(e) => setFormData({ ...formData, impressions: Math.max(0, parseInt(e.target.value, 10) || 0) })}
                  />
                </div>
                <div>
                  <label className="text-[11px] text-gray-500">Replies</label>
                  <input
                    type="number"
                    min={0}
                    className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                    value={formData.comments}
                    onChange={(e) => setFormData({ ...formData, comments: Math.max(0, parseInt(e.target.value, 10) || 0) })}
                  />
                </div>
                <div>
                  <label className="text-[11px] text-gray-500">Reposts</label>
                  <input
                    type="number"
                    min={0}
                    className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                    value={formData.shares}
                    onChange={(e) => setFormData({ ...formData, shares: Math.max(0, parseInt(e.target.value, 10) || 0) })}
                  />
                </div>
                <div>
                  <label className="text-[11px] text-gray-500">Likes</label>
                  <input
                    type="number"
                    min={0}
                    className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                    value={formData.likes}
                    onChange={(e) => setFormData({ ...formData, likes: Math.max(0, parseInt(e.target.value, 10) || 0) })}
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">Create</button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setFormData({
                    name: "",
                    description: "",
                    author: "",
                    category: "Business",
                    linkedin_post_url: "",
                    example_text: "",
                    template_text: "",
                    impressions: 0,
                    comments: 0,
                    shares: 0,
                    likes: 0,
                  });
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
      ) : templates.length === 0 ? (
        <p className="text-gray-500">No templates yet. Import a CSV/JSON or create one.</p>
      ) : (() => {
        const filtered = filterCategory === "all" ? templates : templates.filter((t) => t.category === filterCategory);
        return viewMode === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((t) => (
            <div
              key={t.id}
              className="bg-white rounded-lg border border-gray-200 overflow-hidden cursor-pointer hover:border-blue-300 hover:shadow-sm transition"
              onClick={() => setExpandedId(expandedId === t.id ? null : t.id)}
            >
              {t.image_url && <img src={t.image_url} alt={t.name} className="w-full h-40 object-cover" />}
              <div className="p-4">
                <h3 className="font-medium text-sm line-clamp-2">{t.name}</h3>
                {t.category && (
                  <span className={`inline-block mt-2 px-2 py-0.5 rounded-full text-xs font-medium ${categoryColors[t.category] || "bg-gray-100 text-gray-800"}`}>
                    {t.category}
                  </span>
                )}
                <p className="text-xs text-gray-500 mt-2">{t.author || "Unknown"}</p>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500 mt-2 font-medium">
                  <span title="Impressions">{formatCompactInt(t.impressions ?? 0)} imp</span>
                  <span title="Replies (comments)">{formatCompactInt(t.comments ?? 0)} replies</span>
                  <span title="Reposts (shares)">{formatCompactInt(t.shares ?? 0)} reposts</span>
                </div>
                {expandedId === t.id && (
                  <div className="mt-4 pt-4 border-t space-y-3">
                    {t.example_text && (
                      <div>
                        <p className="text-xs font-medium text-gray-600 mb-1">Example:</p>
                        <p className="text-xs text-gray-600 whitespace-pre-line">{t.example_text}</p>
                      </div>
                    )}
                    {t.template_text && (
                      <div>
                        <p className="text-xs font-medium text-gray-600 mb-1">Template:</p>
                        <p className="text-xs text-gray-600 whitespace-pre-line">{t.template_text}</p>
                      </div>
                    )}
                    {t.linkedin_post_url && (
                      <a href={t.linkedin_post_url} target="_blank" onClick={(e) => e.stopPropagation()} className="text-xs text-blue-600 hover:text-blue-800 block">
                        View on LinkedIn
                      </a>
                    )}
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(t.id); }} className="text-xs text-red-600 hover:bg-red-50 px-2 py-1 rounded-lg mt-2">
                      Delete
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((t) => (
            <div key={t.id} className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex justify-between items-start cursor-pointer" onClick={() => setExpandedId(expandedId === t.id ? null : t.id)}>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-sm hover:text-blue-600">{t.name}</h3>
                  {t.description && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{t.description}</p>}
                  <p className="text-xs text-gray-400 mt-1">{t.author || "Unknown"}</p>
                </div>
                <div className="flex items-center gap-2 ml-4 shrink-0">
                  {t.category && (
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${categoryColors[t.category] || "bg-gray-100 text-gray-800"}`}>
                      {t.category}
                    </span>
                  )}
                  <div className="flex flex-col items-end gap-0.5 text-[11px] text-gray-600 text-right max-w-[14rem]">
                    <span>{formatCompactInt(t.impressions ?? 0)} imp</span>
                    <span>{formatCompactInt(t.comments ?? 0)} replies · {formatCompactInt(t.shares ?? 0)} reposts</span>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); handleDelete(t.id); }} className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded-lg">
                    Delete
                  </button>
                </div>
              </div>
              {expandedId === t.id && (
                <div className="mt-4 pt-4 border-t space-y-3">
                  {t.example_text && (
                    <div>
                      <p className="text-xs font-medium text-gray-600 mb-1">Example:</p>
                      <p className="text-xs text-gray-600 whitespace-pre-line">{t.example_text}</p>
                    </div>
                  )}
                  {t.template_text && (
                    <div>
                      <p className="text-xs font-medium text-gray-600 mb-1">Template:</p>
                      <p className="text-xs text-gray-600 whitespace-pre-line">{t.template_text}</p>
                    </div>
                  )}
                  {t.linkedin_post_url && (
                    <a href={t.linkedin_post_url} target="_blank" className="text-xs text-blue-600 hover:text-blue-800 block">View on LinkedIn</a>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      );
      })()}
    </div>
  );
}
