import { BrowserRouter, Routes, Route, NavLink } from "react-router";
import { Dashboard } from "./pages/Dashboard";
import { PostsList } from "./pages/PostsList";
import { StylesList } from "./pages/StylesList";
import { TemplatesList } from "./pages/TemplatesList";
import { ContenusList } from "./pages/ContenusList";
import { Settings } from "./pages/Settings";
import { PostDetail } from "./pages/PostDetail";

const navItems = [
  { to: "/", label: "Dashboard" },
  { to: "/posts", label: "Posts" },
  { to: "/styles", label: "Styles" },
  { to: "/templates", label: "Templates" },
  { to: "/contenus", label: "Contenus" },
  { to: "/settings", label: "Settings" },
];

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex h-screen bg-gray-50">
        {/* Sidebar */}
        <nav className="w-56 bg-white border-r border-gray-200 flex flex-col">
          <div className="p-4 border-b border-gray-200">
            <h1 className="text-xl font-bold tracking-tight">LINK'DUP</h1>
            <p className="text-xs text-gray-500 mt-0.5">LinkedIn Content Generator</p>
          </div>
          <ul className="flex-1 py-2">
            {navItems.map(({ to, label }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={to === "/"}
                  className={({ isActive }) =>
                    `block px-4 py-2 text-sm ${
                      isActive
                        ? "bg-blue-50 text-blue-700 font-medium border-r-2 border-blue-700"
                        : "text-gray-700 hover:bg-gray-50"
                    }`
                  }
                >
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* Main content */}
        <main className="flex-1 overflow-auto p-6">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/posts" element={<PostsList />} />
            <Route path="/posts/:id" element={<PostDetail />} />
            <Route path="/styles" element={<StylesList />} />
            <Route path="/templates" element={<TemplatesList />} />
            <Route path="/contenus" element={<ContenusList />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
