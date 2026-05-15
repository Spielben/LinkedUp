import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { apiFetch } from "../lib/api";
import { CONTENT_CATEGORIES } from "../lib/categories";
import type { Contenu } from "../stores/contenus";

const TYPE_OPTIONS = ["Web", "YouTube", "Video", "PDF", "Article", "Podcast"];

export function ContenuDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [contenu, setContenu] = useState<Contenu | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ingesting, setIngesting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [ingestError, setIngestError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [form, setForm] = useState({
    name: "",
    title: "",
    description: "",
    source_notes: "",
    category: "Business",
    type: "Web",
    url: "",
    content_raw: "",
    summary: "",
  });

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    apiFetch(`/api/contenus/${id}`)
      .then((r) => r.json())
      .then((data: Contenu) => {
        setContenu(data);
        setForm({
          name: data.name ?? "",
          title: data.title ?? "",
          description: data.description ?? "",
          source_notes: data.source_notes ?? "",
          category: data.category ?? "Business",
          type: data.type ?? "Web",
          url: data.url ?? "",
          content_raw: data.content_raw ?? "",
          summary: data.summary ?? "",
        });
      })
      .catch(() => setSaveError("Could not load content"))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      const res = await apiFetch(`/api/contenus/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim() || contenu?.name,
          title: form.title.trim() || null,
          description: form.description.trim() || null,
          source_notes: form.source_notes.trim() || null,
          category: form.category || null,
          type: form.type || null,
          url: form.url.trim() || null,
          content_raw: form.content_raw.trim() || null,
          summary: form.summary.trim() || null,
        }),
      });
      if (!res.ok) {
        const p = await res.json().catch(() => ({ error: "Save failed" }));
        throw new Error(typeof p?.error === "string" ? p.error : "Save failed");
      }
      const updated = (await res.json()) as Contenu;
      setContenu(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleIngest = async () => {
    if (!id) return;
    setIngesting(true);
    setIngestError(null);
    try {
      const res = await apiFetch(`/api/contenus/${id}/ingest`, { method: "POST" });
      if (!res.ok) {
        const p = await res.json().catch(() => ({ error: "Ingest failed" }));
        throw new Error(typeof p?.error === "string" ? p.error : "Ingest failed");
      }
      const updated = (await res.json()) as Contenu;
      setContenu(updated);
      setForm((f) => ({
        ...f,
        content_raw: updated.content_raw ?? "",
        summary: updated.summary ?? "",
      }));
    } catch (err) {
      setIngestError(err instanceof Error ? err.message : String(err));
    } finally {
      setIngesting(false);
    }
  };

  if (loading) return <p className="text-gray-400 p-6">Loading…</p>;
  if (!contenu) return <p className="text-red-500 p-6">Content not found.</p>;

  const hasSource = !!(form.url.trim() || contenu.pdf_path);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate("/contenus")}
          className="text-sm text-gray-500 hover:text-gray-800"
        >
          ← Contenus
        </button>
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
          contenu.status === "generated" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-700"
        }`}>
          {contenu.status ?? "pending"}
        </span>
      </div>

      {/* Errors */}
      {saveError && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm text-red-700 flex justify-between">
          <span>{saveError}</span>
          <button onClick={() => setSaveError(null)}>✕</button>
        </div>
      )}
      {ingestError && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm text-red-700 flex justify-between">
          <span>{ingestError}</span>
          <button onClick={() => setIngestError(null)}>✕</button>
        </div>
      )}

      {/* Main form */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h2 className="text-base font-semibold text-gray-800">Content info</h2>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Name *</label>
          <input
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Title</label>
          <input
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            value={form.title}
            placeholder="Optional display title"
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
            <select
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
            >
              {TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
            <select
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              {CONTENT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">URL</label>
          <input
            type="url"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            value={form.url}
            placeholder="https://…"
            onChange={(e) => setForm({ ...form, url: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
          <textarea
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-y"
            rows={3}
            value={form.description}
            placeholder="Context, notes about this source…"
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Source notes</label>
          <textarea
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-y"
            rows={2}
            value={form.source_notes}
            placeholder="Additional context passed to the AI during ingest…"
            onChange={(e) => setForm({ ...form, source_notes: e.target.value })}
          />
        </div>

        <div className="flex gap-2 pt-1">
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Saving…" : saved ? "Saved ✓" : "Save"}
          </button>
          {hasSource && (
            <button
              onClick={handleIngest}
              disabled={ingesting}
              className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
            >
              {ingesting ? "Ingesting…" : contenu.summary ? "Re-ingest" : "Ingest"}
            </button>
          )}
        </div>
      </div>

      {/* Ingested content */}
      {(form.content_raw || form.summary) && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h2 className="text-base font-semibold text-gray-800">Ingested content</h2>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Summary (used for post generation)</label>
            <textarea
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-y font-mono"
              rows={10}
              value={form.summary}
              onChange={(e) => setForm({ ...form, summary: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Raw content</label>
            <textarea
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-y font-mono text-gray-500"
              rows={6}
              value={form.content_raw}
              onChange={(e) => setForm({ ...form, content_raw: e.target.value })}
            />
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Saving…" : saved ? "Saved ✓" : "Save changes"}
          </button>
        </div>
      )}
    </div>
  );
}
