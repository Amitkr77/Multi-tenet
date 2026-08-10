-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "tenant_id" TEXT;

-- AlterTable
ALTER TABLE "verification_tokens" ADD COLUMN     "tenant_id" TEXT;
