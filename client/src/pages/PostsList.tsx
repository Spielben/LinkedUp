import { useEffect, useState } from "react";

interface Post {
  id: number;
  subject: string | null;
  status: string;
  model: string;
  publication_date: string | null;
  created_at: string;
  style_name: string | null;
  template_name: string | null;
}

const statusColors: Record<string, string> = {
  "Idée": "bg-yellow-100 text-yellow-800",
  "Brouillon": "bg-blue-100 text-blue-800",
  "Programmé": "bg-teal-100 text-teal-800",
  "Publié": "bg-green-100 text-green-800",
  "❌ Erreur": "bg-red-100 text-red-800",
};

export function PostsList() {
  const [posts, setPosts] = useState<Post[]>([]);

  useEffect(() => {
    fetch("/api/posts").then((r) => r.json()).then(setPosts);
  }, []);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Posts</h2>
        <button
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
          onClick={() => {
            fetch("/api/posts", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ subject: "New post" }),
            })
              .then((r) => r.json())
              .then(() => fetch("/api/posts").then((r) => r.json()).then(setPosts));
          }}
        >
          + New Post
        </button>
      </div>

      {posts.length === 0 ? (
        <p className="text-gray-500">No posts yet. Create your first one!</p>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Subject</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Style</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
              </tr>
            </thead>
            <tbody>
              {posts.map((post) => (
                <tr key={post.id} className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer">
                  <td className="px-4 py-3">{post.subject || "(untitled)"}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[post.status] || "bg-gray-100 text-gray-800"}`}>
                      {post.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{post.style_name || "—"}</td>
                  <td className="px-4 py-3 text-gray-500">{post.publication_date || post.created_at.split("T")[0]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
