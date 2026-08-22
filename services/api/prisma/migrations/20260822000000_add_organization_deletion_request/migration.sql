ALTER TABLE "Organization"
ADD COLUMN "deletionRequestedAt" TIMESTAMP(3);

CREATE INDEX "Organization_deletionRequestedAt_idx"
ON "Organization"("deletionRequestedAt");
