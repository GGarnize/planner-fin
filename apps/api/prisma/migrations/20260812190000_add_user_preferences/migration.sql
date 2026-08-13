CREATE TYPE "UserAppearance" AS ENUM ('SYSTEM', 'LIGHT', 'DARK');

CREATE TYPE "UserAccent" AS ENUM ('BLUE', 'TEAL', 'PURPLE', 'ORANGE');

CREATE TABLE "UserPreferences" (
  "userId" UUID NOT NULL,
  "appearance" "UserAppearance" NOT NULL DEFAULT 'SYSTEM',
  "accent" "UserAccent" NOT NULL DEFAULT 'BLUE',
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "UserPreferences_pkey" PRIMARY KEY ("userId")
);

ALTER TABLE "UserPreferences"
  ADD CONSTRAINT "UserPreferences_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "UserPreferences" ("userId", "appearance", "accent", "createdAt", "updatedAt")
SELECT "id", 'SYSTEM', 'BLUE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "User"
ON CONFLICT ("userId") DO NOTHING;
