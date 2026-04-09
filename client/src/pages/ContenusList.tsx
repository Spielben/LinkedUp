import { useEffect, useState } from "react";
import { useContenusStore } from "../stores/contenus";

export function ContenusList() {
  const { contenus, loading, fetch: fetchContenus, create: createContenu } = useContenusStore();
  const [ingestingId, setIngestingId] = useState<number | null>(null);
  const [ingestError, setIngestError] = useState<string | null>(null);

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
                    {c.summary && (
                      <p className="text-xs text-gray-600 mt-2 line-clamp-3 italic">{c.summary}</p>
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
                        onClick={() => handleIngest(c.id)}
                      >
                        {ingestingId === c.id ? "Ingesting…" : "⬇ Ingest"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
