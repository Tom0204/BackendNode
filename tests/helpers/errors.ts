/**
 * Exécute une action qui doit lever une erreur, et renvoie cette erreur.
 * Si l'action ne lève rien, le test échoue.
 *
 * On vérifie ensuite l'erreur par ses propriétés (status, code) plutôt qu'avec instanceof :
 * après vi.resetModules(), la classe HttpError du module rechargé n'est pas la même
 * que celle qu'on importerait en haut du fichier de test.
 */
export function captureError(action: () => unknown): unknown {
    try {
        action()
    } catch (error) {
        return error
    }
    throw new Error("L'action devait lever une erreur, mais elle s'est terminée normalement.")
}