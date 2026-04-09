import { useEffect, useState } from "react";

interface Contenu {
  id: number;
  name: string;
  type: string | null;
  url: string | null;
  status: string;
  created_at: string;
}

export function ContenusList() {
  const [contenus, setContenus] = useState<Contenu[]>([]);

  useEffect(() => {
    fetch("/api/contenus").then((r) => r.json()).then(setContenus);
  }, []);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Contenus</h2>
        <button
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
          onClick={() => {
            const name = prompt("Content name:");
            if (!name) return;
            const url = prompt("URL (web or YouTube, optional):");
            fetch("/api/contenus", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name, url: url || null }),
            }).then(() => fetch("/api/contenus").then((r) => r.json()).then(setContenus));
          }}
        >
          + New Content
        </button>
      </div>

      {contenus.length === 0 ? (
        <p className="text-gray-500">No content sources yet.</p>
      ) : (
        <div className="grid gap-3">
          {contenus.map((c) => (
            <div key={c.id} className="bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="font-medium text-sm">{c.name}</h3>
              {c.url && <p className="text-xs text-blue-600 mt-1 truncate">{c.url}</p>}
              <p className="text-xs text-gray-400 mt-1">{c.type || "—"} — {c.status}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
