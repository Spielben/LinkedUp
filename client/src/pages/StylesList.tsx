import { useEffect, useState } from "react";
import { useStylesStore } from "../stores/styles";

export function StylesList() {
  const { styles, loading, fetch: fetchStyles, create: createStyle } = useStylesStore();
  const [generatingId, setGeneratingId] = useState<number | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);

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

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Styles</h2>
        <button
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
          onClick={() => {
            const name = prompt("Style name:");
            if (name) createStyle({ name });
          }}
        >
          + New Style
        </button>
      </div>

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
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-medium">{style.name}</h3>
                    {style.linkedin_url && (
                      <a href={style.linkedin_url} target="_blank" className="text-sm text-blue-600 mt-1 block">
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
                  </div>
                </div>
                {style.instructions && (
                  <p className="text-sm text-gray-600 mt-3 line-clamp-3">{style.instructions}</p>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
