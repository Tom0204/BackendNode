-- CreateEnum
CREATE TYPE "item_type" AS ENUM ('MATERIAL');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "characters" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "user_id" UUID NOT NULL,
    "class_id" UUID NOT NULL,
    "current_zone_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "normalized_name" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "experience" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "characters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "character_classes" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "base_hp" INTEGER NOT NULL,
    "base_mana" INTEGER NOT NULL,
    "base_attack" INTEGER NOT NULL,
    "base_defense" INTEGER NOT NULL,
    "base_speed" INTEGER NOT NULL,
    "hp_per_level" INTEGER NOT NULL,
    "mana_per_level" INTEGER NOT NULL,
    "attack_per_level" INTEGER NOT NULL,
    "defense_per_level" INTEGER NOT NULL,
    "speed_per_level" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "character_classes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zones" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "min_level" INTEGER NOT NULL,
    "max_level" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "zones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monsters" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "hp" INTEGER NOT NULL,
    "attack" INTEGER NOT NULL,
    "defense" INTEGER NOT NULL,
    "speed" INTEGER NOT NULL,
    "xp_reward" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "monsters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zone_monsters" (
    "zone_id" UUID NOT NULL,
    "monster_id" UUID NOT NULL,

    CONSTRAINT "zone_monsters_pkey" PRIMARY KEY ("zone_id","monster_id")
);

-- CreateTable
CREATE TABLE "items" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "item_type" NOT NULL,
    "stackable" BOOLEAN NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loot_entries" (
    "monster_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "drop_chance_bp" INTEGER NOT NULL,

    CONSTRAINT "loot_entries_pkey" PRIMARY KEY ("monster_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "characters_normalized_name_key" ON "characters"("normalized_name");

-- CreateIndex
CREATE INDEX "characters_user_id_idx" ON "characters"("user_id");

-- CreateIndex
CREATE INDEX "characters_class_id_idx" ON "characters"("class_id");

-- CreateIndex
CREATE INDEX "characters_current_zone_id_idx" ON "characters"("current_zone_id");

-- CreateIndex
CREATE UNIQUE INDEX "character_classes_code_key" ON "character_classes"("code");

-- CreateIndex
CREATE UNIQUE INDEX "zones_code_key" ON "zones"("code");

-- CreateIndex
CREATE UNIQUE INDEX "monsters_code_key" ON "monsters"("code");

-- CreateIndex
CREATE INDEX "zone_monsters_monster_id_idx" ON "zone_monsters"("monster_id");

-- CreateIndex
CREATE UNIQUE INDEX "items_code_key" ON "items"("code");

-- CreateIndex
CREATE INDEX "loot_entries_item_id_idx" ON "loot_entries"("item_id");

-- AddForeignKey
ALTER TABLE "characters" ADD CONSTRAINT "characters_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "characters" ADD CONSTRAINT "characters_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "character_classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "characters" ADD CONSTRAINT "characters_current_zone_id_fkey" FOREIGN KEY ("current_zone_id") REFERENCES "zones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zone_monsters" ADD CONSTRAINT "zone_monsters_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "zones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zone_monsters" ADD CONSTRAINT "zone_monsters_monster_id_fkey" FOREIGN KEY ("monster_id") REFERENCES "monsters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loot_entries" ADD CONSTRAINT "loot_entries_monster_id_fkey" FOREIGN KEY ("monster_id") REFERENCES "monsters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loot_entries" ADD CONSTRAINT "loot_entries_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Contraintes CHECK (ajoutées à la main : Prisma ne sait pas les décrire dans le schéma).
-- Elles sont listées et justifiées dans docs/architecture/data-model.md.
-- ---------------------------------------------------------------------------

-- users : email stocké en minuscules, donc unique sans tenir compte de la casse.
ALTER TABLE "users" ADD CONSTRAINT "users_email_lowercase_check" CHECK ("email" = lower("email"));

-- characters (rules.md §3 et §4)
ALTER TABLE "characters" ADD CONSTRAINT "characters_name_format_check" CHECK ("name" ~ '^[A-Za-z]{3,16}$');
ALTER TABLE "characters" ADD CONSTRAINT "characters_normalized_name_check" CHECK ("normalized_name" = lower("name"));
ALTER TABLE "characters" ADD CONSTRAINT "characters_level_check" CHECK ("level" BETWEEN 1 AND 10);
ALTER TABLE "characters" ADD CONSTRAINT "characters_experience_check" CHECK ("experience" >= 0);

-- character_classes (rules.md §2)
ALTER TABLE "character_classes" ADD CONSTRAINT "character_classes_base_stats_check"
    CHECK ("base_hp" >= 1 AND "base_mana" >= 0 AND "base_attack" >= 0 AND "base_defense" >= 0 AND "base_speed" >= 0);
ALTER TABLE "character_classes" ADD CONSTRAINT "character_classes_growth_check"
    CHECK ("hp_per_level" >= 0 AND "mana_per_level" >= 0 AND "attack_per_level" >= 0 AND "defense_per_level" >= 0 AND "speed_per_level" >= 0);

-- zones (rules.md §8)
ALTER TABLE "zones" ADD CONSTRAINT "zones_level_range_check" CHECK ("min_level" >= 1 AND "max_level" >= "min_level");

-- monsters (rules.md §8)
ALTER TABLE "monsters" ADD CONSTRAINT "monsters_stats_check"
    CHECK ("level" >= 1 AND "hp" >= 1 AND "attack" >= 0 AND "defense" >= 0 AND "speed" >= 0 AND "xp_reward" >= 0);

-- loot_entries (rules.md §7) : probabilité en points de base, de 0 à 10 000.
ALTER TABLE "loot_entries" ADD CONSTRAINT "loot_entries_drop_chance_check" CHECK ("drop_chance_bp" BETWEEN 0 AND 10000);
