import { clonePlanningJson, validateIdentifier, validateKind, validateSemver } from '@kdtp/test-plan';
import { capabilityInvariant } from './errors.js';
import {
  capabilityKey,
  createCapabilityCatalog,
  supportsTargetKind,
  validateCapabilityCatalog,
} from './validation.js';

export class CapabilityCatalogPort {
  async getCatalog() {
    throw new Error('CapabilityCatalogPort.getCatalog must be implemented');
  }

  async resolve() {
    throw new Error('CapabilityCatalogPort.resolve must be implemented');
  }

  async assertCompatible() {
    throw new Error('CapabilityCatalogPort.assertCompatible must be implemented');
  }
}

export class InMemoryCapabilityCatalog extends CapabilityCatalogPort {
  #catalog;
  #byIdentity;

  constructor(input) {
    super();
    this.#catalog = input?.schemaVersion
      ? validateCapabilityCatalog(input)
      : createCapabilityCatalog(input);
    this.#byIdentity = new Map(
      this.#catalog.capabilities.map((capability) => [capabilityKey(capability), capability]),
    );
  }

  async getCatalog() {
    return clonePlanningJson(this.#catalog);
  }

  async resolve(reference, options = {}) {
    const capabilityId = validateIdentifier(reference?.capabilityId, 'capabilityId');
    const version = validateSemver(reference?.version, 'capability.version');
    const key = `${capabilityId}@${version}`;
    const capability = this.#byIdentity.get(key);
    capabilityInvariant(capability, 'CAPABILITY_NOT_FOUND', 'Capability was not found in the bound catalog', {
      capabilityId,
      version,
      catalogVersion: this.#catalog.version,
      catalogDigest: this.#catalog.digest,
    });
    const allowDisabled = options.allowDisabled === true;
    capabilityInvariant(capability.enabled || allowDisabled,
      'CAPABILITY_DISABLED', 'Capability is disabled in the bound catalog', {
        capabilityId,
        version,
      });
    return clonePlanningJson(capability);
  }

  async assertCompatible(reference, targetKind, options = {}) {
    const capability = await this.resolve(reference, options);
    const normalizedKind = validateKind(targetKind, 'targetKind');
    capabilityInvariant(supportsTargetKind(capability, normalizedKind),
      'CAPABILITY_TARGET_KIND_MISMATCH', 'Capability does not support the target kind', {
        capabilityId: capability.capabilityId,
        version: capability.version,
        targetKind: normalizedKind,
        supportedTargetKinds: capability.targetKinds,
      });
    return capability;
  }
}
