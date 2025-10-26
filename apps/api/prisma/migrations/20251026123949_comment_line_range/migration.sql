/*
  Warnings:

  - Made the column `content` on table `Comment` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Comment" ADD COLUMN     "lineEnd" INTEGER,
ADD COLUMN     "lineStart" INTEGER,
ALTER COLUMN "content" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Comment_lineStart_idx" ON "Comment"("lineStart");

-- CreateIndex
CREATE INDEX "Comment_lineEnd_idx" ON "Comment"("lineEnd");

-- CreateIndex
CREATE INDEX "Comment_versionId_lineStart_lineEnd_idx" ON "Comment"("versionId", "lineStart", "lineEnd");
