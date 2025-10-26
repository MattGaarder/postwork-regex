/*
  Warnings:

  - You are about to drop the column `content` on the `Version` table. All the data in the column will be lost.
  - Added the required column `code` to the `Version` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Comment" ADD COLUMN     "content" TEXT;

-- AlterTable
ALTER TABLE "Version" DROP COLUMN "content",
ADD COLUMN     "code" TEXT NOT NULL;
