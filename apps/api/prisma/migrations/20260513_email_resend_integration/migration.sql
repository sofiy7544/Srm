-- AlterTable
ALTER TABLE "users"
  ADD COLUMN "email_verified_at" TIMESTAMP(3),
  ADD COLUMN "last_login_at"     TIMESTAMP(3),
  ADD COLUMN "last_login_ip"     TEXT;

-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED');
CREATE TYPE "EmailStatus"      AS ENUM ('QUEUED', 'SENT', 'FAILED');

-- CreateTable: email_verification_tokens
CREATE TABLE "email_verification_tokens" (
    "id"         UUID         NOT NULL,
    "user_id"    UUID         NOT NULL,
    "token_hash" TEXT         NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at"    TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "email_verification_tokens_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "email_verification_tokens_token_hash_key" ON "email_verification_tokens"("token_hash");
CREATE INDEX "email_verification_tokens_user_id_idx" ON "email_verification_tokens"("user_id");
ALTER TABLE "email_verification_tokens"
  ADD CONSTRAINT "email_verification_tokens_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: password_reset_tokens
CREATE TABLE "password_reset_tokens" (
    "id"         UUID         NOT NULL,
    "user_id"    UUID         NOT NULL,
    "token_hash" TEXT         NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at"    TIMESTAMP(3),
    "request_ip" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "password_reset_tokens_token_hash_key" ON "password_reset_tokens"("token_hash");
CREATE INDEX "password_reset_tokens_user_id_idx" ON "password_reset_tokens"("user_id");
ALTER TABLE "password_reset_tokens"
  ADD CONSTRAINT "password_reset_tokens_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: team_invitations
CREATE TABLE "team_invitations" (
    "id"             UUID             NOT NULL,
    "email"          TEXT             NOT NULL,
    "role"           "UserRole"       NOT NULL DEFAULT 'REALTOR',
    "token_hash"     TEXT             NOT NULL,
    "invited_by_id"  UUID             NOT NULL,
    "status"         "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "expires_at"     TIMESTAMP(3)     NOT NULL,
    "accepted_at"    TIMESTAMP(3),
    "created_at"     TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "team_invitations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "team_invitations_token_hash_key" ON "team_invitations"("token_hash");
CREATE INDEX "team_invitations_email_idx"  ON "team_invitations"("email");
CREATE INDEX "team_invitations_status_idx" ON "team_invitations"("status");
ALTER TABLE "team_invitations"
  ADD CONSTRAINT "team_invitations_invited_by_id_fkey"
  FOREIGN KEY ("invited_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: email_logs
CREATE TABLE "email_logs" (
    "id"            UUID         NOT NULL,
    "to_address"    TEXT         NOT NULL,
    "from_address"  TEXT         NOT NULL,
    "subject"       TEXT         NOT NULL,
    "template"      TEXT         NOT NULL,
    "provider_id"   TEXT,
    "status"        "EmailStatus" NOT NULL DEFAULT 'QUEUED',
    "error_message" TEXT,
    "attempts"      INTEGER      NOT NULL DEFAULT 0,
    "metadata"      JSONB,
    "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at"       TIMESTAMP(3),
    CONSTRAINT "email_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "email_logs_to_address_idx" ON "email_logs"("to_address");
CREATE INDEX "email_logs_template_idx"   ON "email_logs"("template");
CREATE INDEX "email_logs_status_idx"     ON "email_logs"("status");
