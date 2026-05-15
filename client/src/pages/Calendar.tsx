import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { usePostsStore } from "../stores/posts";
import { apiFetch } from "../lib/api";

// ── Date helpers ──────────────────────────────────────────────────────────────

function todayKey(timezone: string): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

function toDateKey(utcStr: string, timezone: string): string {
  try {
    const iso = utcStr.replace(" ", "T") + (utcStr.endsWith("Z") ? "" : "Z");
    return new Intl.DateTimeFormat("sv-SE", {
      timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
    }).format(new Date(iso));
  } catch { return ""; }
}

function addMonths(key: string, n: number): string {
  const [y, m] = key.split("-").map(Number);
  const dt = new Date(y, m - 1 + n, 1);
  return [dt.getFullYear(), String(dt.getMonth() + 1).padStart(2, "0"), "01"].join("-");
}

function getMonthCells(anchorKey: string): (string | null)[] {
  const [y, m] = anchorKey.split("-").map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const startDow = new Date(y, m - 1, 1).getDay(); // 0 = Sun
  const pad = startDow === 0 ? 6 : startDow - 1;
  const cells: (string | null)[] = Array(pad).fill(null);
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(
      `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`
    );
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function fmtMonthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

// ── Status → color ────────────────────────────────────────────────────────────

interface StatusStyle { bg: string; color: string }

function statusStyle(status: string): StatusStyle {
  if (status === "Published") return { bg: "var(--gr-lo)",              color: "var(--gr)" };
  if (status === "Scheduled") return { bg: "var(--am-lo)",              color: "var(--am)" };
  if (status === "Draft")     return { bg: "var(--s3)",                 color: "var(--mu)" };
  return                              { bg: "var(--s3)",                 color: "var(--mu)" };
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface CalPost { id: number; subject: string | null; status: string }

// ── Constants ─────────────────────────────────────────────────────────────────

const DAY_HEADERS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MAX_VISIBLE = 3;

const LEGEND = [
  { label: "Published", dot: "var(--gr)" },
  { label: "Scheduled", dot: "var(--am)" },
  { label: "Draft",     dot: "var(--mu)" },
];

// ── Calendar page ─────────────────────────────────────────────────────────────

export function Calendar() {
  const navigate   = useNavigate();
  const posts      = usePostsStore((s) => s.posts);
  const fetchPosts = usePostsStore((s) => s.fetch);

  const [timezone, setTimezone] = useState("Asia/Bangkok");
  const [navKey,   setNavKey]   = useState<string>(currentMonthKey);

  useEffect(() => {
    void fetchPosts();
    void (async () => {
      try {
        const res  = await apiFetch("/api/settings");
        const data = (await res.json()) as { timezone?: string };
        if (data.timezone?.trim()) setTimezone(data.timezone.trim());
      } catch { /* keep default */ }
    })();
  }, [fetchPosts]);

  const today = useMemo(() => todayKey(timezone), [timezone]);
  const cells = useMemo(() => getMonthCells(navKey), [navKey]);

  const postsByDate = useMemo(() => {
    const map = new Map<string, CalPost[]>();
    for (const p of posts) {
      if (!p.publication_date) continue;
      const key = toDateKey(p.publication_date, timezone);
      if (!key) continue;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push({ id: p.id, subject: p.subject, status: p.status });
    }
    return map;
  }, [posts, timezone]);

  const handlePrev  = () => setNavKey((k) => addMonths(k, -1));
  const handleNext  = () => setNavKey((k) => addMonths(k, 1));
  const handleToday = () => setNavKey(currentMonthKey());

  return (
    <div className="flex flex-col gap-4">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap">

        {/* Month navigation */}
        <div className="flex items-center gap-1">
          <button
            onClick={handlePrev}
            className="w-8 h-8 flex items-center justify-center rounded-lg border text-sm transition-colors hover:bg-[var(--s2)]"
            style={{ borderColor: "var(--bd)", color: "var(--mu)" }}
          >‹</button>
          <button
            onClick={handleToday}
            className="px-3 py-1.5 text-xs border rounded-lg font-bold transition-colors hover:bg-[var(--s2)]"
            style={{ borderColor: "var(--bd)", color: "var(--tx)" }}
          >Today</button>
          <button
            onClick={handleNext}
            className="w-8 h-8 flex items-center justify-center rounded-lg border text-sm transition-colors hover:bg-[var(--s2)]"
            style={{ borderColor: "var(--bd)", color: "var(--mu)" }}
          >›</button>
        </div>

        <h2
          className="text-xl font-extrabold tracking-tight"
          style={{ fontFamily: "var(--display)", color: "var(--tx)" }}
        >
          {fmtMonthLabel(navKey)}
        </h2>

        {/* Legend */}
        <div className="ml-auto flex items-center gap-4 flex-wrap">
          {LEGEND.map(({ label, dot }) => (
            <span
              key={label}
              className="flex items-center gap-1.5 text-xs font-semibold"
              style={{ color: "var(--mu)" }}
            >
              <span className="w-2 h-2 rounded-full inline-block" style={{ background: dot }} />
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* ── Calendar grid ────────────────────────────────────────────────────── */}
      <div
        className="rounded-[10px] border overflow-hidden"
        style={{ borderColor: "var(--bd)", background: "var(--s3)" }}
      >
        {/* Day column headers */}
        <div className="grid grid-cols-7" style={{ background: "var(--s2)" }}>
          {DAY_HEADERS.map((d) => (
            <div
              key={d}
              className="py-2.5 text-center text-[10px] font-bold uppercase tracking-widest"
              style={{ color: "var(--mu)", fontFamily: "var(--mono)" }}
            >
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7 gap-px">
          {cells.map((key, i) => {
            /* Padding cell (empty — before month starts) */
            if (!key) {
              return (
                <div
                  key={`pad-${i}`}
                  className="min-h-[110px]"
                  style={{ background: "var(--s2)" }}
                />
              );
            }

            const isToday   = key === today;
            const dayPosts  = postsByDate.get(key) ?? [];
            const [, , d]   = key.split("-").map(Number);
            const overflow  = dayPosts.length - MAX_VISIBLE;

            return (
              <div
                key={key}
                className="min-h-[110px] p-2 flex flex-col gap-1"
                style={{
                  background: isToday ? "var(--or-lo)" : "var(--s1)",
                  boxShadow:  isToday ? "inset 0 0 0 2px var(--or)" : undefined,
                }}
              >
                {/* Day number + TODAY badge */}
                <div className="flex items-center gap-1.5 mb-0.5 shrink-0">
                  <span
                    className="w-5 h-5 flex items-center justify-center rounded-full text-[11px] font-extrabold leading-none"
                    style={{
                      background:  isToday ? "var(--or)" : "transparent",
                      color:       isToday ? "#fff" : "var(--tx)",
                      fontFamily:  "var(--num)",
                    }}
                  >
                    {d}
                  </span>
                  {isToday && (
                    <span
                      className="text-[7px] font-black uppercase tracking-widest px-1 py-px rounded-[3px]"
                      style={{ background: "var(--or)", color: "#fff", fontFamily: "var(--mono)" }}
                    >
                      TODAY
                    </span>
                  )}
                </div>

                {/* Post chips */}
                <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                  {dayPosts.slice(0, MAX_VISIBLE).map((p) => {
                    const { bg, color } = statusStyle(p.status);
                    return (
                      <button
                        key={p.id}
                        onClick={() => navigate(`/posts/${p.id}`)}
                        title={p.subject ?? "(untitled)"}
                        className="w-full text-left text-[10px] font-semibold px-1.5 py-[3px] rounded-[4px] truncate leading-tight transition-opacity hover:opacity-80"
                        style={{ background: bg, color }}
                      >
                        {p.subject ?? "(untitled)"}
                      </button>
                    );
                  })}
                  {overflow > 0 && (
                    <span
                      className="text-[9px] font-bold pl-1"
                      style={{ color: "var(--mu)", fontFamily: "var(--mono)" }}
                    >
                      +{overflow} more
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
