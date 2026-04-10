import { useEffect, useState } from "react";
import { useTemplatesStore } from "../stores/templates";

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
  });

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
    });
    setShowForm(false);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Templates ({templates.length})</h2>
        <button
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
          onClick={() => setShowForm(!showForm)}
        >
          + New Template
        </button>
      </div>

      {showForm && (
        <div className="mb-6 bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="font-medium mb-4">Create New Template</h3>
          <form onSubmit={handleCreateSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Author (optional)</label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  value={formData.author}
                  onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                />
              </div>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Category (optional)</label>
                <select
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                >
                  <option value="Business">Business</option>
                  <option value="Lead Magnet">Lead Magnet</option>
                  <option value="Storytelling">Storytelling</option>
                  <option value="Hacks">Hacks</option>
                  <option value="Actu">Actu</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">LinkedIn Post URL (optional)</label>
                <input
                  type="url"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  value={formData.linkedin_post_url}
                  onChange={(e) => setFormData({ ...formData, linkedin_post_url: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Example Text (optional)</label>
              <textarea
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                rows={3}
                value={formData.example_text}
                onChange={(e) => setFormData({ ...formData, example_text: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Template Text (optional)</label>
              <textarea
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                rows={3}
                value={formData.template_text}
                onChange={(e) => setFormData({ ...formData, template_text: e.target.value })}
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
                  setFormData({
                    name: "",
                    description: "",
                    author: "",
                    category: "Business",
                    linkedin_post_url: "",
                    example_text: "",
                    template_text: "",
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
        <p className="text-gray-500">No templates yet.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((t) => (
            <div
              key={t.id}
              className="bg-white rounded-lg border border-gray-200 overflow-hidden cursor-pointer hover:border-blue-300 hover:shadow-sm transition"
              onClick={() => setExpandedId(expandedId === t.id ? null : t.id)}
            >
              {t.image_url && (
                <img src={t.image_url} alt={t.name} className="w-full h-40 object-cover" />
              )}
              <div className="p-4">
                <h3 className="font-medium text-sm line-clamp-2">{t.name}</h3>
                {t.category && (
                  <span className={`inline-block mt-2 px-2 py-0.5 rounded-full text-xs font-medium ${categoryColors[t.category] || "bg-gray-100 text-gray-800"}`}>
                    {t.category}
                  </span>
                )}
                <p className="text-xs text-gray-500 mt-2">{t.author || "Unknown"}</p>
                <div className="flex gap-3 text-xs text-gray-400 mt-2">
                  <span>{t.likes} likes</span>
                  <span>{t.comments} comments</span>
                </div>

                {expandedId === t.id && (
                  <div className="mt-4 pt-4 border-t space-y-3">
                    {t.example_text && (
                      <div>
                        <p className="text-xs font-medium text-gray-600 mb-1">Example:</p>
                        <p className="text-xs text-gray-600">{t.example_text}</p>
                      </div>
                    )}
                    {t.template_text && (
                      <div>
                        <p className="text-xs font-medium text-gray-600 mb-1">Template:</p>
                        <p className="text-xs text-gray-600">{t.template_text}</p>
                      </div>
                    )}
                    {t.linkedin_post_url && (
                      <a
                        href={t.linkedin_post_url}
                        target="_blank"
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs text-blue-600 hover:text-blue-800 block"
                      >
                        View on LinkedIn
                      </a>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(t.id);
                      }}
                      className="text-xs text-red-600 hover:bg-red-50 px-2 py-1 rounded-lg mt-2"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
