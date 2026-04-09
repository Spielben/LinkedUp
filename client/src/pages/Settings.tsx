import { useEffect, useState } from "react";

interface SettingsData {
  name?: string;
  email?: string;
  linkedin_url?: string;
  signature?: string;
  budget_limit?: number;
}

export function Settings() {
  const [settings, setSettings] = useState<SettingsData>({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/settings").then((r) => r.json()).then(setSettings);
  }, []);

  const save = () => {
    fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    }).then(() => {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  };

  return (
    <div className="max-w-lg">
      <h2 className="text-2xl font-bold mb-6">Settings</h2>

      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
          <input
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            value={settings.name || ""}
            onChange={(e) => setSettings({ ...settings, name: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            value={settings.email || ""}
            onChange={(e) => setSettings({ ...settings, email: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">LinkedIn URL</label>
          <input
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            value={settings.linkedin_url || ""}
            onChange={(e) => setSettings({ ...settings, linkedin_url: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Post Signature</label>
          <textarea
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            rows={2}
            value={settings.signature || ""}
            onChange={(e) => setSettings({ ...settings, signature: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Monthly Budget (USD)</label>
          <input
            type="number"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            value={settings.budget_limit || ""}
            onChange={(e) => setSettings({ ...settings, budget_limit: parseFloat(e.target.value) || undefined })}
          />
        </div>
        <button
          onClick={save}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          {saved ? "Saved!" : "Save Settings"}
        </button>
      </div>
    </div>
  );
}
