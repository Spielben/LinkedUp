import { useEffect } from "react";
import { useContenusStore } from "../stores/contenus";

export function ContenusList() {
  const { contenus, loading, fetch: fetchContenus, create: createContenu } = useContenusStore();

  useEffect(() => {
    fetchContenus();
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
            createContenu({ name, url: url || undefined });
          }}
        >
          + New Content
        </button>
      </div>

      {loading ? (
        <p className="text-gray-400">Loading...</p>
      ) : contenus.length === 0 ? (
        <p className="text-gray-500">No content sources yet.</p>
      ) : (
        <div className="grid gap-3">
          {contenus.map((c) => (
            <div key={c.id} className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-sm">{c.name}</h3>
                  {c.url && (
                    <a href={c.url} target="_blank" className="text-xs text-blue-600 mt-1 block truncate">
                      {c.url}
                    </a>
                  )}
                  {c.description && (
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">{c.description}</p>
                  )}
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ml-4 shrink-0 ${
                  c.status === "generated" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
                }`}>
                  {c.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
