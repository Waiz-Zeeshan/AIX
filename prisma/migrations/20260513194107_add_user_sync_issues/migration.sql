-- AlterTable
ALTER TABLE "User" ADD COLUMN     "syncIssues" TEXT[] DEFAULT ARRAY[]::TEXT[];
