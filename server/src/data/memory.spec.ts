import { createMemoryRepositories } from './memory/memory-repositories';
import { describeRepositories } from './repositories.contract';

describeRepositories('memory', async () => createMemoryRepositories());
