import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Badge, Button, Card, CardBody, CardHeader, PageHeader, Textarea } from "@/components/ui";
import { db } from "@/lib/db";
import { groupShareCandidates } from "@/lib/people";
import { projectAccessWhere } from "@/lib/projectAccess";
import { requirePeopleManager } from "@/lib/peopleAccess";
import { orgTimeZone } from "@/lib/orgTimezone";
import { formatInTimeZone } from "@/lib/timezone";
import { songAccessWhere } from "@/lib/songAccess";
import {
  addProjectTask,
  assignProjectTask,
  deleteProjectFile,
  deleteProjectPost,
  deleteProjectTask,
  inviteProjectMember,
  leaveProject,
  linkProjectSong,
  removeProjectMember,
  saveProjectNotes,
  sendProjectPost,
  setProjectStatus,
  setProjectTaskDone,
  unlinkProjectSong,
  updateProjectDetails,
} from "../actions";
import { ConfirmProjectDelete } from "../ConfirmProjectDelete";
import { ProjectFileUploader } from "../ProjectFileUploader";
import { ProjectRefresh } from "../ProjectRefresh";

const errors: Record<string, string> = {
  title: "Enter a project title of 1–120 characters.",
  invite: "Only mutual connections can be invited, and a project can include at most 10 organizations.",
  task: "Enter a task title of 1–200 characters.",
  file: "Choose a valid JPEG image or PDF.",
  file_size: "Files must be 2 MB or smaller.",
  file_type: "Only resized JPEG images and PDFs are supported.",
  file_limit: "Projects can contain up to 30 files.",
  post_empty: "Write a post before sending.",
  post_long: "Posts must be 2,000 characters or fewer.",
  slow_down: "Please wait before posting again.",
  not_found: "This project is no longer available.",
};

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; body?: string }>;
}) {
  const orgId = await requirePeopleManager();
  const profile = await db.profile.findUnique({ where: { orgId }, select: { id: true } });
  if (!profile) redirect("/people?need_profile=1");
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const project = await db.project.findFirst({
    where: { id, ...projectAccessWhere(orgId) },
    include: {
      organization: { select: { name: true, profile: { select: { displayName: true } } } },
      members: { include: { organization: { select: { name: true, profile: { select: { displayName: true } } } } } },
      tasks: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
      files: { orderBy: { createdAt: "desc" }, select: { id: true, orgId: true, name: true, mimeType: true, sizeBytes: true, createdAt: true } },
      posts: { orderBy: { createdAt: "desc" }, take: 50, include: { authorOrg: { select: { name: true, profile: { select: { displayName: true } } } } } },
      songLinks: { include: { song: { select: { id: true, title: true, stage: true, orgId: true, members: { select: { orgId: true } } } } } },
    },
  });
  if (!project) notFound();
  const [timezone, followingRows, followerRows, songs, editorOrg] = await Promise.all([
    orgTimeZone(orgId),
    db.follow.findMany({ where: { followerId: profile.id }, include: { following: { select: { id: true, orgId: true, handle: true, displayName: true } } } }),
    db.follow.findMany({ where: { followingId: profile.id }, include: { follower: { select: { id: true, orgId: true, handle: true, displayName: true } } } }),
    db.song.findMany({ where: songAccessWhere(orgId), select: { id: true, title: true }, orderBy: { title: "asc" }, take: 100 }),
    project.notesUpdatedByOrgId
      ? db.organization.findUnique({ where: { id: project.notesUpdatedByOrgId }, select: { name: true } })
      : Promise.resolve(null),
  ]);
  const memberOrgIds = new Set([project.orgId, ...project.members.map((member) => member.orgId)]);
  const candidates = groupShareCandidates(
    followingRows.map((row) => row.following),
    followerRows.map((row) => row.follower),
    memberOrgIds,
  );
  const songIds = new Set(songs.map((song) => song.id));
  const posts = [...project.posts].reverse();
  const isOwner = project.orgId === orgId;
  const error = query.error ? errors[query.error] : undefined;
  const taskAction = (taskId: string, done: boolean) => setProjectTaskDone.bind(null, project.id, taskId, done);

  return (
    <div className="min-w-0 space-y-5">
      <PageHeader title={project.title} description={`Owned by ${project.organization.name}`} actions={<Link className="text-sm text-[var(--vx-accent-600)] hover:underline" href="/people/projects">All projects</Link>} />
      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <Badge tone={project.status === "done" ? "success" : "neutral"}>{project.status}</Badge>
        <span className="text-sm text-zinc-500">{project.members.length + 1} organizations</span>
        {!isOwner && <form action={leaveProject.bind(null, project.id)}><Button variant="secondary" type="submit">Leave project</Button></form>}
        {isOwner && <form action={setProjectStatus.bind(null, project.id, project.status === "done" ? "active" : "done")}><Button variant="secondary" type="submit">{project.status === "done" ? "Reopen" : "Mark done"}</Button></form>}
        {isOwner && <ConfirmProjectDelete projectId={project.id} />}
      </div>

      <Card>
        <CardHeader title="People" />
        <CardBody className="min-w-0 space-y-4">
          <ul className="space-y-2">
            <li className="flex min-w-0 flex-wrap items-center gap-2 text-sm"><span className="font-medium">{project.organization.profile?.displayName ?? project.organization.name}</span><span className="text-zinc-500">{project.organization.name} · owner</span></li>
            {project.members.map((member) => (
              <li key={member.orgId} className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
                <span className="font-medium">{member.organization.profile?.displayName ?? member.organization.name}</span><span className="text-zinc-500">{member.organization.name}</span>
                {isOwner && <form action={removeProjectMember.bind(null, project.id, member.orgId)}><button className="text-xs text-red-700 hover:underline">Remove</button></form>}
              </li>
            ))}
          </ul>
          {isOwner && (
            <div className="border-t border-zinc-200 pt-4">
              <h3 className="mb-2 text-sm font-semibold">Invite a connected organization</h3>
              {candidates.mutual.length ? candidates.mutual.map((candidate) => (
                <div key={candidate.id} className="flex min-w-0 items-center justify-between gap-3 py-2 text-sm">
                  <span className="min-w-0 truncate">{candidate.displayName} <span className="text-zinc-500">@{candidate.handle}</span></span>
                  <form action={inviteProjectMember.bind(null, project.id, candidate.id)}><Button variant="secondary" type="submit">Invite</Button></form>
                </div>
              )) : <p className="text-sm text-zinc-500">No connected organizations available.</p>}
              {[...candidates.followingOnly, ...candidates.followersOnly].map((candidate) => (
                <div key={candidate.id} className="flex min-w-0 justify-between gap-3 py-1 text-sm text-zinc-500">
                  <span className="truncate">{candidate.displayName} · @{candidate.handle}</span>
                  <span className="shrink-0">{candidates.followingOnly.some((row) => row.id === candidate.id) ? "They must follow you back" : "Follow them to connect"}</span>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {isOwner && (
        <Card><CardHeader title="Project details" /><CardBody>
          <form action={updateProjectDetails.bind(null, project.id)} className="grid min-w-0 gap-3 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
            <label className="min-w-0 text-sm font-medium">Title<input className="mt-1 block min-h-10 w-full rounded-md border border-zinc-300 px-3" name="title" maxLength={120} defaultValue={project.title} required /></label>
            <label className="min-w-0 text-sm font-medium">Description<input className="mt-1 block min-h-10 w-full rounded-md border border-zinc-300 px-3" name="description" maxLength={2000} defaultValue={project.description ?? ""} /></label>
            <Button type="submit" variant="secondary">Save</Button>
          </form>
        </CardBody></Card>
      )}

      <Card>
        <CardHeader title="Shared notes" />
        <CardBody>
          <form action={saveProjectNotes.bind(null, project.id)} className="space-y-3">
            <Textarea name="notes" rows={7} maxLength={50000} defaultValue={project.notes} className="w-full min-w-0" placeholder="Project notes everyone can edit…" />
            <Button type="submit" variant="secondary">Save notes</Button>
          </form>
          {project.notesUpdatedAt && <p className="mt-3 text-xs text-zinc-500">Last edited by {editorOrg?.name ?? "a project member"} · {formatInTimeZone(project.notesUpdatedAt, timezone, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</p>}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Checklist" />
        <CardBody className="min-w-0 space-y-4">
          <form action={addProjectTask.bind(null, project.id)} className="flex min-w-0 flex-col gap-2 sm:flex-row">
            <input className="min-h-10 min-w-0 flex-1 rounded-md border border-zinc-300 px-3" name="title" maxLength={200} placeholder="Add a task…" required />
            <Button type="submit">Add task</Button>
          </form>
          {project.tasks.length ? <ul className="divide-y divide-zinc-200">
            {project.tasks.map((task) => <li key={task.id} className="flex min-w-0 flex-col gap-2 py-3 sm:flex-row sm:items-center">
              <form action={taskAction(task.id, !task.done)}><button type="submit" aria-label={task.done ? "Reopen task" : "Complete task"} className={`h-5 w-5 rounded border ${task.done ? "border-emerald-600 bg-emerald-600" : "border-zinc-400"}`} /></form>
              <span className={`min-w-0 flex-1 break-words text-sm ${task.done ? "text-zinc-500 line-through" : "text-zinc-900"}`}>{task.title}</span>
              <form action={assignProjectTask.bind(null, project.id, task.id)} className="flex gap-2">
                <select className="min-h-9 max-w-44 min-w-0 rounded-md border border-zinc-300 px-2 text-xs" name="assigneeOrgId" defaultValue={task.assigneeOrgId ?? ""}>
                  <option value="">Unassigned</option><option value={project.orgId}>{project.organization.profile?.displayName ?? project.organization.name}</option>
                  {project.members.map((member) => <option key={member.orgId} value={member.orgId}>{member.organization.profile?.displayName ?? member.organization.name}</option>)}
                </select><button className="text-xs text-[var(--vx-accent-600)] hover:underline">Assign</button>
              </form>
              <form action={deleteProjectTask.bind(null, project.id, task.id)}><button className="text-xs text-red-700 hover:underline">Delete</button></form>
            </li>)}
          </ul> : <p className="text-sm text-zinc-500">No checklist items yet.</p>}
        </CardBody>
      </Card>

      <Card><CardHeader title={`Files (${project.files.length}/30)`} /><CardBody className="min-w-0 space-y-4">
        <ProjectFileUploader projectId={project.id} />
        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {project.files.map((file) => <div key={file.id} className="min-w-0 rounded-lg border border-zinc-200 p-3">
            {file.mimeType === "image/jpeg" && <a href={`/api/people/projects/files/${file.id}`} target="_blank" rel="noreferrer"><img className="mb-2 max-h-48 w-full rounded object-contain" src={`/api/people/projects/files/${file.id}`} alt={file.name} /></a>}
            <a className="break-all text-sm font-medium text-[var(--vx-accent-600)] hover:underline" href={`/api/people/projects/files/${file.id}`}>{file.name}</a>
            <p className="mt-1 text-xs text-zinc-500">{Math.ceil(file.sizeBytes / 1024)} KB · {formatInTimeZone(file.createdAt, timezone, { month: "short", day: "numeric" })}</p>
            {(file.orgId === orgId || isOwner) && <form action={deleteProjectFile.bind(null, project.id, file.id)}><button className="mt-2 text-xs text-red-700 hover:underline">Delete file</button></form>}
          </div>)}
        </div>
      </CardBody></Card>

      <Card><CardHeader title="Linked songs" /><CardBody className="min-w-0 space-y-3">
        <form action={linkProjectSong.bind(null, project.id)} className="flex min-w-0 gap-2">
          <select name="songId" className="min-h-10 min-w-0 flex-1 rounded-md border border-zinc-300 px-3" defaultValue=""><option value="" disabled>Choose a song you can access</option>{songs.map((song) => <option key={song.id} value={song.id}>{song.title}</option>)}</select><Button type="submit" variant="secondary">Link song</Button>
        </form>
        {project.songLinks.length ? <ul className="divide-y divide-zinc-200">
          {project.songLinks.map(({ song, addedByOrgId }) => {
            const canOpen = songIds.has(song.id);
            return <li key={song.id} className="flex min-w-0 flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <span className="min-w-0 break-words"><strong>{song.title}</strong> · {song.stage}</span>
              {canOpen ? <Link className="text-[var(--vx-accent-600)] hover:underline" href={`/songs/${song.id}`}>Open</Link> : <span className="text-xs text-zinc-500">Ask {project.organization.name} to share this song with you</span>}
              {(isOwner || addedByOrgId === orgId) && <form action={unlinkProjectSong.bind(null, project.id, song.id)}><button className="text-xs text-zinc-500 hover:underline">Unlink</button></form>}
            </li>;
          })}
        </ul> : <p className="text-sm text-zinc-500">No songs linked yet.</p>}
      </CardBody></Card>

      <Card><CardHeader title="Chat" /><CardBody className="min-w-0 space-y-4">
        <div id="chat" className="min-w-0 space-y-3">
          {posts.map((post) => <article key={post.id} className="min-w-0 rounded-lg bg-zinc-50 p-3">
            <div className="flex flex-wrap justify-between gap-2 text-xs text-zinc-500"><span className="font-medium text-zinc-700">{post.authorOrg.profile?.displayName ?? post.authorOrg.name}</span><time>{formatInTimeZone(post.createdAt, timezone, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</time></div>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm text-zinc-800">{post.body}</p>
            {(post.authorOrgId === orgId || isOwner) && <form action={deleteProjectPost.bind(null, project.id, post.id)}><button className="mt-2 text-xs text-red-700 hover:underline">Delete post</button></form>}
          </article>)}
          {!posts.length && <p className="text-sm text-zinc-500">No posts yet. Start the conversation.</p>}
        </div>
        <form action={sendProjectPost.bind(null, project.id)} className="space-y-2 border-t border-zinc-200 pt-4">
          <Textarea name="body" rows={3} maxLength={2000} defaultValue={query.body ?? ""} className="w-full min-w-0" placeholder="Write a project update…" required />
          <Button type="submit">Post</Button>
        </form>
        <ProjectRefresh count={posts.length} />
        <div id="project-chat-bottom" />
      </CardBody></Card>
    </div>
  );
}
