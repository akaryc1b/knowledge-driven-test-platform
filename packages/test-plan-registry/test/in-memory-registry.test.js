import test from 'node:test';
import { InMemoryTestPlanRegistry } from '../src/index.js';
import { defineTestPlanRegistryContractTests } from './registry-contract.js';

defineTestPlanRegistryContractTests(
  'InMemoryTestPlanRegistry',
  () => new InMemoryTestPlanRegistry(),
);
