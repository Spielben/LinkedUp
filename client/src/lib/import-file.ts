import { apiUrl } from "./api";

export async function importFile(
  file: File,
  table: "styles" | "templates" | "contenus"
): Promise<{ imported: number; skipped: number; total: number }> {
  const formData = new FormData();
  formData.append("table", table);
  formData.append("file", file);

  const res = await fetch(apiUrl("/api/import/csv"), {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Import failed");
  }

  return res.json();
}
