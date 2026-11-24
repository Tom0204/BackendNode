import { createInMemorySessionRepository } from '../helpers/in-memory-session-repository'
import { createInMemoryUserRepository } from '../helpers/in-memory-user-repository'
import { describeSessionRepositoryContract } from '../helpers/session-repository-contract'

/* Le repository de sessions en mémoire respecte le même contrat que le repository Prisma (AUTH-05). */

describeSessionRepositoryContract('en mémoire', () => {
    const users = createInMemoryUserRepository()
    return { users, sessions: createInMemorySessionRepository(users) }
})
