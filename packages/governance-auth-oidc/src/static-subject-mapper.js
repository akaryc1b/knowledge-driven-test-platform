import { httpInvariant } from '@kdtp/governance-http';
import { SubjectMapperPort } from './ports.js';
import { unauthenticated } from './errors.js';

export class StaticSubjectMapper extends SubjectMapperPort {
  constructor(entries = []) {
    super();
    this.entries = new Map();
    for (const entry of entries) this.register(entry);
  }

  register(input) {
    httpInvariant(typeof input?.issuer === 'string' && input.issuer.length > 0,
      'INVALID_SUBJECT_MAPPING', 'Subject mapping issuer is required', 500);
    httpInvariant(typeof input?.subject === 'string' && input.subject.length > 0,
      'INVALID_SUBJECT_MAPPING', 'Subject mapping subject is required', 500);
    httpInvariant(typeof input?.actor === 'string' && input.actor.trim().length > 0,
      'INVALID_SUBJECT_MAPPING', 'Subject mapping actor is required', 500);
    this.entries.set(key(input.issuer, input.subject), {
      actor: input.actor,
      attributes: structuredClone(input.attributes ?? {}),
      disabled: input.disabled === true,
    });
    return this;
  }

  async map(input) {
    const entry = this.entries.get(key(input?.issuer, input?.subject));
    if (!entry || entry.disabled) throw unauthenticated('SUBJECT_NOT_MAPPED');
    return {
      actor: entry.actor,
      attributes: structuredClone(entry.attributes),
    };
  }
}

function key(issuer, subject) {
  return `${issuer}\u0000${subject}`;
}
