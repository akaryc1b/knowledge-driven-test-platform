import { InMemoryKnowledgeRegistry } from '../src/index.js';
import { defineKnowledgeRegistryContractTests } from './registry-contract.js';

defineKnowledgeRegistryContractTests(
  'InMemoryKnowledgeRegistry',
  () => new InMemoryKnowledgeRegistry(),
);
