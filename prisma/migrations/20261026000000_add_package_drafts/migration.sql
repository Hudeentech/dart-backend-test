CREATE TABLE "PackageDraft" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PackageDraft_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PackageDraft_userId_updatedAt_idx" ON "PackageDraft"("userId", "updatedAt");

ALTER TABLE "PackageDraft"
ADD CONSTRAINT "PackageDraft_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
