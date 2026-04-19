import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { usePostsStore, type Post } from "../stores/posts";
import { useStylesStore } from "../stores/styles";
import { useTemplatesStore } from "../stores/templates";
import { useContenusStore } from "../stores/contenus";
import { apiFetch, apiUrl } from "../lib/api";
import { mediaRowsFromPost } from "../lib/post-media";

// ── Helpers ──────────────────────────────────────────────────────────────────

function getFirstImageUrl(post: Post): string | null {
  const rows = mediaRowsFromPost(post);
  if (rows.length === 0) return null;
  const first = rows[0];
  if (first.kind === "url") return first.ref.trim() || null;
  const ref = first.ref.trim();
  if (!ref) return null;
  return apiUrl(`/${ref.replace(/^\/+/, "")}`);
}

function getPostText(post: Post): string {
  if (post.final_version?.trim()) return post.final_version.trim();
  const sel = post.selected_version?.trim().toUpperCase();
  if (sel === "V1" && post.v1?.trim()) return post.v1.trim();
  if (sel === "V2" && post.v2?.trim()) return post.v2.trim();
  if (sel === "V3" && post.v3?.trim()) return post.v3.trim();
  return "";
}

function formatDate(
  dateStr: string | null,
  opts: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  },
  timezone?: string
): string {
  if (!dateStr) return "—";
  try {
    const iso = dateStr.replace(" ", "T");
    const withZ = iso.endsWith("Z") ? iso : iso + "Z";
    const finalOpts = timezone ? { ...opts, timeZone: timezone } : opts;
    return new Date(withZ).toLocaleString("en-GB", finalOpts);
  } catch {
    return dateStr;
  }
}

// ── LinkedIn-style post preview ───────────────────────────────────────────────

function LinkedInPostPreview({
  post,
  authorName,
  timezone,
}: {
  post: Post;
  authorName: string;
  timezone: string;
}) {
  const text = getPostText(post);
  const imageUrl = getFirstImageUrl(post);
  const [expanded, setExpanded] = useState(false);
  const MAX_CHARS = 300;
  const isLong = text.length > MAX_CHARS;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Profile header */}
      <div className="flex items-start gap-3 p-4 pb-3">
        <div className="w-12 h-12 rounded-full bg-[#0A66C2] flex items-center justify-center text-white font-bold text-lg flex-shrink-0 shadow-sm">
          {authorName.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-gray-900 truncate">
            {authorName}
          </p>
          <p className="text-xs text-gray-500">Phuket, Thailand · Production</p>
          <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
            🗓 {formatDate(post.publication_date, undefined, timezone)}
            <span className="inline-block w-1 h-1 rounded-full bg-gray-300 mx-1" />
            🌐
          </p>
        </div>
        <button className="ml-auto text-[#0A66C2] text-xs font-semibold border border-[#0A66C2] rounded-full px-3 py-1 hover:bg-blue-50 transition-colors flex-shrink-0">
          + Follow
        </button>
      </div>

      {/* Post text */}
      {text ? (
        <div className="px-4 pb-3">
          <p className="text-sm text-gray-800 whitespace-pre-line leading-relaxed">
            {isLong && !expanded
              ? text.slice(0, MAX_CHARS) + "…"
              : text}
          </p>
          {isLong && (
            <button
              className="text-xs text-gray-500 hover:text-gray-700 mt-1 font-medium"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? "…see less" : "…see more"}
            </button>
          )}
        </div>
      ) : (
        <div className="px-4 pb-3">
          <p className="text-sm text-gray-400 italic">
            (No content — select or write the final version in this post)
          </p>
        </div>
      )}

      {/* Image */}
      {imageUrl && (
        <div className="border-t border-gray-100">
          <img
            src={imageUrl}
            alt="Post media"
            className="w-full object-cover max-h-80"
          />
        </div>
      )}

      {/* Engagement bar (decorative) */}
      <div className="px-4 py-2 border-t border-gray-100 flex gap-1">
        {(["👍 Like", "💬 Comment", "↩ Repost", "✉ Send"] as const).map(
          (label) => (
            <button
              key={label}
              className="flex-1 text-xs text-gray-500 py-1.5 rounded hover:bg-gray-100 transition-colors font-medium"
            >
              {label}
            </button>
          )
        )}
      </div>
    </div>
  );
}

// ── Published post card (grid) ───────────────────────────────────────────────

function PublishedPostCard({
  post,
  onClick,
  timezone,
}: {
  post: Post;
  onClick: () => void;
  timezone: string;
}) {
  const text = getPostText(post);
  const imageUrl = getFirstImageUrl(post);

  return (
    <div
      className="bg-white rounded-xl border border-gray-200 overflow-hidden cursor-pointer hover:shadow-md hover:border-green-300 transition-all group"
      onClick={onClick}
    >
      {imageUrl ? (
        <div className="w-full h-32 overflow-hidden bg-gray-100">
          <img
            src={imageUrl}
            alt={post.subject || ""}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        </div>
      ) : (
        <div className="w-full h-16 bg-gradient-to-br from-green-50 to-teal-50 flex items-center justify-center border-b border-gray-100">
          <span className="text-2xl opacity-60">✅</span>
        </div>
      )}
      <div className="p-3">
        <p className="font-semibold text-sm text-gray-900 truncate mb-1">
          {post.subject || "(untitled)"}
        </p>
        <p className="text-xs text-green-600 font-medium mb-2 flex items-center gap-1">
          <span>✅</span>
          {formatDate(post.publication_date, {
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          }, timezone)}
        </p>
        {text && (
          <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">{text}</p>
        )}
      </div>
      <div className="px-3 pb-3">
        <span className="text-xs text-green-700 font-medium group-hover:underline">
          View preview →
        </span>
      </div>
    </div>
  );
}

// ── Scheduled post card (grid) ────────────────────────────────────────────────

function ScheduledPostCard({
  post,
  onClick,
  timezone,
}: {
  post: Post;
  onClick: () => void;
  timezone: string;
}) {
  const text = getPostText(post);
  const imageUrl = getFirstImageUrl(post);

  return (
    <div
      className="bg-white rounded-xl border border-gray-200 overflow-hidden cursor-pointer hover:shadow-md hover:border-teal-300 transition-all group"
      onClick={onClick}
    >
      {/* Thumbnail */}
      {imageUrl ? (
        <div className="w-full h-32 overflow-hidden bg-gray-100">
          <img
            src={imageUrl}
            alt={post.subject || ""}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        </div>
      ) : (
        <div className="w-full h-16 bg-gradient-to-br from-teal-50 to-blue-50 flex items-center justify-center border-b border-gray-100">
          <span className="text-2xl opacity-60">📋</span>
        </div>
      )}

      {/* Content */}
      <div className="p-3">
        <p className="font-semibold text-sm text-gray-900 truncate mb-1">
          {post.subject || "(untitled)"}
        </p>
        <p className="text-xs text-teal-600 font-medium mb-2 flex items-center gap-1">
          <span>🗓</span>
          {formatDate(post.publication_date, {
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          }, timezone)}
        </p>
        {text ? (
          <p className="text-xs text-gray-500 line-clamp-3 leading-relaxed">
            {text}
          </p>
        ) : (
          <p className="text-xs text-gray-400 italic">No content written</p>
        )}
      </div>

      <div className="px-3 pb-3">
        <span className="text-xs text-teal-700 font-medium group-hover:underline">
          Edit →
        </span>
      </div>
    </div>
  );
}

// ── Calendar helpers ──────────────────────────────────────────────────────────

interface CalPost { id: number; subject: string | null; status: string }

/** UTC SQLite date → "YYYY-MM-DD" in user timezone */
function toDateKey(utcStr: string, timezone: string): string {
  try {
    const iso = utcStr.replace(" ", "T") + (utcStr.endsWith("Z") ? "" : "Z");
    return new Intl.DateTimeFormat("sv-SE", {
      timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
    }).format(new Date(iso));
  } catch { return ""; }
}

/** Today's key in user timezone */
function todayKey(timezone: string): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

/** Add n days to a "YYYY-MM-DD" key (local date arithmetic) */
function addDays(key: string, n: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(y, m - 1, d + n);
  return [dt.getFullYear(), String(dt.getMonth() + 1).padStart(2, "0"), String(dt.getDate()).padStart(2, "0")].join("-");
}

/** Add n months to a "YYYY-MM-DD" key, returns first of that month */
function addMonths(key: string, n: number): string {
  const [y, m] = key.split("-").map(Number);
  const dt = new Date(y, m - 1 + n, 1);
  return [dt.getFullYear(), String(dt.getMonth() + 1).padStart(2, "0"), "01"].join("-");
}

/** 7 date keys for the week containing anchorKey (Mon–Sun) */
function getWeekDays(anchorKey: string): string[] {
  const [y, m, d] = anchorKey.split("-").map(Number);
  const dow = new Date(y, m - 1, d).getDay(); // 0=Sun
  const monday = addDays(anchorKey, dow === 0 ? -6 : 1 - dow);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

/** All day keys (or null for padding) for a calendar month grid (Mon-first) */
function getMonthCells(anchorKey: string): (string | null)[] {
  const [y, m] = anchorKey.split("-").map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const startDow = new Date(y, m - 1, 1).getDay(); // 0=Sun
  const pad = startDow === 0 ? 6 : startDow - 1;
  const cells: (string | null)[] = Array(pad).fill(null);
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(`${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function fmtMonthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

function fmtWeekRange(days: string[]): string {
  const fmt = (k: string) => {
    const [y, m, d] = k.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  };
  return `${fmt(days[0])} – ${fmt(days[6])}`;
}

// ── Calendar sub-components ───────────────────────────────────────────────────

function PostChip({ post, onClick }: { post: CalPost; onClick: () => void }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      title={post.subject ?? "(untitled)"}
      className={`w-full text-left text-xs px-1.5 py-0.5 rounded truncate font-medium leading-tight ${
        post.status === "Published"
          ? "bg-green-100 text-green-800 hover:bg-green-200"
          : "bg-teal-100 text-teal-800 hover:bg-teal-200"
      }`}
    >
      {post.subject ?? "(untitled)"}
    </button>
  );
}

function MiniMonth({
  monthKey,
  postsByDate,
  today,
  onPostClick,
}: {
  monthKey: string;
  postsByDate: Map<string, CalPost[]>;
  today: string;
  onPostClick: (id: number) => void;
}) {
  const cells = getMonthCells(monthKey);
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3">
      <p className="text-xs font-semibold text-gray-700 mb-2">{fmtMonthLabel(monthKey)}</p>
      <div className="grid grid-cols-7 gap-px">
        {["M","T","W","T","F","S","S"].map((h, i) => (
          <div key={i} className="text-center text-[10px] text-gray-400 pb-1">{h}</div>
        ))}
        {cells.map((key, i) => {
          if (!key) return <div key={i} className="h-6" />;
          const dayPosts = postsByDate.get(key) ?? [];
          const isToday = key === today;
          const [,,d] = key.split("-").map(Number);
          return (
            <div key={key} className="flex flex-col items-center gap-0.5 py-0.5">
              <div className={`text-[10px] w-5 h-5 flex items-center justify-center rounded-full font-medium ${
                isToday ? "bg-blue-600 text-white" : "text-gray-600"
              }`}>
                {d}
              </div>
              {dayPosts.length > 0 && (
                <div className="flex flex-wrap gap-px justify-center">
                  {dayPosts.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => onPostClick(p.id)}
                      title={p.subject ?? "(untitled)"}
                      className={`w-2 h-2 rounded-full ${p.status === "Published" ? "bg-green-500 hover:bg-green-700" : "bg-teal-500 hover:bg-teal-700"}`}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── PostCalendar ──────────────────────────────────────────────────────────────

function PostCalendar({
  posts,
  timezone,
  onPostClick,
}: {
  posts: Post[];
  timezone: string;
  onPostClick: (id: number) => void;
}) {
  type ViewMode = "week" | "month" | "6months";
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const today = useMemo(() => todayKey(timezone), [timezone]);
  const [navKey, setNavKey] = useState(today);

  // Map dateKey → posts
  const postsByDate = useMemo(() => {
    const map = new Map<string, CalPost[]>();
    for (const p of posts) {
      if (!p.publication_date) continue;
      if (p.status !== "Scheduled" && p.status !== "Published") continue;
      const key = toDateKey(p.publication_date, timezone);
      if (!key) continue;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push({ id: p.id, subject: p.subject, status: p.status });
    }
    return map;
  }, [posts, timezone]);

  // Navigation
  const handlePrev = () => {
    if (viewMode === "week")     setNavKey((k) => addDays(k, -7));
    if (viewMode === "month")    setNavKey((k) => addMonths(k, -1));
    if (viewMode === "6months")  setNavKey((k) => addMonths(k, -6));
  };
  const handleNext = () => {
    if (viewMode === "week")     setNavKey((k) => addDays(k, 7));
    if (viewMode === "month")    setNavKey((k) => addMonths(k, 1));
    if (viewMode === "6months")  setNavKey((k) => addMonths(k, 6));
  };
  const handleToday = () => setNavKey(today);

  const weekDays = useMemo(() => getWeekDays(navKey), [navKey]);
  const monthCells = useMemo(() => getMonthCells(navKey), [navKey]);
  const sixMonths = useMemo(
    () => Array.from({ length: 6 }, (_, i) => addMonths(navKey, i)),
    [navKey]
  );

  // Period label
  const periodLabel =
    viewMode === "week"
      ? fmtWeekRange(weekDays)
      : viewMode === "month"
      ? fmtMonthLabel(navKey)
      : `${fmtMonthLabel(navKey)} – ${fmtMonthLabel(sixMonths[5])}`;

  const DAY_HEADERS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <h3 className="font-semibold text-gray-700 shrink-0">Content Calendar</h3>

        {/* View toggle */}
        <div className="flex border border-gray-200 rounded-lg overflow-hidden ml-auto">
          {(["week", "month", "6months"] as ViewMode[]).map((v) => (
            <button
              key={v}
              onClick={() => { setViewMode(v); setNavKey(today); }}
              className={`px-3 py-1.5 text-xs font-medium transition ${
                viewMode === v ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {v === "6months" ? "6 months" : v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>

        {/* Navigation */}
        <div className="flex items-center gap-1">
          <button
            onClick={handlePrev}
            className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-100 text-sm"
          >‹</button>
          <button
            onClick={handleToday}
            className="px-2.5 py-1 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-100 font-medium"
          >Today</button>
          <button
            onClick={handleNext}
            className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-100 text-sm"
          >›</button>
        </div>

        <span className="text-sm font-medium text-gray-700 w-full sm:w-auto">{periodLabel}</span>
      </div>

      {/* ── Legend ── */}
      <div className="flex gap-4 mb-3 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-teal-500 inline-block" />Scheduled
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" />Published
        </span>
      </div>

      {/* ── Week view ── */}
      {viewMode === "week" && (
        <div className="overflow-x-auto -mx-1">
          <div className="grid grid-cols-7 min-w-[560px]">
            {weekDays.map((key, i) => {
              const isToday = key === today;
              const [,,d] = key.split("-").map(Number);
              return (
                <div key={key} className="text-center pb-2 border-b border-gray-100">
                  <div className={`text-xs font-medium ${isToday ? "text-blue-600" : "text-gray-400"}`}>
                    {DAY_HEADERS[i]}
                  </div>
                  <div className={`text-lg font-bold leading-tight ${isToday ? "text-blue-600" : "text-gray-800"}`}>
                    {d}
                  </div>
                </div>
              );
            })}
            {weekDays.map((key) => {
              const isToday = key === today;
              const dayPosts = postsByDate.get(key) ?? [];
              return (
                <div
                  key={key}
                  className={`min-h-[80px] border-r last:border-r-0 border-gray-100 p-1 space-y-1 ${
                    isToday ? "bg-blue-50" : ""
                  }`}
                >
                  {dayPosts.map((p) => (
                    <PostChip key={p.id} post={p} onClick={() => onPostClick(p.id)} />
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Month view ── */}
      {viewMode === "month" && (
        <div>
          <div className="grid grid-cols-7 mb-1">
            {DAY_HEADERS.map((h) => (
              <div key={h} className="text-center text-xs font-medium text-gray-400 py-1">{h}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-px bg-gray-100 rounded-lg overflow-hidden border border-gray-100">
            {monthCells.map((key, i) => {
              if (!key) return <div key={i} className="bg-gray-50 min-h-[64px]" />;
              const isToday = key === today;
              const dayPosts = postsByDate.get(key) ?? [];
              const [,,d] = key.split("-").map(Number);
              return (
                <div key={key} className={`bg-white p-1 min-h-[64px] ${isToday ? "bg-blue-50" : ""}`}>
                  <div className={`text-xs font-medium mb-1 w-5 h-5 flex items-center justify-center rounded-full ${
                    isToday ? "bg-blue-600 text-white" : "text-gray-500"
                  }`}>
                    {d}
                  </div>
                  <div className="space-y-0.5">
                    {dayPosts.slice(0, 2).map((p) => (
                      <PostChip key={p.id} post={p} onClick={() => onPostClick(p.id)} />
                    ))}
                    {dayPosts.length > 2 && (
                      <p className="text-[10px] text-gray-400 pl-1">+{dayPosts.length - 2} more</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 6-month view ── */}
      {viewMode === "6months" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {sixMonths.map((mk) => (
            <MiniMonth
              key={mk}
              monthKey={mk}
              postsByDate={postsByDate}
              today={today}
              onPostClick={onPostClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────

export function Dashboard() {
  const navigate = useNavigate();
  const posts = usePostsStore((s) => s.posts);
  const styles = useStylesStore((s) => s.styles);
  const templates = useTemplatesStore((s) => s.templates);
  const contenus = useContenusStore((s) => s.contenus);

  const fetchPosts = usePostsStore((s) => s.fetch);
  const fetchStyles = useStylesStore((s) => s.fetch);
  const fetchTemplates = useTemplatesStore((s) => s.fetch);
  const fetchContenus = useContenusStore((s) => s.fetch);

  const [authorName, setAuthorName] = useState("Spielben & Co");
  const [timezone, setTimezone] = useState("Asia/Bangkok");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);

  useEffect(() => {
    fetchPosts();
    fetchStyles();
    fetchTemplates();
    fetchContenus();
  }, []);

  // Fetch author name + timezone from settings
  useEffect(() => {
    void (async () => {
      try {
        const res = await apiFetch("/api/settings");
        const data = (await res.json()) as { name?: string | null; timezone?: string | null };
        if (data.name?.trim()) setAuthorName(data.name.trim());
        if (data.timezone?.trim()) setTimezone(data.timezone.trim());
      } catch {
        /* keep default */
      }
    })();
  }, []);

  const publishedPosts = posts
    .filter((p) => p.status === "Published")
    .sort((a, b) => {
      const dateA = a.publication_date || a.created_at;
      const dateB = b.publication_date || b.created_at;
      return dateB.localeCompare(dateA);
    });
  const lastThreePublished = publishedPosts.slice(0, 3);
  const pipelineCount = posts.filter((p) => p.status !== "Published").length;

  const cards = [
    { label: "Pipeline", count: pipelineCount, href: "/posts", color: "text-blue-600" },
    { label: "Published", count: publishedPosts.length, href: "/linkedin", color: "text-green-600" },
    { label: "Styles", count: styles.length, href: "/styles", color: "text-purple-600" },
    { label: "Templates", count: templates.length, href: "/templates", color: "text-orange-600" },
    { label: "Content", count: contenus.length, href: "/contenus", color: "text-teal-600" },
  ];

  const published = publishedPosts.length;
  const drafts = posts.filter((p) => p.status === "Draft").length;

  // Scheduled posts sorted by publication_date ascending — exclut ceux sans date
  const scheduledPosts = posts
    .filter((p) => p.status === "Scheduled" && p.publication_date)
    .sort((a, b) => {
      if (!a.publication_date) return 1;
      if (!b.publication_date) return -1;
      return a.publication_date.localeCompare(b.publication_date);
    });

  const scheduled = scheduledPosts.length;
  const nextThree = scheduledPosts.slice(0, 3);

  const openPreview = () => {
    setPreviewIndex(0);
    setPreviewOpen(true);
  };

  const closePreview = () => setPreviewOpen(false);

  const prevPost = () => setPreviewIndex((i) => Math.max(0, i - 1));
  const nextPost = () =>
    setPreviewIndex((i) => Math.min(scheduledPosts.length - 1, i + 1));

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h2 className="text-2xl font-bold">Dashboard</h2>
        <div className="flex gap-2">
          <button
            onClick={() => navigate("/contenus")}
            className="bg-teal-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-teal-700 transition"
          >
            + New Content
          </button>
          <button
            onClick={async () => {
              const { create } = usePostsStore.getState();
              const post = await create({ subject: "New post" });
              navigate(`/posts/${post.id}`);
            }}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition"
          >
            + New Post
          </button>
        </div>
      </div>

      {/* ── Summary cards ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        {cards.map(({ label, count, href, color }) => (
          <a
            key={label}
            href={href}
            className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow"
          >
            <p className={`text-3xl font-bold ${color}`}>{count}</p>
            <p className="text-sm text-gray-500 mt-1">{label}</p>
          </a>
        ))}
      </div>

      {/* ── Content Calendar ───────────────────────────────────────────────── */}
      <PostCalendar
        posts={posts}
        timezone={timezone}
        onPostClick={(id) => navigate(`/posts/${id}`)}
      />

      {/* ── Post Status ────────────────────────────────────────────────────── */}
      {posts.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <h3 className="font-medium mb-3">Post Status</h3>
          <div className="flex flex-wrap gap-6 text-sm">
            <button
              onClick={() => navigate("/linkedin")}
              className="text-green-600 hover:text-green-800 hover:underline cursor-pointer"
            >
              {published} published
            </button>

            {/* Scheduled → open preview modal */}
            <button
              onClick={scheduled > 0 ? openPreview : () => navigate("/posts?status=Scheduled")}
              className="text-teal-600 hover:text-teal-800 hover:underline cursor-pointer flex items-center gap-1"
            >
              {scheduled} scheduled
              {scheduled > 0 && (
                <span className="text-xs bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded-full font-medium">
                  preview
                </span>
              )}
            </button>

            <button
              onClick={() => navigate("/posts?status=Draft")}
              className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
            >
              {drafts} drafts
            </button>
            <button
              onClick={() => navigate("/posts?status=Idea")}
              className="text-yellow-600 hover:text-yellow-800 hover:underline cursor-pointer"
            >
              {posts.length - published - scheduled - drafts} ideas
            </button>
          </div>
        </div>
      )}

      {/* ── Grid : 3 prochains posts programmés ───────────────────────────── */}
      {nextThree.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-700">
              Upcoming Scheduled Posts
            </h3>
            {scheduledPosts.length > 3 && (
              <button
                onClick={() => navigate("/posts?status=Scheduled")}
                className="text-xs text-teal-600 hover:text-teal-800 hover:underline"
              >
                View all ({scheduledPosts.length}) →
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {nextThree.map((post) => (
              <ScheduledPostCard
                key={post.id}
                post={post}
                timezone={timezone}
                onClick={() => navigate(`/posts/${post.id}`)}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Grid : 3 derniers posts publiés ───────────────────────────────── */}
      {lastThreePublished.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-700">
              Recently Published
            </h3>
            {publishedPosts.length > 3 && (
              <button
                onClick={() => navigate("/linkedin")}
                className="text-xs text-green-600 hover:text-green-800 hover:underline"
              >
                View all ({publishedPosts.length}) →
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {lastThreePublished.map((post) => (
              <PublishedPostCard
                key={post.id}
                post={post}
                timezone={timezone}
                onClick={() => navigate(`/posts/${post.id}`)}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Modal : LinkedIn preview ───────────────────────────────────────── */}
      {previewOpen && scheduledPosts.length > 0 && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={closePreview}
        >
          <div
            className="bg-gray-50 rounded-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 sticky top-0 bg-gray-50 z-10 rounded-t-2xl">
              <div>
                <h3 className="font-semibold text-gray-900">
                  LinkedIn Preview
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  As it would appear on LinkedIn
                </p>
              </div>

              <div className="flex items-center gap-3">
                {/* Navigation between scheduled posts */}
                {scheduledPosts.length > 1 && (
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <button
                      onClick={prevPost}
                      disabled={previewIndex === 0}
                      className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      ‹
                    </button>
                    <span className="font-medium tabular-nums">
                      {previewIndex + 1}&thinsp;/&thinsp;{scheduledPosts.length}
                    </span>
                    <button
                      onClick={nextPost}
                      disabled={previewIndex === scheduledPosts.length - 1}
                      className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      ›
                    </button>
                  </div>
                )}
                <button
                  onClick={closePreview}
                  className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors text-lg"
                >
                  ×
                </button>
              </div>
            </div>

            {/* Preview content */}
            <div className="p-5">
              <LinkedInPostPreview
                post={scheduledPosts[previewIndex]}
                authorName={authorName}
                timezone={timezone}
              />

              {/* Subject label */}
              <p className="mt-3 text-xs text-gray-400 text-center truncate px-2">
                {scheduledPosts[previewIndex].subject || "(untitled)"}
              </p>

              {/* Action buttons */}
              <div className="mt-4 flex items-center justify-between">
                <button
                  onClick={closePreview}
                  className="text-xs text-gray-400 hover:text-gray-600"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    navigate(`/posts/${scheduledPosts[previewIndex].id}`);
                    closePreview();
                  }}
                  className="text-sm text-white bg-[#0A66C2] hover:bg-[#004182] px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  Edit this post →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
