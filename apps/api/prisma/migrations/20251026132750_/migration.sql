/*
  Warnings:

  - You are about to drop the column `line` on the `Comment` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "public"."Comment_line_idx";

-- AlterTable
ALTER TABLE "Comment" DROP COLUMN "line";
