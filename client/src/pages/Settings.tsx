import { useEffect, useRef, useState, useCallback } from "react";
import { apiFetch, apiUrl, readApiJson } from "../lib/api";

interface SettingsData {
  name?: string;
  email?: string;
  linkedin_url?: string;
  signature?: string;
  budget_limit?: number;
  language?: string;
  preferred_post_days?: string;
  preferred_post_time?: string;
  timezone?: string;
  logo_path?: string | null;
  brand_identity_path?: string | null;
  brand_identity_text?: string | null;
}

const TIMEZONES = [
  { value: "Pacific/Honolulu",     label: "UTC-10  Hawaii" },
  { value: "America/Los_Angeles",  label: "UTC-8   Los Angeles, Vancouver" },
  { value: "America/Denver",       label: "UTC-7   Denver, Phoenix" },
  { value: "America/Chicago",      label: "UTC-6   Chicago, Mexico City" },
  { value: "America/New_York",     label: "UTC-5   New York, Toronto" },
  { value: "America/Sao_Paulo",    label: "UTC-3   São Paulo, Buenos Aires" },
  { value: "Europe/London",        label: "UTC+0   London, Dublin" },
  { value: "Europe/Paris",         label: "UTC+1   Paris, Berlin, Madrid" },
  { value: "Europe/Helsinki",      label: "UTC+2   Helsinki, Cairo" },
  { value: "Europe/Moscow",        label: "UTC+3   Moscow" },
  { value: "Asia/Dubai",           label: "UTC+4   Dubai, Abu Dhabi" },
  { value: "Asia/Karachi",         label: "UTC+5   Karachi, Islamabad" },
  { value: "Asia/Kolkata",         label: "UTC+5:30 Mumbai, New Delhi" },
  { value: "Asia/Dhaka",           label: "UTC+6   Dhaka, Almaty" },
  { value: "Asia/Bangkok",         label: "UTC+7   Bangkok, Phuket, Hanoi, Jakarta" },
  { value: "Asia/Singapore",       label: "UTC+8   Singapore, Hong Kong, KL" },
  { value: "Asia/Tokyo",           label: "UTC+9   Tokyo, Seoul" },
  { value: "Australia/Sydney",     label: "UTC+10  Sydney, Melbourne" },
  { value: "Pacific/Auckland",     label: "UTC+12  Auckland" },
] as const;

interface LinkedInStatus {
  connected: boolean;
  name?: string;
}

const SUPPORTED_LANGUAGES = [
  { code: "en", label: "English" },
  { code: "fr", label: "Français" },
  { code: "es", label: "Español" },
  { code: "de", label: "Deutsch" },
  { code: "pt", label: "Português" },
  { code: "it", label: "Italiano" },
  { code: "nl", label: "Nederlands" },
] as const;

export function Settings() {
  const [settings, setSettings] = useState<SettingsData>({});
  const [saved, setSaved] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [brandUploading, setBrandUploading] = useState(false);
  const [brandError, setBrandError] = useState<string | null>(null);
  const [brandSuccess, setBrandSuccess] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const brandInputRef = useRef<HTMLInputElement>(null);
  const [linkedinStatus, setLinkedinStatus] = useState<LinkedInStatus>({ connected: false });
  const [linkedinLoading, setLinkedinLoading] = useState(false);
  const [linkedinError, setLinkedinError] = useState<string | null>(null);
  const [linkedinSetup, setLinkedinSetup] = useState<{
    hasClientId: boolean;
    hasClientSecret: boolean;
    redirectUri: string;
    checklist: string[];
  } | null>(null);

  const checkLinkedinStatus = useCallback(async () => {
    try {
      const res = await apiFetch("/api/linkedin/status");
      const data = await readApiJson<LinkedInStatus>(res);
      setLinkedinStatus(data);
    } catch {
      setLinkedinStatus({ connected: false });
    }
  }, []);

  const connectLinkedin = async () => {
    setLinkedinLoading(true);
    setLinkedinError(null);
    try {
      const ro = encodeURIComponent(window.location.origin);
      const res = await apiFetch(`/api/linkedin/auth?return_origin=${ro}`);
      const data = await readApiJson<{ url?: string; error?: string }>(res);
      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const url = data.url;
      if (!url) {
        throw new Error("No OAuth URL returned from server");
      }
      const popup = window.open(url, "linkedin-auth", "width=600,height=700");
      if (!popup) {
        throw new Error("Popup blocked — allow popups for this site and try again.");
      }

      let pollTimer: ReturnType<typeof setInterval> | null = null;

      const cleanup = () => {
        window.removeEventListener("message", handler);
        if (pollTimer !== null) {
          window.clearInterval(pollTimer);
          pollTimer = null;
        }
      };

      const handler = (e: MessageEvent) => {
        if (e.data === "linkedin-connected") {
          cleanup();
          void checkLinkedinStatus();
          setLinkedinLoading(false);
          return;
        }
        if (e.data && typeof e.data === "object" && e.data.type === "linkedin-oauth-error") {
          cleanup();
          setLinkedinError(String((e.data as { detail?: string }).detail || "LinkedIn authorization failed"));
          setLinkedinLoading(false);
        }
      };

      window.addEventListener("message", handler);

      pollTimer = window.setInterval(() => {
        if (popup?.closed) {
          cleanup();
          void checkLinkedinStatus();
          setLinkedinLoading(false);
        }
      }, 1000);
    } catch (e: unknown) {
      setLinkedinError(e instanceof Error ? e.message : String(e));
      setLinkedinLoading(false);
    }
  };

  const disconnectLinkedin = async () => {
    await apiFetch("/api/linkedin/disconnect", { method: "POST" });
    setLinkedinStatus({ connected: false });
  };

  useEffect(() => {
    void (async () => {
      try {
        const res = await apiFetch("/api/settings");
        setSettings(await readApiJson<SettingsData>(res));
      } catch {
        /* ignore */
      }
    })();
    void checkLinkedinStatus();
    void (async () => {
      try {
        const res = await apiFetch("/api/linkedin/setup");
        setLinkedinSetup(await readApiJson(res));
      } catch {
        setLinkedinSetup(null);
      }
    })();
  }, [checkLinkedinStatus]);

  const save = () => {
    apiFetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    }).then(async (r) => {
      if (r.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    });
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoUploading(true);
    setLogoError(null);
    try {
      const form = new FormData();
      form.append("logo", file);
      const res = await apiFetch("/api/settings/logo", { method: "POST", body: form });
      const data = await readApiJson<{ logo_path?: string; error?: string }>(res);
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "Upload failed");
      setSettings((s) => ({ ...s, logo_path: data.logo_path }));
    } catch (err: unknown) {
      setLogoError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setLogoUploading(false);
      if (logoInputRef.current) logoInputRef.current.value = "";
    }
  };

  const handleLogoDelete = async () => {
    setLogoError(null);
    await apiFetch("/api/settings/logo", { method: "DELETE" });
    setSettings((s) => ({ ...s, logo_path: null }));
  };

  const handleBrandUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBrandUploading(true);
    setBrandError(null);
    setBrandSuccess(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await apiFetch("/api/settings/brand-identity", { method: "POST", body: form });
      const data = await readApiJson<{ brand_identity_path?: string; chars?: number; filename?: string; error?: string }>(res);
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "Upload failed");
      setSettings((s) => ({ ...s, brand_identity_path: data.brand_identity_path }));
      setBrandSuccess(`"${data.filename}" uploaded — ${data.chars?.toLocaleString()} characters extracted`);
      setTimeout(() => setBrandSuccess(null), 5000);
    } catch (err: unknown) {
      setBrandError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBrandUploading(false);
      if (brandInputRef.current) brandInputRef.current.value = "";
    }
  };

  const handleBrandDelete = async () => {
    setBrandError(null);
    await apiFetch("/api/settings/brand-identity", { method: "DELETE" });
    setSettings((s) => ({ ...s, brand_identity_path: null, brand_identity_text: null }));
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
          <p className="text-xs text-gray-500 mb-1">Ingest summaries: English (default) or French. Use English for most international LinkedIn use cases.</p>
          <select
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            value={settings.language || "en"}
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
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
          <p className="text-xs text-gray-500 mb-2">
            Used to display publication dates in your local time.
          </p>
          <select
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            value={settings.timezone || "Asia/Bangkok"}
            onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
          >
            {TIMEZONES.map((tz) => (
              <option key={tz.value} value={tz.value}>
                {tz.label}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={save}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          {saved ? "Saved!" : "Save Settings"}
        </button>
      </div>

      {/* ── Logo ── */}
      <h3 className="text-lg font-semibold mt-8 mb-1">Brand Logo</h3>
      <p className="text-sm text-gray-500 mb-4">
        PNG, JPEG or WebP — up to 5 MB. Used as a visual identity marker on posts and exports.
      </p>
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        {logoError && (
          <div className="mb-3 bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm text-red-700 flex justify-between">
            <span>{logoError}</span>
            <button onClick={() => setLogoError(null)} className="text-red-400 hover:text-red-600 ml-2">✕</button>
          </div>
        )}
        {settings.logo_path ? (
          <div className="flex items-center gap-4">
            <img
              src={apiUrl(settings.logo_path)}
              alt="Brand logo"
              className="h-16 w-auto object-contain rounded border border-gray-200 bg-gray-50 p-1"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-700">Logo uploaded</p>
              <p className="text-xs text-gray-400 mt-0.5 break-all">{settings.logo_path}</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => logoInputRef.current?.click()}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                Replace
              </button>
              <button
                onClick={() => void handleLogoDelete()}
                className="text-sm text-red-600 hover:text-red-800 font-medium"
              >
                Remove
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">No logo uploaded yet.</p>
            <button
              onClick={() => logoInputRef.current?.click()}
              disabled={logoUploading}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {logoUploading ? "Uploading…" : "Upload Logo"}
            </button>
          </div>
        )}
        <input
          ref={logoInputRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/webp"
          onChange={(e) => void handleLogoUpload(e)}
          className="hidden"
        />
      </div>

      {/* ── Brand Identity ── */}
      <h3 className="text-lg font-semibold mt-8 mb-1">Brand Identity & Tone of Voice</h3>
      <p className="text-sm text-gray-500 mb-4">
        Upload a PDF, Word doc (.docx), or text file (.txt / .md) that describes your brand voice,
        writing style, persona, and communication guidelines. The content is extracted and
        automatically injected into every AI generation prompt.
      </p>
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        {brandError && (
          <div className="mb-3 bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm text-red-700 flex justify-between">
            <span>{brandError}</span>
            <button onClick={() => setBrandError(null)} className="text-red-400 hover:text-red-600 ml-2">✕</button>
          </div>
        )}
        {brandSuccess && (
          <div className="mb-3 bg-green-50 border border-green-200 rounded-lg px-4 py-2 text-sm text-green-700">
            {brandSuccess}
          </div>
        )}
        {settings.brand_identity_path ? (
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-50 border border-purple-200 flex items-center justify-center shrink-0 text-purple-600 text-lg">
                📄
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-700">Brand identity document loaded</p>
                <p className="text-xs text-gray-400 mt-0.5 break-all">{settings.brand_identity_path}</p>
                {settings.brand_identity_text && (
                  <p className="text-xs text-green-600 mt-1">
                    ✓ {settings.brand_identity_text.length.toLocaleString()} characters — active in AI generation
                  </p>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => brandInputRef.current?.click()}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  Replace
                </button>
                <button
                  onClick={() => void handleBrandDelete()}
                  className="text-sm text-red-600 hover:text-red-800 font-medium"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">No brand identity document uploaded.</p>
            <button
              onClick={() => brandInputRef.current?.click()}
              disabled={brandUploading}
              className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50"
            >
              {brandUploading ? "Processing…" : "Upload Document"}
            </button>
          </div>
        )}
        <input
          ref={brandInputRef}
          type="file"
          accept=".pdf,.docx,.txt,.md"
          onChange={(e) => void handleBrandUpload(e)}
          className="hidden"
        />
      </div>

      <h3 className="text-lg font-semibold mt-8 mb-4">LinkedIn API</h3>
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        {linkedinSetup && (!linkedinSetup.hasClientId || !linkedinSetup.hasClientSecret) && (
          <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-900">
            <p className="font-medium mb-2">LinkedIn app credentials missing in Keychain</p>
            <p className="mb-2 text-amber-800">
              Store <code className="bg-amber-100 px-1 rounded">linkedin_client_id</code> and{" "}
              <code className="bg-amber-100 px-1 rounded">linkedin_client_secret</code> for service{" "}
              <code className="bg-amber-100 px-1 rounded">linkdup</code> (see terminal:{" "}
              <code className="bg-amber-100 px-1 rounded">security add-generic-password</code>).
            </p>
            <p className="text-xs text-amber-800 mb-1">
              Redirect URL in LinkedIn Developer Portal must be exactly:{" "}
              <code className="break-all">{linkedinSetup.redirectUri}</code>
            </p>
            <ul className="list-disc list-inside text-xs text-amber-800 space-y-1 mt-2">
              {linkedinSetup.checklist.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        )}
        {linkedinError && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm text-red-700 flex justify-between gap-2">
            <span>{linkedinError}</span>
            <button type="button" onClick={() => setLinkedinError(null)} className="text-red-400 hover:text-red-600 shrink-0">
              ✕
            </button>
          </div>
        )}
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
