import { useEffect, useState } from "react";

interface Style {
  id: number;
  name: string;
  linkedin_url: string | null;
  status: string;
  created_at: string;
}

export function StylesList() {
  const [styles, setStyles] = useState<Style[]>([]);

  useEffect(() => {
    fetch("/api/styles").then((r) => r.json()).then(setStyles);
  }, []);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Styles</h2>
        <button
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
          onClick={() => {
            const name = prompt("Style name:");
            if (!name) return;
            fetch("/api/styles", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name }),
            }).then(() => fetch("/api/styles").then((r) => r.json()).then(setStyles));
          }}
        >
          + New Style
        </button>
      </div>

      {styles.length === 0 ? (
        <p className="text-gray-500">No styles yet. Add a LinkedIn profile to analyze.</p>
      ) : (
        <div className="grid gap-4">
          {styles.map((style) => (
            <div key={style.id} className="bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="font-medium">{style.name}</h3>
              {style.linkedin_url && (
                <p className="text-sm text-blue-600 mt-1">{style.linkedin_url}</p>
              )}
              <p className="text-xs text-gray-400 mt-2">{style.status} — {style.created_at}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
