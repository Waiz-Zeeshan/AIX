-- AlterTable
ALTER TABLE "EventConfig" ADD COLUMN     "podHeadSyncSheetId" TEXT;

-- AlterTable
ALTER TABLE "PodHeadProfile" ADD COLUMN     "department" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "phone" TEXT;
