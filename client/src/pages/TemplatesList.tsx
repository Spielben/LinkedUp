import { useEffect, useState } from "react";

interface Template {
  id: number;
  name: string;
  category: string | null;
  author: string | null;
  likes: number;
  comments: number;
  created_at: string;
}

const categoryColors: Record<string, string> = {
  "Lead Magnet": "bg-purple-100 text-purple-800",
  "Storytelling": "bg-orange-100 text-orange-800",
  "Hacks": "bg-cyan-100 text-cyan-800",
  "Business": "bg-blue-100 text-blue-800",
  "Actu": "bg-green-100 text-green-800",
};

export function TemplatesList() {
  const [templates, setTemplates] = useState<Template[]>([]);

  useEffect(() => {
    fetch("/api/templates").then((r) => r.json()).then(setTemplates);
  }, []);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Templates</h2>
      </div>

      {templates.length === 0 ? (
        <p className="text-gray-500">No templates yet.</p>
      ) : (
        <div className="grid gap-3">
          {templates.map((t) => (
            <div key={t.id} className="bg-white rounded-lg border border-gray-200 p-4 flex justify-between items-center">
              <div>
                <h3 className="font-medium text-sm">{t.name}</h3>
                <p className="text-xs text-gray-400 mt-1">{t.author || "Unknown"}</p>
              </div>
              <div className="flex items-center gap-2">
                {t.category && (
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${categoryColors[t.category] || "bg-gray-100 text-gray-800"}`}>
                    {t.category}
                  </span>
                )}
                <span className="text-xs text-gray-400">{t.likes} likes</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
