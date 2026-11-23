import type { PrismaClient } from '../../src/generated/prisma/client'
import { CLASSES, ITEMS, LOOT, MONSTERS, ZONES } from './reference-data'

/* Seed idempotent des données de référence (DB-03).
 * Chaque élément est mis à jour ou créé selon son code (upsert) : exécuter le seed plusieurs fois
 * ne crée aucun doublon et remet les valeurs de reference-data.ts. Le seed ne supprime jamais rien.
 * Tout se fait dans une transaction : en cas d'erreur, aucune donnée n'est modifiée.
 * Aucune donnée de joueur n'est créée ici : les données de test restent dans tests/.
 */

export interface SeedSummary {
    classes: number
    zones: number
    monsters: number
    zoneMonsters: number
    items: number
    lootEntries: number
}

// Identifiant d'un code dans une table de correspondance remplie par le seed ; erreur explicite si absent.
function idOf(ids: Map<string, string>, code: string, kind: string): string {
    const id = ids.get(code)
    if (id === undefined) {
        throw new Error(`Données de référence incohérentes : ${kind} « ${code} » inconnu.`)
    }
    return id
}

export async function seedReferenceData(prisma: PrismaClient): Promise<SeedSummary> {
    return prisma.$transaction(async (tx) => {
        for (const { code, ...data } of CLASSES) {
            await tx.characterClass.upsert({ where: { code }, create: { code, ...data }, update: data })
        }

        const monsterIds = new Map<string, string>()
        for (const { code, ...data } of MONSTERS) {
            const monster = await tx.monster.upsert({ where: { code }, create: { code, ...data }, update: data })
            monsterIds.set(code, monster.id)
        }

        let zoneMonsters = 0
        for (const { code, monsterCodes, ...data } of ZONES) {
            const zone = await tx.zone.upsert({ where: { code }, create: { code, ...data }, update: data })
            for (const monsterCode of monsterCodes) {
                const monsterId = idOf(monsterIds, monsterCode, 'monstre')
                await tx.zoneMonster.upsert({
                    where: { zoneId_monsterId: { zoneId: zone.id, monsterId } },
                    create: { zoneId: zone.id, monsterId },
                    update: {}
                })
                zoneMonsters++
            }
        }

        const itemIds = new Map<string, string>()
        for (const { code, ...data } of ITEMS) {
            const item = await tx.item.upsert({ where: { code }, create: { code, ...data }, update: data })
            itemIds.set(code, item.id)
        }

        for (const { monsterCode, itemCode, dropChanceBp } of LOOT) {
            const monsterId = idOf(monsterIds, monsterCode, 'monstre')
            const itemId = idOf(itemIds, itemCode, 'objet')
            await tx.lootEntry.upsert({
                where: { monsterId },
                create: { monsterId, itemId, dropChanceBp },
                update: { itemId, dropChanceBp }
            })
        }

        return {
            classes: CLASSES.length,
            zones: ZONES.length,
            monsters: MONSTERS.length,
            zoneMonsters,
            items: ITEMS.length,
            lootEntries: LOOT.length
        }
    })
}
