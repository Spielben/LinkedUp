import { useEffect } from "react";
import { useTemplatesStore } from "../stores/templates";

const categoryColors: Record<string, string> = {
  "Lead Magnet": "bg-purple-100 text-purple-800",
  "Storytelling": "bg-orange-100 text-orange-800",
  "Hacks": "bg-cyan-100 text-cyan-800",
  "Business": "bg-blue-100 text-blue-800",
  "Actu": "bg-green-100 text-green-800",
};

export function TemplatesList() {
  const { templates, loading, fetch: fetchTemplates } = useTemplatesStore();

  useEffect(() => {
    fetchTemplates();
  }, []);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Templates ({templates.length})</h2>
      </div>

      {loading ? (
        <p className="text-gray-400">Loading...</p>
      ) : templates.length === 0 ? (
        <p className="text-gray-500">No templates yet.</p>
      ) : (
        <div className="grid gap-3">
          {templates.map((t) => (
            <div key={t.id} className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-sm">{t.name}</h3>
                  {t.description && (
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">{t.description}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">{t.author || "Unknown"}</p>
                </div>
                <div className="flex items-center gap-2 ml-4 shrink-0">
                  {t.category && (
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${categoryColors[t.category] || "bg-gray-100 text-gray-800"}`}>
                      {t.category}
                    </span>
                  )}
                  <span className="text-xs text-gray-400">{t.likes} likes</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
