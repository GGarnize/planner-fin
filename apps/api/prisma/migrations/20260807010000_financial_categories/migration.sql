CREATE TYPE "FinancialCategoryType" AS ENUM ('INCOME', 'EXPENSE');
CREATE TYPE "FinancialCategoryIcon" AS ENUM ('HOME', 'WORK', 'SHOPPING_CART', 'RESTAURANT', 'DIRECTIONS_CAR', 'HEALTH_AND_SAFETY', 'SCHOOL', 'SAVINGS');

CREATE TABLE "FinancialCategory" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "name" VARCHAR(80) NOT NULL,
  "normalizedName" VARCHAR(80) NOT NULL,
  "type" "FinancialCategoryType" NOT NULL,
  "color" VARCHAR(7),
  "icon" "FinancialCategoryIcon",
  "archivedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "FinancialCategory_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FinancialCategory_color_check" CHECK ("color" IS NULL OR "color" ~ '^#[0-9A-Fa-f]{6}$')
);
CREATE INDEX "FinancialCategory_userId_idx" ON "FinancialCategory"("userId");
CREATE UNIQUE INDEX "FinancialCategory_userId_type_normalizedName_key" ON "FinancialCategory"("userId", "type", "normalizedName");
ALTER TABLE "FinancialCategory" ADD CONSTRAINT "FinancialCategory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
