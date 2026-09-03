import { PrismaClient } from "@prisma/client";

const username = process.argv[2]?.trim();
if (!username) {
  console.error("Usage: npm run admin:reset-2fa -- <username>");
  process.exit(1);
}

const db = new PrismaClient();
try {
  const user = await db.user.findUnique({
    where: { usernameLower: username.toLowerCase() },
    select: { id: true, role: true, username: true },
  });
  if (!user || user.role !== "SUPERADMIN") {
    throw new Error("SUPERADMIN user not found.");
  }
  await db.user.update({
    where: { id: user.id },
    data: {
      totpSecret: null,
      totpBackupCodes: [],
      lockedUntil: null,
      failedLogins: 0,
    },
  });
  console.log(`Reset 2FA for ${user.username}.`);
} finally {
  await db.$disconnect();
}
