import { createInMemoryCharacterClassRepository } from '../helpers/in-memory-character-class-repository'
import { createInMemoryCharacterRepository, IN_MEMORY_STARTING_ZONE_ID } from '../helpers/in-memory-character-repository'
import { createInMemoryUserRepository } from '../helpers/in-memory-user-repository'
import { describeCharacterClassRepositoryContract, describeCharacterRepositoryContract } from '../helpers/character-repository-contract'

/* Les repositories de personnages et de classes en mémoire respectent les mêmes contrats que les repositories Prisma. */

describeCharacterRepositoryContract('en mémoire', () => {
    const users = createInMemoryUserRepository()
    const classes = createInMemoryCharacterClassRepository()
    return {
        users,
        classes,
        characters: createInMemoryCharacterRepository({ users, classes }),
        startingZoneId: async () => IN_MEMORY_STARTING_ZONE_ID
    }
})

describeCharacterClassRepositoryContract('en mémoire', createInMemoryCharacterClassRepository)
