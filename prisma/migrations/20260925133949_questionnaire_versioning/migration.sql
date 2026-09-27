-- AlterTable
ALTER TABLE "Questionnaire" ADD COLUMN     "parentId" TEXT,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- CreateIndex
CREATE INDEX "Questionnaire_parentId_idx" ON "Questionnaire"("parentId");

-- CreateIndex
CREATE INDEX "Questionnaire_version_idx" ON "Questionnaire"("version");

-- AddForeignKey
ALTER TABLE "Questionnaire" ADD CONSTRAINT "Questionnaire_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Questionnaire"("id") ON DELETE SET NULL ON UPDATE CASCADE;
