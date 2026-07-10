-- AlterTable: track wrong-guess attempts on a reset code so we can invalidate
-- it after too many tries (brute-force protection for the 6-digit OTP).
ALTER TABLE "PasswordResetToken" ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0;
