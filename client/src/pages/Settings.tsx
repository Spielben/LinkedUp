import { useEffect, useState } from "react";

interface SettingsData {
  name?: string;
  email?: string;
  linkedin_url?: string;
  signature?: string;
  budget_limit?: number;
  language?: string;
  preferred_post_days?: string;
  preferred_post_time?: string;
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
          <label className="block text-sm font-medium text-gray-700 mb-1">Language</label>
          <select
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            value={settings.language || "fr"}
            onChange={(e) => setSettings({ ...settings, language: e.target.value })}
          >
            <option value="fr">Français</option>
            <option value="en">English</option>
            <option value="es">Español</option>
            <option value="de">Deutsch</option>
            <option value="pt">Português</option>
            <option value="it">Italiano</option>
            <option value="nl">Nederlands</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Monthly AI Budget (USD)</label>
          <p className="text-xs text-gray-500 mb-2">OpenRouter spend cap</p>
          <input
            type="number"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            value={settings.budget_limit || ""}
            onChange={(e) => setSettings({ ...settings, budget_limit: parseFloat(e.target.value) || undefined })}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">Preferred Posting Days</label>
          <div className="grid grid-cols-7 gap-2">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day, idx) => {
              const dayNum = idx + 1;
              const daysString = settings.preferred_post_days || "";
              const selectedDays = daysString.split(",").map((d) => parseInt(d.trim(), 10));
              const isSelected = selectedDays.includes(dayNum);

              return (
                <button
                  key={day}
                  onClick={() => {
                    let updated: number[];
                    if (isSelected) {
                      updated = selectedDays.filter((d) => d !== dayNum);
                    } else {
                      updated = [...selectedDays, dayNum].sort((a, b) => a - b);
                    }
                    setSettings({
                      ...settings,
                      preferred_post_days: updated.length > 0 ? updated.join(",") : "",
                    });
                  }}
                  className={`px-2 py-2 rounded-lg text-xs font-medium ${
                    isSelected
                      ? "bg-blue-600 text-white"
                      : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Preferred Posting Time</label>
          <input
            type="time"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            value={settings.preferred_post_time || ""}
            onChange={(e) => setSettings({ ...settings, preferred_post_time: e.target.value })}
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
