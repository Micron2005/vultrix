"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { db, dbBase } from "@/lib/db";
import { notify } from "@/lib/notifications";
import { requirePeopleManager } from "@/lib/peopleAccess";
import {
  canAssign,
  normalizeProjectPost,
  normalizeProjectTitle,
  normalizeTaskTitle,
  PROJECT_FILE_MAX_BYTES,
  PROJECT_ORG_MAX,
  validateProjectFile,
} from "@/lib/projects";
import { projectAccessWhere } from "@/lib/projectAccess";
import { relationship } from "@/lib/people";
import { songAccessWhere } from "@/lib/songAccess";

type ProjectDb = Pick<Prisma.TransactionClient, "project" | "follow">;

const projectHref = (projectId: string) => `/people/projects/${projectId}`;

function isUniqueConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

function projectError(projectId: string, error: string, body?: string): never {
  const query = new URLSearchParams({ error });
  if (body) query.set("body", body.slice(0, 2000));
  redirect(`${projectHref(projectId)}?${query.toString()}#chat`);
}

async function accessibleProject(
  client: ProjectDb,
  projectId: string,
  orgId: string,
) {
  return client.project.findFirst({
    where: { id: projectId, ...projectAccessWhere(orgId) },
    select: {
      id: true,
      orgId: true,
      title: true,
      members: { select: { orgId: true } },
    },
  });
}

async function ownerProject(
  client: ProjectDb,
  projectId: string,
  orgId: string,
) {
  return client.project.findFirst({
    where: { id: projectId, orgId, ...projectAccessWhere(orgId) },
    select: {
      id: true,
      orgId: true,
      title: true,
      members: { select: { orgId: true } },
      organization: {
        select: { name: true, profile: { select: { id: true } } },
      },
    },
  });
}

async function touchProject(
  client: ProjectDb,
  projectId: string,
  orgId: string,
) {
  await client.project.updateMany({
    where: { id: projectId, ...projectAccessWhere(orgId) },
    data: { updatedAt: new Date() },
  });
}

async function connectedInTransaction(
  client: ProjectDb,
  firstProfileId: string,
  secondProfileId: string,
) {
  const [firstFollows, secondFollows] = await Promise.all([
    client.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId: firstProfileId,
          followingId: secondProfileId,
        },
      },
      select: { id: true },
    }),
    client.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId: secondProfileId,
          followingId: firstProfileId,
        },
      },
      select: { id: true },
    }),
  ]);
  return Boolean(firstFollows && secondFollows);
}

export async function createProject(formData: FormData) {
  const orgId = await requirePeopleManager();
  const profile = await db.profile.findUnique({
    where: { orgId },
    select: { id: true },
  });
  if (!profile) redirect("/people?need_profile=1");

  const rawTitle = formData.get("title");
  const title = normalizeProjectTitle(
    typeof rawTitle === "string" ? rawTitle : "",
  );
  const rawDescription = formData.get("description");
  const description =
    typeof rawDescription === "string"
      ? rawDescription.trim().slice(0, 2000) || null
      : null;
  if (!title) redirect("/people/projects?error=title");

  const project = await db.project.create({
    data: { orgId, title, description },
    select: { id: true },
  });
  revalidatePath("/people/projects");
  redirect(projectHref(project.id));
}

export async function startProjectWithProfile(profileId: string) {
  const orgId = await requirePeopleManager();
  const viewer = await db.profile.findUnique({
    where: { orgId },
    select: { id: true, displayName: true },
  });
  if (!viewer) redirect("/people?need_profile=1");
  const target = await db.profile.findUnique({
    where: { id: profileId },
    select: { id: true, orgId: true, displayName: true, handle: true },
  });
  if (!target || target.orgId === orgId) redirect("/people");

  const connection = await relationship(viewer.id, target.id);
  if (!connection.connected) redirect(`/people/${target.handle}`);

  const title =
    normalizeProjectTitle(`Project with ${target.displayName}`) ??
    "Project together";
  const project = await dbBase.$transaction(async (tx) => {
    const stillConnected = await connectedInTransaction(
      tx,
      viewer.id,
      target.id,
    );
    if (!stillConnected) return null;
    const created = await tx.project.create({
      data: { orgId, title },
      select: { id: true, title: true },
    });
    await tx.projectMember.create({
      data: { projectId: created.id, orgId: target.orgId },
    });
    return created;
  });
  if (!project) redirect(`/people/${target.handle}`);

  await notify({
    orgId: target.orgId,
    kind: "project_invite",
    title: `Invitation to project “${project.title}”`,
    body: `${viewer.displayName} invited you to collaborate.`,
    href: projectHref(project.id),
    dedupeKey: project.id,
  });
  revalidatePath("/people/projects");
  revalidatePath("/people");
  redirect(projectHref(project.id));
}

export async function updateProjectDetails(
  projectId: string,
  formData: FormData,
) {
  const orgId = await requirePeopleManager();
  const titleValue = formData.get("title");
  const title = normalizeProjectTitle(
    typeof titleValue === "string" ? titleValue : "",
  );
  const descriptionValue = formData.get("description");
  const description =
    typeof descriptionValue === "string"
      ? descriptionValue.trim().slice(0, 2000) || null
      : null;
  if (!title) projectError(projectId, "title");

  await db.project.updateMany({
    where: { id: projectId, orgId, ...projectAccessWhere(orgId) },
    data: { title, description },
  });
  revalidatePath("/people/projects");
  revalidatePath(projectHref(projectId));
}

export async function setProjectStatus(
  projectId: string,
  status: "active" | "done",
) {
  const orgId = await requirePeopleManager();
  if (status !== "active" && status !== "done") return;
  await db.project.updateMany({
    where: { id: projectId, orgId, ...projectAccessWhere(orgId) },
    data: { status },
  });
  revalidatePath("/people/projects");
  revalidatePath(projectHref(projectId));
}

export async function deleteProject(projectId: string) {
  const orgId = await requirePeopleManager();
  await db.project.deleteMany({
    where: { id: projectId, orgId, ...projectAccessWhere(orgId) },
  });
  revalidatePath("/people/projects");
  redirect("/people/projects");
}

export async function inviteProjectMember(
  projectId: string,
  targetProfileId: string,
) {
  const orgId = await requirePeopleManager();
  const target = await db.profile.findUnique({
    where: { id: targetProfileId },
    select: { id: true, orgId: true },
  });
  if (!target || target.orgId === orgId) projectError(projectId, "invite");

  let invited: { title: string; ownerName: string } | null = null;
  try {
    invited = await dbBase.$transaction(async (tx) => {
      await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "Project" WHERE "id" = ${projectId} FOR UPDATE
      `;
      const project = await ownerProject(tx, projectId, orgId);
      if (!project) return null;
      const ownerProfileId = project.organization.profile?.id;
      if (!ownerProfileId) return null;
      if (!(await connectedInTransaction(tx, ownerProfileId, target.id))) {
        return null;
      }
      const existing = await tx.projectMember.findUnique({
        where: {
          projectId_orgId: { projectId, orgId: target.orgId },
        },
        select: { id: true },
      });
      if (existing) return null;
      const memberCount = await tx.projectMember.count({
        where: { projectId, project: { is: projectAccessWhere(orgId) } },
      });
      if (memberCount + 1 >= PROJECT_ORG_MAX) return null;
      await tx.projectMember.create({
        data: { projectId, orgId: target.orgId },
      });
      await touchProject(tx, projectId, orgId);
      return {
        title: project.title,
        ownerName: project.organization.name,
      };
    });
  } catch (error) {
    if (isUniqueConflict(error)) return;
    throw error;
  }
  if (!invited) projectError(projectId, "invite");

  await notify({
    orgId: target.orgId,
    kind: "project_invite",
    title: `Invitation to project “${invited.title}”`,
    body: `${invited.ownerName} invited you to collaborate.`,
    href: projectHref(projectId),
    dedupeKey: projectId,
  });
  revalidatePath("/people/projects");
  revalidatePath(projectHref(projectId));
}

export async function removeProjectMember(
  projectId: string,
  memberOrgId: string,
) {
  const orgId = await requirePeopleManager();
  if (memberOrgId === orgId) return;
  await dbBase.$transaction(async (tx) => {
    const project = await ownerProject(tx, projectId, orgId);
    if (!project) return;
    await tx.projectTask.updateMany({
      where: {
        projectId,
        assigneeOrgId: memberOrgId,
        project: { is: projectAccessWhere(orgId) },
      },
      data: { assigneeOrgId: null },
    });
    await tx.projectMember.deleteMany({
      where: {
        projectId,
        orgId: memberOrgId,
        project: { is: projectAccessWhere(orgId) },
      },
    });
    await touchProject(tx, projectId, orgId);
  });
  revalidatePath(projectHref(projectId));
  revalidatePath("/people/projects");
}

export async function leaveProject(projectId: string) {
  const orgId = await requirePeopleManager();
  await dbBase.$transaction(async (tx) => {
    const project = await accessibleProject(tx, projectId, orgId);
    if (!project || project.orgId === orgId) return;
    await tx.projectTask.updateMany({
      where: {
        projectId,
        assigneeOrgId: orgId,
        project: { is: projectAccessWhere(orgId) },
      },
      data: { assigneeOrgId: null },
    });
    await tx.projectMember.deleteMany({
      where: {
        projectId,
        orgId,
        project: { is: projectAccessWhere(orgId) },
      },
    });
  });
  revalidatePath("/people/projects");
  redirect("/people/projects");
}

export async function saveProjectNotes(
  projectId: string,
  formData: FormData,
) {
  const orgId = await requirePeopleManager();
  const value = formData.get("notes");
  const notes = typeof value === "string" ? value.slice(0, 50_000) : "";
  await db.project.updateMany({
    where: { id: projectId, ...projectAccessWhere(orgId) },
    data: {
      notes,
      notesUpdatedAt: new Date(),
      notesUpdatedByOrgId: orgId,
      updatedAt: new Date(),
    },
  });
  revalidatePath(projectHref(projectId));
  revalidatePath("/people/projects");
}

export async function addProjectTask(
  projectId: string,
  formData: FormData,
) {
  const orgId = await requirePeopleManager();
  const value = formData.get("title");
  const title = normalizeTaskTitle(typeof value === "string" ? value : "");
  if (!title) projectError(projectId, "task");

  await dbBase.$transaction(async (tx) => {
    const project = await accessibleProject(tx, projectId, orgId);
    if (!project) return;
    const lastTask = await tx.projectTask.findFirst({
      where: { projectId, project: { is: projectAccessWhere(orgId) } },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });
    await tx.projectTask.create({
      data: {
        projectId,
        title,
        done: false,
        createdByOrgId: orgId,
        sortOrder: (lastTask?.sortOrder ?? -1) + 1,
      },
    });
    await touchProject(tx, projectId, orgId);
  });
  revalidatePath(projectHref(projectId));
  revalidatePath("/people/projects");
}

export async function setProjectTaskDone(
  projectId: string,
  taskId: string,
  done: boolean,
) {
  const orgId = await requirePeopleManager();
  await db.projectTask.updateMany({
    where: {
      id: taskId,
      projectId,
      project: { is: projectAccessWhere(orgId) },
    },
    data: { done, doneAt: done ? new Date() : null },
  });
  await touchProject(dbBase, projectId, orgId);
  revalidatePath(projectHref(projectId));
  revalidatePath("/people/projects");
}

export async function assignProjectTask(
  projectId: string,
  taskId: string,
  formData: FormData,
) {
  const orgId = await requirePeopleManager();
  const value = formData.get("assigneeOrgId");
  const assigneeOrgId =
    typeof value === "string" && value ? value : null;
  const project = await accessibleProject(dbBase, projectId, orgId);
  if (!project) return;
  const allowed = !assigneeOrgId ||
    canAssign(assigneeOrgId, {
      orgId: project.orgId,
      memberOrgIds: project.members.map((member) => member.orgId),
    });
  if (!allowed) return;

  const task = await db.projectTask.findFirst({
    where: {
      id: taskId,
      projectId,
      project: { is: projectAccessWhere(orgId) },
    },
    select: { title: true, assigneeOrgId: true },
  });
  if (!task) return;
  await db.projectTask.updateMany({
    where: {
      id: taskId,
      projectId,
      project: { is: projectAccessWhere(orgId) },
    },
    data: { assigneeOrgId },
  });
  await touchProject(dbBase, projectId, orgId);
  if (assigneeOrgId && assigneeOrgId !== orgId) {
    await notify({
      orgId: assigneeOrgId,
      kind: "project_task_assigned",
      title: `Task assigned: ${task.title}`,
      body: `A task was assigned to your organization in “${project.title}”.`,
      href: projectHref(projectId),
      dedupeKey: `${projectId}:${taskId}`,
    });
  }
  revalidatePath(projectHref(projectId));
  revalidatePath("/people/projects");
}

export async function deleteProjectTask(projectId: string, taskId: string) {
  const orgId = await requirePeopleManager();
  await db.projectTask.deleteMany({
    where: {
      id: taskId,
      projectId,
      project: { is: projectAccessWhere(orgId) },
    },
  });
  await touchProject(dbBase, projectId, orgId);
  revalidatePath(projectHref(projectId));
  revalidatePath("/people/projects");
}

function decodeProjectDataUrl(dataUrl: string, mimeType: string) {
  const prefix = `data:${mimeType};base64,`;
  if (!dataUrl.startsWith(prefix)) return null;
  const base64 = dataUrl.slice(prefix.length);
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) return null;
  const bytes = Buffer.from(base64, "base64");
  if (bytes.toString("base64") !== base64) return null;
  if (
    mimeType === "image/jpeg" &&
    !(bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
  ) {
    return null;
  }
  if (
    mimeType === "application/pdf" &&
    bytes.subarray(0, 5).toString("ascii") !== "%PDF-"
  ) {
    return null;
  }
  return bytes;
}

function safeFileName(raw: string) {
  return (
    raw
      .replace(/\\/g, "/")
      .split("/")
      .pop()
      ?.replace(/[\u0000-\u001f\u007f]/g, "")
      .trim()
      .slice(0, 200) || "project-file"
  );
}

export async function uploadProjectFile(
  projectId: string,
  formData: FormData,
) {
  const orgId = await requirePeopleManager();
  const dataValue = formData.get("dataUrl");
  const mimeValue = formData.get("mimeType");
  const nameValue = formData.get("name");
  if (
    typeof dataValue !== "string" ||
    typeof mimeValue !== "string" ||
    typeof nameValue !== "string"
  ) {
    projectError(projectId, "file");
  }
  const mimeType = mimeValue;
  const bytes = decodeProjectDataUrl(dataValue, mimeType);
  if (!bytes) projectError(projectId, "file");
  const validation = validateProjectFile({
    mimeType,
    sizeBytes: bytes.length,
  });
  if (validation !== "ok") {
    projectError(projectId, validation === "size" ? "file_size" : "file_type");
  }
  if (bytes.length > PROJECT_FILE_MAX_BYTES) projectError(projectId, "file_size");
  const project = await accessibleProject(dbBase, projectId, orgId);
  if (!project) return;
  const fileName = safeFileName(nameValue);
  const created = await dbBase.$transaction(async (tx) => {
    const current = await accessibleProject(tx, projectId, orgId);
    if (!current) return false;
    const count = await tx.projectFile.count({
      where: { projectId, project: { is: projectAccessWhere(orgId) } },
    });
    if (count >= 30) return false;
    await tx.projectFile.create({
      data: {
        projectId,
        orgId,
        name: fileName,
        mimeType,
        sizeBytes: bytes.length,
        dataUrl: `data:${mimeType};base64,${bytes.toString("base64")}`,
      },
    });
    await touchProject(tx, projectId, orgId);
    return true;
  });
  if (!created) projectError(projectId, "file_limit");
  revalidatePath(projectHref(projectId));
  revalidatePath("/people/projects");
}

export async function deleteProjectFile(projectId: string, fileId: string) {
  const orgId = await requirePeopleManager();
  await dbBase.$transaction(async (tx) => {
    const file = await tx.projectFile.findFirst({
      where: {
        id: fileId,
        projectId,
        project: { is: projectAccessWhere(orgId) },
      },
      select: { orgId: true, project: { select: { orgId: true } } },
    });
    if (!file || (file.orgId !== orgId && file.project.orgId !== orgId)) return;
    await tx.projectFile.deleteMany({
      where: {
        id: fileId,
        projectId,
        project: { is: projectAccessWhere(orgId) },
        OR: [{ orgId }, { project: { is: { orgId } } }],
      },
    });
    await touchProject(tx, projectId, orgId);
  });
  revalidatePath(projectHref(projectId));
  revalidatePath("/people/projects");
}

export async function sendProjectPost(
  projectId: string,
  formData: FormData,
) {
  const orgId = await requirePeopleManager();
  const value = formData.get("body");
  const raw = typeof value === "string" ? value : "";
  const body = normalizeProjectPost(raw);
  if (!body) projectError(projectId, raw.trim() ? "post_long" : "post_empty", raw);
  const now = new Date();
  const result = await dbBase.$transaction(async (tx) => {
    await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "Organization" WHERE "id" = ${orgId} FOR UPDATE
    `;
    const project = await accessibleProject(tx, projectId, orgId);
    if (!project) return null;
    const recentCount = await tx.projectPost.count({
      where: {
        authorOrgId: orgId,
        createdAt: { gte: new Date(now.getTime() - 60_000) },
      },
    });
    if (recentCount >= 20) return { error: "slow_down" as const };
    await tx.projectPost.create({
      data: { projectId, authorOrgId: orgId, body, createdAt: now },
    });
    await touchProject(tx, projectId, orgId);
    return {
      project,
      recipientOrgIds: [
        ...new Set([
          project.orgId,
          ...project.members.map((member) => member.orgId),
        ]),
      ].filter((recipientOrgId) => recipientOrgId !== orgId),
    };
  });
  if (!result) projectError(projectId, "not_found");
  if ("error" in result && result.error) {
    projectError(projectId, result.error, body);
  }

  const preview = body.replace(/\s+/g, " ").slice(0, 140);
  await Promise.all(
    result.recipientOrgIds.map((recipientOrgId) =>
      notify({
        orgId: recipientOrgId,
        kind: "project_post",
        title: `New post in “${result.project.title}”`,
        body: preview,
        href: projectHref(projectId),
        dedupeKey: projectId,
      }),
    ),
  );
  revalidatePath(projectHref(projectId));
  revalidatePath("/people/projects");
}

export async function deleteProjectPost(projectId: string, postId: string) {
  const orgId = await requirePeopleManager();
  await dbBase.$transaction(async (tx) => {
    const post = await tx.projectPost.findFirst({
      where: {
        id: postId,
        projectId,
        project: { is: projectAccessWhere(orgId) },
      },
      select: {
        authorOrgId: true,
        project: { select: { orgId: true } },
      },
    });
    if (!post || (post.authorOrgId !== orgId && post.project.orgId !== orgId)) {
      return;
    }
    await tx.projectPost.deleteMany({
      where: {
        id: postId,
        projectId,
        project: { is: projectAccessWhere(orgId) },
        OR: [{ authorOrgId: orgId }, { project: { is: { orgId } } }],
      },
    });
    await touchProject(tx, projectId, orgId);
  });
  revalidatePath(projectHref(projectId));
  revalidatePath("/people/projects");
}

export async function linkProjectSong(
  projectId: string,
  formData: FormData,
) {
  const orgId = await requirePeopleManager();
  const songIdValue = formData.get("songId");
  if (typeof songIdValue !== "string" || !songIdValue) return;
  const [project, song] = await Promise.all([
    accessibleProject(dbBase, projectId, orgId),
    db.song.findFirst({
      where: { id: songIdValue, ...songAccessWhere(orgId) },
      select: { id: true },
    }),
  ]);
  if (!project || !song) return;
  try {
    await dbBase.$transaction(async (tx) => {
      const currentProject = await accessibleProject(tx, projectId, orgId);
      const currentSong = await tx.song.findFirst({
        where: { id: songIdValue, ...songAccessWhere(orgId) },
        select: { id: true },
      });
      if (!currentProject || !currentSong) return;
      await tx.projectSongLink.create({
        data: { projectId, songId: songIdValue, addedByOrgId: orgId },
      });
      await touchProject(tx, projectId, orgId);
    });
  } catch (error) {
    if (!isUniqueConflict(error)) throw error;
  }
  revalidatePath(projectHref(projectId));
  revalidatePath("/people/projects");
}

export async function unlinkProjectSong(projectId: string, songId: string) {
  const orgId = await requirePeopleManager();
  await dbBase.$transaction(async (tx) => {
    const link = await tx.projectSongLink.findFirst({
      where: {
        projectId,
        songId,
        project: { is: projectAccessWhere(orgId) },
      },
      select: {
        addedByOrgId: true,
        project: { select: { orgId: true } },
      },
    });
    if (!link || (link.addedByOrgId !== orgId && link.project.orgId !== orgId)) {
      return;
    }
    await tx.projectSongLink.deleteMany({ where: { projectId, songId } });
    await touchProject(tx, projectId, orgId);
  });
  revalidatePath(projectHref(projectId));
}
