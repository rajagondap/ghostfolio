-- CreateEnum
CREATE TYPE "RebalancingMode" AS ENUM ('FULL', 'THRESHOLD');

-- CreateTable
CREATE TABLE "RebalancingModel" (
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "feeConfig" JSONB NOT NULL DEFAULT '{}',
    "id" TEXT NOT NULL,
    "mode" "RebalancingMode" NOT NULL DEFAULT 'FULL',
    "name" TEXT NOT NULL,
    "targetAllocations" JSONB NOT NULL,
    "thresholdPercent" DOUBLE PRECISION,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "RebalancingModel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RebalancingModel_userId_idx" ON "RebalancingModel"("userId");

-- AddForeignKey
ALTER TABLE "RebalancingModel" ADD CONSTRAINT "RebalancingModel_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

