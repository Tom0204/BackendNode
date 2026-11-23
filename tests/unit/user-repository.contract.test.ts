import { createInMemoryUserRepository } from '../helpers/in-memory-user-repository'
import { describeUserRepositoryContract } from '../helpers/user-repository-contract'

// Contrat exécuté sur le repository contrôlé des tests ; la même suite tourne sur Prisma dans tests/database/.
describeUserRepositoryContract('repository en mémoire (tests)', createInMemoryUserRepository)
