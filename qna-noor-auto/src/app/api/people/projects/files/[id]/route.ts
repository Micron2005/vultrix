import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { projectAccessWhere } from "@/lib/projectAccess";
import { requireUser } from "@/lib/session";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireUser();
  if (!user.orgId || (user.role !== "OWNER" && user.role !== "ADMIN")) {
    notFound();
  }
  const { id } = await params;
  const file = await db.projectFile.findFirst({
    where: {
      id,
      project: { is: projectAccessWhere(user.orgId) },
    },
    select: { name: true, mimeType: true, dataUrl: true },
  });
  if (!file) notFound();

  const prefix = `data:${file.mimeType};base64,`;
  if (!file.dataUrl.startsWith(prefix)) notFound();
  const base64 = file.dataUrl.slice(prefix.length);
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) notFound();
  const bytes = Buffer.from(base64, "base64");
  if (bytes.toString("base64") !== base64) notFound();

  const filename = file.name.replace(/[\u0000-\u001f\u007f"\\]/g, "_");
  const disposition =
    file.mimeType === "image/jpeg" ? "inline" : "attachment";
  return new Response(bytes, {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Length": String(bytes.length),
      "Content-Disposition": `${disposition}; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
