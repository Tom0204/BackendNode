/* Horloge contrôlée (AUTH-05) : les tests d'expiration avancent le temps au lieu d'attendre. */

export interface TestClock {
    now(): Date
    /** Avance l'horloge du nombre de millisecondes donné. */
    advance(ms: number): void
}

export function createTestClock(start: Date = new Date()): TestClock {
    let current = start.getTime()
    return {
        now: () => new Date(current),
        advance: (ms) => {
            current += ms
        }
    }
}
