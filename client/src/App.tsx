import { useState } from "react";
import { BrowserRouter, Routes, Route, NavLink } from "react-router";
import { Dashboard } from "./pages/Dashboard";
import { PostsList } from "./pages/PostsList";
import { StylesList } from "./pages/StylesList";
import { TemplatesList } from "./pages/TemplatesList";
import { ContenusList } from "./pages/ContenusList";
import { Settings } from "./pages/Settings";
import { PostDetail } from "./pages/PostDetail";
import { LinkedInHistory } from "./pages/LinkedInHistory";

const navItems = [
  { to: "/", label: "Dashboard", icon: "⊞" },
  { to: "/posts", label: "Posts", icon: "✏️" },
  { to: "/styles", label: "Styles", icon: "🎨" },
  { to: "/templates", label: "Templates", icon: "📋" },
  { to: "/contenus", label: "Contenus", icon: "📝" },
  { to: "/linkedin", label: "LinkedIn", icon: "🔗" },
  { to: "/settings", label: "Settings", icon: "⚙️" },
];

function SidebarNav({ onClose }: { onClose?: () => void }) {
  return (
    <>
      <div className="p-4 border-b border-gray-200 flex items-start justify-between">
        <div>
          <img src="/spielben-logo.png" alt="Spielben & Co." className="h-10 w-auto" />
          <h1 className="text-xl font-bold tracking-tight mt-2">LINK'DUP</h1>
          <p className="text-xs text-gray-500 mt-0.5">LinkedIn Content Generator</p>
        </div>
        {onClose && (
          <button
            className="p-1 rounded text-gray-400 hover:text-gray-600 mt-1"
            onClick={onClose}
            aria-label="Close menu"
          >
            ✕
          </button>
        )}
      </div>
      <ul className="flex-1 py-2 overflow-y-auto">
        {navItems.map(({ to, label, icon }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={to === "/"}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 text-sm ${
                  isActive
                    ? "bg-blue-50 text-blue-700 font-medium border-r-2 border-blue-700"
                    : "text-gray-700 hover:bg-gray-50"
                }`
              }
            >
              <span className="text-base leading-none">{icon}</span>
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </>
  );
}

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <BrowserRouter>
      <div className="flex h-screen bg-gray-50 overflow-hidden">

        {/* ── Desktop sidebar — always visible, never on mobile ── */}
        <nav className="hidden md:flex md:w-56 bg-white border-r border-gray-200 flex-col shrink-0">
          <SidebarNav />
        </nav>

        {/* ── Mobile drawer overlay ── */}
        {sidebarOpen && (
          <div className="md:hidden fixed inset-0 z-40 flex">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/40"
              onClick={() => setSidebarOpen(false)}
            />
            {/* Drawer */}
            <nav className="relative z-50 w-64 max-w-[80vw] bg-white flex flex-col shadow-xl">
              <SidebarNav onClose={() => setSidebarOpen(false)} />
            </nav>
          </div>
        )}

        {/* ── Main content area ── */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

          {/* Mobile top bar */}
          <header className="md:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200 shrink-0">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-1.5 rounded-lg text-gray-600 hover:bg-gray-100"
              aria-label="Open menu"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <span className="font-bold text-lg tracking-tight">LINK'DUP</span>
          </header>

          {/* Page content */}
          <main className="flex-1 overflow-auto p-4 md:p-6">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/posts" element={<PostsList />} />
              <Route path="/posts/:id" element={<PostDetail />} />
              <Route path="/styles" element={<StylesList />} />
              <Route path="/templates" element={<TemplatesList />} />
              <Route path="/contenus" element={<ContenusList />} />
              <Route path="/linkedin" element={<LinkedInHistory />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </main>
        </div>
      </div>
    </BrowserRouter>
  );
}
