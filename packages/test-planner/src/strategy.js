import { clonePlanningJson } from '@kdtp/test-plan';
import { plannerInvariant } from './errors.js';
import { PlanningStrategyPort } from './ports.js';

export class DeclarativePlanningStrategy extends PlanningStrategyPort {
  async createIntentSpecs(context) {
    const input = materializeContract(context.capability.inputContract, context, 'input');
    const assertions = materializeContract(context.capability.assertionContract, context, 'assertions');
    const thresholds = materializeContract(context.capability.thresholdContract, context, 'thresholds');
    return [{
      intentKey: 'primary',
      input,
      assertions,
      thresholds,
      tags: [
        context.policyEntry.mandatory ? 'mandatory' : 'optional',
        ...context.capability.tags,
      ],
    }];
  }
}

function materializeContract(contract, context, label) {
  const fields = contract.fields ?? [];
  plannerInvariant(Array.isArray(fields), 'INVALID_CAPABILITY_CONTRACT',
    `${label} capability contract fields must be an array`);
  const output = {};
  for (const field of fields) {
    plannerInvariant(field && typeof field === 'object' && !Array.isArray(field)
        && typeof field.name === 'string' && field.name.length > 0,
    'INVALID_CAPABILITY_CONTRACT', `${label} capability contract field is invalid`);
    const value = resolveField(field.name, context);
    if (value === undefined) {
      plannerInvariant(field.required !== true, 'UNSUPPORTED_OBLIGATION',
        `Required ${label} contract field cannot be derived deterministically`, {
          field: field.name,
          capabilityId: context.capability.capabilityId,
          capabilityVersion: context.capability.version,
        });
      continue;
    }
    output[field.name] = clonePlanningJson(value);
  }
  return output;
}

function resolveField(name, context) {
  if (Object.hasOwn(context.target.attributes ?? {}, name)) return context.target.attributes[name];
  if (Object.hasOwn(context.target, name)) return context.target[name];
  if (Object.hasOwn(context.knowledge.value ?? {}, name)) return context.knowledge.value[name];
  return undefined;
}
