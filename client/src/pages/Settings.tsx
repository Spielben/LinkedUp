import { useEffect, useState, useCallback } from "react";

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

interface LinkedInStatus {
  connected: boolean;
  name?: string;
}

const SUPPORTED_LANGUAGES = [
  { code: "fr", label: "Français" },
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "de", label: "Deutsch" },
  { code: "pt", label: "Português" },
  { code: "it", label: "Italiano" },
  { code: "nl", label: "Nederlands" },
] as const;

export function Settings() {
  const [settings, setSettings] = useState<SettingsData>({});
  const [saved, setSaved] = useState(false);
  const [linkedinStatus, setLinkedinStatus] = useState<LinkedInStatus>({ connected: false });
  const [linkedinLoading, setLinkedinLoading] = useState(false);

  const checkLinkedinStatus = useCallback(() => {
    fetch("/api/linkedin/status").then((r) => r.json()).then(setLinkedinStatus);
  }, []);

  const connectLinkedin = async () => {
    setLinkedinLoading(true);
    try {
      const res = await fetch("/api/linkedin/auth");
      const { url } = await res.json();
      const popup = window.open(url, "linkedin-auth", "width=600,height=700");

      // Listen for the callback message
      const handler = (e: MessageEvent) => {
        if (e.data === "linkedin-connected") {
          window.removeEventListener("message", handler);
          checkLinkedinStatus();
          setLinkedinLoading(false);
        }
      };
      window.addEventListener("message", handler);

      // Fallback: check status after popup closes
      const interval = setInterval(() => {
        if (popup?.closed) {
          clearInterval(interval);
          window.removeEventListener("message", handler);
          checkLinkedinStatus();
          setLinkedinLoading(false);
        }
      }, 1000);
    } catch {
      setLinkedinLoading(false);
    }
  };

  const disconnectLinkedin = async () => {
    await fetch("/api/linkedin/disconnect", { method: "POST" });
    setLinkedinStatus({ connected: false });
  };

  useEffect(() => {
    fetch("/api/settings").then((r) => r.json()).then(setSettings);
    checkLinkedinStatus();
  }, [checkLinkedinStatus]);

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
            {SUPPORTED_LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Monthly AI Budget (USD)</label>
          <p className="text-xs text-gray-500 mb-2">OpenRouter monthly spend cap</p>
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
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, idx) => {
              const dayNum = idx;
              const daysString = settings.preferred_post_days || "";
              const selectedDays = daysString
                .split(",")
                .map((d) => parseInt(d.trim(), 10))
                .filter((d) => !Number.isNaN(d));
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

      <h3 className="text-lg font-semibold mt-8 mb-4">LinkedIn API</h3>
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        {linkedinStatus.connected ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="inline-block w-3 h-3 rounded-full bg-green-500" />
              <span className="text-sm text-gray-700">
                Connected{linkedinStatus.name ? ` as ${linkedinStatus.name}` : ""}
              </span>
            </div>
            <button
              onClick={disconnectLinkedin}
              className="text-sm text-red-600 hover:text-red-700 font-medium"
            >
              Disconnect
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Connect your LinkedIn account to publish posts directly from LINK'DUP.
            </p>
            <button
              onClick={connectLinkedin}
              disabled={linkedinLoading}
              className="bg-[#0A66C2] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#004182] disabled:opacity-50"
            >
              {linkedinLoading ? "Connecting..." : "Connect LinkedIn"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
