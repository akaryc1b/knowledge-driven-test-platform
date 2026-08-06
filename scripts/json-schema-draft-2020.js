import { canonicalStringify } from '@kdtp/knowledge-core';

const SCHEMA_KEYS = new Set([
  '$schema', '$id', '$ref', '$defs', '$comment', 'title', 'description',
  'type', 'const', 'enum', 'required', 'properties', 'additionalProperties',
  'pattern', 'format', 'minLength', 'maxLength', 'minimum',
  'minItems', 'maxItems', 'uniqueItems', 'items',
]);

export function validateJsonSchemaDraft202012(instance, schema, label = 'document') {
  invariant(schema?.$schema === 'https://json-schema.org/draft/2020-12/schema',
    `${label} Schema is not Draft 2020-12`);
  validateSchemaNode(schema, '$schema');
  visit(instance, schema, '$', schema, label);
  return true;
}

function validateSchemaNode(node, path) {
  invariant(node && typeof node === 'object' && !Array.isArray(node),
    `Invalid Schema node at ${path}`);
  for (const key of Object.keys(node)) {
    invariant(SCHEMA_KEYS.has(key), `Unsupported Schema keyword at ${path}: ${key}`);
  }
  if (node.properties !== undefined) {
    invariant(isRecord(node.properties), `Invalid Schema properties at ${path}`);
    for (const [name, child] of Object.entries(node.properties)) {
      validateSchemaNode(child, `${path}.properties.${name}`);
    }
  }
  if (node.$defs !== undefined) {
    invariant(isRecord(node.$defs), `Invalid Schema definitions at ${path}`);
    for (const [name, child] of Object.entries(node.$defs)) {
      validateSchemaNode(child, `${path}.$defs.${name}`);
    }
  }
  if (node.items !== undefined) validateSchemaNode(node.items, `${path}.items`);
  if (isRecord(node.additionalProperties)) {
    validateSchemaNode(node.additionalProperties, `${path}.additionalProperties`);
  }
}

function visit(instance, node, path, root, label) {
  if (node.$ref !== undefined) visit(instance, resolveLocalRef(root, node.$ref), path, root, label);
  if (Object.hasOwn(node, 'const')) {
    invariant(equal(instance, node.const), `${label} Schema const mismatch at ${path}`);
  }
  if (node.enum !== undefined) {
    invariant(Array.isArray(node.enum) && node.enum.some((candidate) => equal(instance, candidate)),
      `${label} Schema enum mismatch at ${path}`);
  }
  if (node.type !== undefined) {
    const types = Array.isArray(node.type) ? node.type : [node.type];
    invariant(types.some((type) => matchesType(instance, type)),
      `${label} Schema type mismatch at ${path}`);
  }
  if (typeof instance === 'string') validateString(instance, node, path, label);
  if (typeof instance === 'number' && node.minimum !== undefined) {
    invariant(instance >= node.minimum, `${label} Schema minimum mismatch at ${path}`);
  }
  if (Array.isArray(instance)) validateArray(instance, node, path, root, label);
  if (isRecord(instance)) validateObject(instance, node, path, root, label);
}

function validateString(value, node, path, label) {
  if (node.minLength !== undefined) {
    invariant(value.length >= node.minLength, `${label} Schema minLength mismatch at ${path}`);
  }
  if (node.maxLength !== undefined) {
    invariant(value.length <= node.maxLength, `${label} Schema maxLength mismatch at ${path}`);
  }
  if (node.pattern !== undefined) {
    invariant(new RegExp(node.pattern, 'u').test(value), `${label} Schema pattern mismatch at ${path}`);
  }
  if (node.format !== undefined) {
    invariant(node.format === 'date-time', `${label} unsupported Schema format at ${path}`);
    invariant(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/u.test(value)
      && !Number.isNaN(Date.parse(value)), `${label} Schema date-time mismatch at ${path}`);
  }
}

function validateArray(value, node, path, root, label) {
  if (node.minItems !== undefined) {
    invariant(value.length >= node.minItems, `${label} Schema minItems mismatch at ${path}`);
  }
  if (node.maxItems !== undefined) {
    invariant(value.length <= node.maxItems, `${label} Schema maxItems mismatch at ${path}`);
  }
  if (node.uniqueItems === true) {
    const identities = value.map(canonicalStringify);
    invariant(new Set(identities).size === identities.length,
      `${label} Schema uniqueItems mismatch at ${path}`);
  }
  if (node.items !== undefined) {
    value.forEach((item, index) => visit(item, node.items, `${path}[${index}]`, root, label));
  }
}

function validateObject(value, node, path, root, label) {
  const properties = node.properties ?? {};
  invariant(isRecord(properties), `${label} invalid Schema properties at ${path}`);
  for (const required of node.required ?? []) {
    invariant(Object.hasOwn(value, required), `${label} Schema required property missing at ${path}.${required}`);
  }
  for (const [key, child] of Object.entries(value)) {
    if (Object.hasOwn(properties, key)) visit(child, properties[key], `${path}.${key}`, root, label);
    else if (node.additionalProperties === false) {
      throw new Error(`${label} Schema additional property at ${path}.${key}`);
    } else if (isRecord(node.additionalProperties)) {
      visit(child, node.additionalProperties, `${path}.${key}`, root, label);
    }
  }
}

function resolveLocalRef(root, ref) {
  invariant(typeof ref === 'string' && ref.startsWith('#/'), `Unsupported Schema ref: ${ref}`);
  let current = root;
  for (const raw of ref.slice(2).split('/')) {
    const token = raw.replaceAll('~1', '/').replaceAll('~0', '~');
    invariant(isRecord(current) && Object.hasOwn(current, token), `Unresolvable Schema ref: ${ref}`);
    current = current[token];
  }
  return current;
}

function matchesType(value, type) {
  switch (type) {
    case 'object': return isRecord(value);
    case 'array': return Array.isArray(value);
    case 'string': return typeof value === 'string';
    case 'integer': return Number.isInteger(value);
    case 'number': return typeof value === 'number' && Number.isFinite(value);
    case 'boolean': return typeof value === 'boolean';
    case 'null': return value === null;
    default: throw new Error(`Unsupported Schema type: ${type}`);
  }
}

function equal(left, right) {
  return canonicalStringify(left) === canonicalStringify(right);
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}
