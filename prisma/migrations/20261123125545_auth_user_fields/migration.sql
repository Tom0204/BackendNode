-- AUTH-01 : mot de passe (hash Argon2id, AUTH-03) et rôle des comptes.
-- password_hash est obligatoire et sans valeur par défaut : migration appliquée sur des tables users vides
-- (vérifié sur mmorpg_dev et mmorpg_test avant application). Le statut de compte relève d'AUTH-06.

/*
  Warnings:

  - Added the required column `password_hash` to the `users` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('PLAYER');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "password_hash" TEXT NOT NULL,
ADD COLUMN     "role" "user_role" NOT NULL DEFAULT 'PLAYER';
