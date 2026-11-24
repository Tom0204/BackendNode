-- AUTH-05 à AUTH-10 : statut des comptes, rôle ADMIN et sessions de connexion.
-- Migration sans destruction : status a une valeur par défaut, ADMIN est ajouté à l'énumération,
-- sessions est une nouvelle table supprimée en cascade avec son compte.
-- Vérifié avant application : aucun utilisateur dans mmorpg_dev ni dans mmorpg_test.

-- CreateEnum
CREATE TYPE "user_status" AS ENUM ('ACTIVE', 'DISABLED');

-- AlterEnum
ALTER TYPE "user_role" ADD VALUE 'ADMIN';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "status" "user_status" NOT NULL DEFAULT 'ACTIVE';

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions"("token_hash");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Contrainte ajoutée à la main (non exprimable dans le schéma Prisma, voir data-model.md) :
-- token_hash est une empreinte SHA-256 en hexadécimal minuscule ; un jeton en clair est refusé.
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_token_hash_check" CHECK ("token_hash" ~ '^[0-9a-f]{64}$');
