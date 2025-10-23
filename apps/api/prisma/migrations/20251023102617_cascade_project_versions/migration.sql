-- DropForeignKey
ALTER TABLE "public"."Version" DROP CONSTRAINT "Version_projectId_fkey";

-- AddForeignKey
ALTER TABLE "Version" ADD CONSTRAINT "Version_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
