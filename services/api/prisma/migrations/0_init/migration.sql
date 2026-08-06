-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "industry" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "stripeCustomerId" TEXT,
    "subscriptionStatus" TEXT NOT NULL DEFAULT 'free',

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "organizationId" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "emailVerifyTokenHash" TEXT,
    "emailVerifyExpires" TIMESTAMP(3),
    "passwordResetTokenHash" TEXT,
    "passwordResetExpires" TIMESTAMP(3),
    "requiresPasswordChange" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Scan" (
    "id" TEXT NOT NULL,
    "scanType" TEXT NOT NULL,
    "targetIdentifier" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "score" INTEGER,
    "riskLevel" TEXT,
    "findingsJson" JSONB,
    "organizationId" TEXT,
    "claimTokenHash" TEXT,
    "claimTokenExpires" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "Scan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DsrRequest" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "subjectEmail" TEXT NOT NULL,
    "subjectName" TEXT,
    "requestType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reasonText" TEXT,
    "internalNotes" TEXT,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "DsrRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SuppressionList" (
    "email" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SuppressionList_pkey" PRIMARY KEY ("email")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "DsrRequest_organizationId_status_idx" ON "DsrRequest"("organizationId", "status");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scan" ADD CONSTRAINT "Scan_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DsrRequest" ADD CONSTRAINT "DsrRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

