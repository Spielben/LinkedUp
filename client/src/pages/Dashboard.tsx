import { useEffect } from "react";
import { usePostsStore } from "../stores/posts";
import { useStylesStore } from "../stores/styles";
import { useTemplatesStore } from "../stores/templates";
import { useContenusStore } from "../stores/contenus";

export function Dashboard() {
  const posts = usePostsStore((s) => s.posts);
  const styles = useStylesStore((s) => s.styles);
  const templates = useTemplatesStore((s) => s.templates);
  const contenus = useContenusStore((s) => s.contenus);

  const fetchPosts = usePostsStore((s) => s.fetch);
  const fetchStyles = useStylesStore((s) => s.fetch);
  const fetchTemplates = useTemplatesStore((s) => s.fetch);
  const fetchContenus = useContenusStore((s) => s.fetch);

  useEffect(() => {
    fetchPosts();
    fetchStyles();
    fetchTemplates();
    fetchContenus();
  }, []);

  const cards = [
    { label: "Posts", count: posts.length, href: "/posts", color: "text-blue-600" },
    { label: "Styles", count: styles.length, href: "/styles", color: "text-purple-600" },
    { label: "Templates", count: templates.length, href: "/templates", color: "text-orange-600" },
    { label: "Contenus", count: contenus.length, href: "/contenus", color: "text-green-600" },
  ];

  const published = posts.filter((p) => p.status === "Publié").length;
  const scheduled = posts.filter((p) => p.status === "Programmé").length;
  const drafts = posts.filter((p) => p.status === "Brouillon").length;

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Dashboard</h2>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
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

      {posts.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="font-medium mb-3">Post Status</h3>
          <div className="flex gap-6 text-sm">
            <span className="text-green-600">{published} published</span>
            <span className="text-teal-600">{scheduled} scheduled</span>
            <span className="text-blue-600">{drafts} drafts</span>
            <span className="text-yellow-600">{posts.length - published - scheduled - drafts} ideas</span>
          </div>
        </div>
      )}
    </div>
  );
}
