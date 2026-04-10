import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router";
import { usePostsStore } from "../stores/posts";

const statusColors: Record<string, string> = {
  "Idée": "bg-yellow-100 text-yellow-800",
  "Brouillon": "bg-blue-100 text-blue-800",
  "Programmé": "bg-teal-100 text-teal-800",
  "Publié": "bg-green-100 text-green-800",
  "❌ Erreur": "bg-red-100 text-red-800",
};

export function PostsList() {
  const { posts, loading, fetch: fetchPosts, create: createPost } = usePostsStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [filteredPosts, setFilteredPosts] = useState(posts);

  const params = new URLSearchParams(location.search);
  const statusFilter = params.get("status");

  useEffect(() => {
    fetchPosts();
  }, []);

  useEffect(() => {
    if (statusFilter) {
      setFilteredPosts(posts.filter((p) => p.status === statusFilter));
    } else {
      setFilteredPosts(posts);
    }
  }, [posts, statusFilter]);

  const handleNew = async () => {
    const post = await createPost({ subject: "New post" });
    navigate(`/posts/${post.id}`);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold">Posts</h2>
          {statusFilter && (
            <div className="flex items-center gap-2 mt-2">
              <span className="text-sm text-gray-600">Filtering by: <strong>{statusFilter}</strong></span>
              <button
                onClick={() => navigate("/posts")}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Clear filter
              </button>
            </div>
          )}
        </div>
        <button
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
          onClick={handleNew}
        >
          + New Post
        </button>
      </div>

      {loading ? (
        <p className="text-gray-400">Loading...</p>
      ) : filteredPosts.length === 0 ? (
        <p className="text-gray-500">{statusFilter ? `No posts with status "${statusFilter}".` : "No posts yet. Create your first one!"}</p>
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
              {filteredPosts.map((post) => (
                <tr
                  key={post.id}
                  className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                  onClick={() => navigate(`/posts/${post.id}`)}
                >
                  <td className="px-4 py-3 font-medium">{post.subject || "(untitled)"}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[post.status] || "bg-gray-100 text-gray-800"}`}>
                      {post.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{post.style_name || "—"}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {post.publication_date
                      ? new Date(post.publication_date).toLocaleDateString()
                      : post.created_at.split(" ")[0]}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
