import Link from "next/link";
import { redirect } from "next/navigation";
import { Button, Card, CardBody, CardHeader, PageHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { projectAccessWhere } from "@/lib/projectAccess";
import { requirePeopleManager } from "@/lib/peopleAccess";
import { orgTimeZone } from "@/lib/orgTimezone";
import { formatInTimeZone } from "@/lib/timezone";
import { createProject } from "./actions";

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const orgId = await requirePeopleManager();
  const profile = await db.profile.findUnique({ where: { orgId }, select: { id: true } });
  if (!profile) redirect("/people?need_profile=1");
  const [projects, timezone, query] = await Promise.all([
    db.project.findMany({
      where: projectAccessWhere(orgId),
      orderBy: { updatedAt: "desc" },
      include: {
        organization: { select: { name: true } },
        members: { select: { orgId: true } },
        tasks: { where: { done: false }, select: { id: true } },
      },
    }),
    orgTimeZone(orgId),
    searchParams,
  ]);
  return (
    <div className="min-w-0 space-y-6">
      <PageHeader title="Projects" description="Shared workspaces with people and businesses you're connected to." actions={<Link className="text-sm text-[var(--vx-accent-600)] hover:underline" href="/people">People</Link>} />
      <Card>
        <CardHeader title="New project" />
        <CardBody>
          {query.error === "title" && <p role="alert" className="mb-3 text-sm text-red-700">Enter a project title of 1–120 characters.</p>}
          <form action={createProject} className="grid min-w-0 gap-3 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
            <label className="min-w-0 text-sm font-medium text-zinc-700">Title<input className="mt-1 block min-h-10 w-full rounded-md border border-zinc-300 px-3" name="title" maxLength={120} required /></label>
            <label className="min-w-0 text-sm font-medium text-zinc-700">Description (optional)<input className="mt-1 block min-h-10 w-full rounded-md border border-zinc-300 px-3" name="description" maxLength={2000} /></label>
            <Button type="submit">Create project</Button>
          </form>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Your projects" />
        <CardBody className="min-w-0">
          {projects.length ? (
            <div className="divide-y divide-zinc-200">
              {projects.map((project) => (
                <Link key={project.id} href={`/people/projects/${project.id}`} className="flex min-w-0 flex-col gap-2 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="break-words font-medium text-zinc-900">{project.title}</p>
                    <p className="mt-1 text-sm text-zinc-500">Owned by {project.organization.name} · {project.members.length + 1} organizations · {project.tasks.length} open tasks</p>
                  </div>
                  <time className="shrink-0 text-xs text-zinc-500">{formatInTimeZone(project.updatedAt, timezone, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</time>
                </Link>
              ))}
            </div>
          ) : <p className="text-sm text-zinc-600">No shared projects yet.</p>}
        </CardBody>
      </Card>
    </div>
  );
}
