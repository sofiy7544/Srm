-- Extend UserRole enum with MANAGER and EMPLOYEE
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'MANAGER';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'EMPLOYEE';

-- Add manager hierarchy column on users
ALTER TABLE "users" ADD COLUMN "manager_id" UUID;
CREATE INDEX "users_manager_id_idx" ON "users"("manager_id");
ALTER TABLE "users"
  ADD CONSTRAINT "users_manager_id_fkey"
  FOREIGN KEY ("manager_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
