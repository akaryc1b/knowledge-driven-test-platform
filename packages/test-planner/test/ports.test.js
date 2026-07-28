import test from 'node:test';
import assert from 'node:assert/strict';
import { PlanningStrategyPort, TestPlannerPort } from '../src/index.js';

test('planner and strategy ports fail closed when not implemented', async () => {
  await assert.rejects(() => new TestPlannerPort().plan(), /must be implemented/);
  await assert.rejects(() => new PlanningStrategyPort().createIntentSpecs(), /must be implemented/);
});
