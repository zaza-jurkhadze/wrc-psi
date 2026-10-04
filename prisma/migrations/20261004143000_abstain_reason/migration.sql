-- CreateEnum
CREATE TYPE "AbstainReason" AS ENUM ('SELF', 'CANNOT_SPEAK', 'OTHER');

-- AlterTable
ALTER TABLE "Survey" ADD COLUMN "abstainReason" "AbstainReason";

-- Existing abstained surveys default to SELF
UPDATE "Survey" SET "abstainReason" = 'SELF' WHERE "assessment" = 'ABSTAINED';
