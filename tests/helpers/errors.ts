/**
 * Attend une promesse qui doit être rejetée, et renvoie l'erreur obtenue.
 * Si la promesse se résout, le test échoue.
 *
 * On vérifie ensuite l'erreur par ses propriétés (status, code) plutôt qu'avec instanceof :
 * après vi.resetModules(), la classe HttpError du module rechargé n'est pas la même
 * que celle qu'on importerait en haut du fichier de test.
 */
export async function rejectionOf(promise: Promise<unknown>): Promise<unknown> {
    return promise.then(
        () => {
            throw new Error("L'action devait échouer, mais elle s'est terminée normalement.")
        },
        (error: unknown) => error
    )
}
