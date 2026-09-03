import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { requireSuperadmin } from "@/lib/session";
import { getLandingConfig } from "@/lib/landing";
import LandingEditor from "./LandingEditor";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  await requireSuperadmin();
  const config = await getLandingConfig();
  return (
    <div>
      <PageHeader
        title="Customize site"
        description="Edit the words, sections and colors on vultrix.net's landing page."
      />
      <div className="mb-5 flex flex-wrap gap-3 text-sm">
        <Link href="/admin/landing/preview" target="_blank" className="font-medium text-zinc-900 underline">Preview</Link>
        <Link href="/" target="_blank" className="font-medium text-zinc-900 underline">View live</Link>
      </div>
      <LandingEditor initial={config} />
    </div>
  );
}
