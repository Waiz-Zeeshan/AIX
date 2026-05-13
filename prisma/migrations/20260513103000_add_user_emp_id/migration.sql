-- AlterTable
ALTER TABLE "User" ADD COLUMN "empId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_empId_key" ON "User"("empId");
