#!/usr/bin/env node
import { run } from './cli.js';

const moduleId = process.env.KDTP_PLAN_CLI_CONTEXT_MODULE;
if (!moduleId) {
  process.stderr.write('KDTP_PLAN_CLI_CONTEXT_MODULE must export createPlanningCliContext()\n');
  process.exitCode = 1;
} else {
  import(moduleId)
    .then(async (module) => {
      if (typeof module.createPlanningCliContext !== 'function') {
        throw new Error('Context module must export createPlanningCliContext()');
      }
      return run(process.argv.slice(2), await module.createPlanningCliContext());
    })
    .catch((error) => {
      const code = error.code ? `[${error.code}] ` : '';
      process.stderr.write(`${code}${error.message}\n`);
      process.exitCode = 1;
    });
}
