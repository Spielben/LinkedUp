import { useEffect, useState } from "react";

interface Stats {
  posts: number;
  styles: number;
  templates: number;
  contenus: number;
}

export function Dashboard() {
  const [stats, setStats] = useState<Stats>({ posts: 0, styles: 0, templates: 0, contenus: 0 });

  useEffect(() => {
    Promise.all([
      fetch("/api/posts").then((r) => r.json()),
      fetch("/api/styles").then((r) => r.json()),
      fetch("/api/templates").then((r) => r.json()),
      fetch("/api/contenus").then((r) => r.json()),
    ]).then(([posts, styles, templates, contenus]) => {
      setStats({
        posts: posts.length,
        styles: styles.length,
        templates: templates.length,
        contenus: contenus.length,
      });
    });
  }, []);

  const cards = [
    { label: "Posts", count: stats.posts, href: "/posts" },
    { label: "Styles", count: stats.styles, href: "/styles" },
    { label: "Templates", count: stats.templates, href: "/templates" },
    { label: "Contenus", count: stats.contenus, href: "/contenus" },
  ];

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Dashboard</h2>
      <div className="grid grid-cols-2 gap-4 max-w-xl">
        {cards.map(({ label, count, href }) => (
          <a
            key={label}
            href={href}
            className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow"
          >
            <p className="text-3xl font-bold">{count}</p>
            <p className="text-sm text-gray-500 mt-1">{label}</p>
          </a>
        ))}
      </div>
    </div>
  );
}
