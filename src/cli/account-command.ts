import type { UserRepository } from '../repositories/user.repository'
import { normalizeEmail } from '../services/user.service'
import type { User, UserRole, UserStatus } from '../types/user'

/* Administration locale des comptes (D8 du lot L2) : `npm run account -- <action> <email>`.
 * - Agit uniquement sur un compte existant : ne crée jamais de compte ; une adresse inconnue est signalée.
 * - Pas de route HTTP : le rôle et le statut ne sont modifiables que par une personne ayant accès au serveur.
 * - Logique séparée de l'entrée (scripts/account.ts) : testable avec un repository contrôlé, sans base.
 * Messages en français : outil destiné au développeur (AGENTS.md §5).
 */

interface AccountAction {
    description: string
    apply: (repository: UserRepository, user: User) => Promise<User | undefined>
    alreadyDone: (user: User) => boolean
}

const setRole = (role: UserRole): AccountAction['apply'] => (repository, user) => repository.setRole(user.id, role)
const setStatus = (status: UserStatus): AccountAction['apply'] => (repository, user) => repository.setStatus(user.id, status)

const ACTIONS: Record<string, AccountAction> = {
    promote: { description: 'donner le rôle ADMIN', apply: setRole('ADMIN'), alreadyDone: (user) => user.role === 'ADMIN' },
    demote: { description: 'redonner le rôle PLAYER', apply: setRole('PLAYER'), alreadyDone: (user) => user.role === 'PLAYER' },
    disable: { description: 'désactiver le compte', apply: setStatus('DISABLED'), alreadyDone: (user) => user.status === 'DISABLED' },
    enable: { description: 'réactiver le compte', apply: setStatus('ACTIVE'), alreadyDone: (user) => user.status === 'ACTIVE' }
}

/** Codes de sortie du script. */
export const EXIT_OK = 0
export const EXIT_FAILURE = 1
export const EXIT_USAGE = 2

export const ACCOUNT_USAGE = [
    'Usage : npm run account -- <action> <email>',
    ...Object.entries(ACTIONS).map(([name, action]) => `  ${name.padEnd(8)} ${action.description}`)
].join('\n')

export interface AccountCommandOutput {
    info(message: string): void
    error(message: string): void
}

const describe = (user: User): string => `${user.email} (rôle ${user.role}, statut ${user.status})`

/** Exécute une commande et renvoie le code de sortie. Ne lève pas d'exception pour une erreur d'usage. */
export async function runAccountCommand(
    args: readonly string[],
    repository: UserRepository,
    output: AccountCommandOutput
): Promise<number> {
    const [actionName, rawEmail, ...extra] = args
    const action = actionName === undefined ? undefined : ACTIONS[actionName]
    if (!action || rawEmail === undefined || rawEmail.trim() === '' || extra.length > 0) {
        output.error(ACCOUNT_USAGE)
        return EXIT_USAGE
    }

    const email = normalizeEmail(rawEmail.trim())
    const user = await repository.findByEmail(email)
    if (!user) {
        output.error(`Aucun compte pour l'adresse ${email} : rien n'a été modifié (le script ne crée jamais de compte).`)
        return EXIT_FAILURE
    }
    if (action.alreadyDone(user)) {
        output.info(`Rien à faire : ${describe(user)}.`)
        return EXIT_OK
    }

    const updated = await action.apply(repository, user)
    if (!updated) {
        // Compte supprimé entre la lecture et la modification.
        output.error(`Le compte ${email} n'existe plus : rien n'a été modifié.`)
        return EXIT_FAILURE
    }
    output.info(`Compte modifié : ${describe(updated)}.`)
    return EXIT_OK
}
