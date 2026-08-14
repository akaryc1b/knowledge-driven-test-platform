import { createHash } from 'node:crypto';
import { sha256 } from '@kdtp/knowledge-core';
import { K6_OUTPUT_ROOT_LIMITS } from './constants.js';
import { K6OutputRootContractError, outputRootInvariant } from './errors.js';
import { deepFreeze } from './bounded-result-collector-definitions.js';

export function parseK6BoundedJsonPayload(bytes, options = {}) {
  const maxBytes = options.maxBytes ?? K6_OUTPUT_ROOT_LIMITS.maxFileBytes;
  const maxDepth = options.maxDepth ?? K6_OUTPUT_ROOT_LIMITS.maxJsonDepth;
  const bomAllowed = options.bomAllowed ?? false;
  const duplicateKeyPolicy = options.duplicateKeyPolicy ?? 'REJECT';
  outputRootInvariant(Number.isInteger(maxBytes) && maxBytes > 0,
    'K6_OUTPUT_JSON_LIMIT_INVALID', 'maxBytes must be a positive integer');
  outputRootInvariant(Number.isInteger(maxDepth) && maxDepth > 0,
    'K6_OUTPUT_JSON_LIMIT_INVALID', 'maxDepth must be a positive integer');
  outputRootInvariant(duplicateKeyPolicy === 'REJECT',
    'K6_OUTPUT_JSON_DUPLICATE_POLICY_UNSUPPORTED',
    'Only duplicate-key rejection is supported');
  const normalizedBytes = validateTransientBytes(bytes, maxBytes);
  const hasBom = normalizedBytes.byteLength >= 3
    && normalizedBytes[0] === 0xef
    && normalizedBytes[1] === 0xbb
    && normalizedBytes[2] === 0xbf;
  outputRootInvariant(bomAllowed || !hasBom,
    'K6_OUTPUT_JSON_BOM_REJECTED', 'UTF-8 BOM is not allowed');
  let text;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(normalizedBytes);
  } catch {
    throw new K6OutputRootContractError(
      'K6_OUTPUT_JSON_UTF8_INVALID',
      'Output artifact is not valid UTF-8',
    );
  }
  const parser = new BoundedJsonParser(text, maxDepth);
  const value = parser.parse();
  outputRootInvariant(value && typeof value === 'object'
      && !Array.isArray(value),
  'K6_OUTPUT_JSON_ROOT_INVALID',
  'Output artifact JSON root must be an object');
  return deepFreeze({
    byteLength: normalizedBytes.byteLength,
    contentDigest: rawSha256(normalizedBytes),
    canonicalJsonDigest: sha256(value),
    maxDepthObserved: parser.maxDepthObserved,
    topLevelKeyCount: Object.keys(value).length,
  });
}


export function validateTransientBytes(value, maxBytes) {
  outputRootInvariant(value instanceof Uint8Array,
    'K6_OUTPUT_ARTIFACT_PAYLOAD_TYPE_INVALID',
    'Transient output payload must be a Uint8Array');
  outputRootInvariant(value.byteLength <= maxBytes,
    'K6_OUTPUT_ARTIFACT_SIZE_EXCEEDED',
    'Transient output payload exceeds the byte limit');
  return Uint8Array.from(value);
}

export function rawSha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}


class BoundedJsonParser {
  constructor(text, maxDepth) {
    this.text = text;
    this.maxDepth = maxDepth;
    this.index = 0;
    this.maxDepthObserved = 0;
  }

  parse() {
    this.skipWhitespace();
    const value = this.parseValue(0);
    this.skipWhitespace();
    outputRootInvariant(this.index === this.text.length,
      'K6_OUTPUT_JSON_TRAILING_CONTENT',
      'Output artifact contains trailing JSON content');
    return value;
  }

  parseValue(depth) {
    this.skipWhitespace();
    const char = this.text[this.index];
    if (char === '{') return this.parseObject(depth + 1);
    if (char === '[') return this.parseArray(depth + 1);
    if (char === '"') return this.parseString();
    if (char === 't') return this.parseLiteral('true', true);
    if (char === 'f') return this.parseLiteral('false', false);
    if (char === 'n') return this.parseLiteral('null', null);
    return this.parseNumber();
  }

  enterDepth(depth) {
    outputRootInvariant(depth <= this.maxDepth,
      'K6_OUTPUT_JSON_DEPTH_EXCEEDED',
      'Output artifact JSON exceeds the depth limit');
    this.maxDepthObserved = Math.max(this.maxDepthObserved, depth);
  }

  parseObject(depth) {
    this.enterDepth(depth);
    this.expect('{');
    this.skipWhitespace();
    const result = Object.create(null);
    const keys = new Set();
    if (this.peek('}')) {
      this.index += 1;
      return result;
    }
    while (true) {
      outputRootInvariant(this.text[this.index] === '"',
        'K6_OUTPUT_JSON_OBJECT_KEY_INVALID',
        'Output artifact JSON object key must be a string');
      const key = this.parseString();
      outputRootInvariant(!keys.has(key),
        'K6_OUTPUT_JSON_DUPLICATE_KEY',
        'Output artifact JSON contains a duplicate object key');
      keys.add(key);
      this.skipWhitespace();
      this.expect(':');
      result[key] = this.parseValue(depth);
      this.skipWhitespace();
      if (this.peek('}')) {
        this.index += 1;
        return result;
      }
      this.expect(',');
      this.skipWhitespace();
    }
  }

  parseArray(depth) {
    this.enterDepth(depth);
    this.expect('[');
    this.skipWhitespace();
    const result = [];
    if (this.peek(']')) {
      this.index += 1;
      return result;
    }
    while (true) {
      result.push(this.parseValue(depth));
      this.skipWhitespace();
      if (this.peek(']')) {
        this.index += 1;
        return result;
      }
      this.expect(',');
      this.skipWhitespace();
    }
  }

  parseString() {
    const start = this.index;
    this.expect('"');
    let escaped = false;
    while (this.index < this.text.length) {
      const char = this.text[this.index];
      this.index += 1;
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === '\\') {
        escaped = true;
        continue;
      }
      if (char === '"') {
        const stringLiteral = this.text.slice(start, this.index);
        try {
          return JSON.parse(stringLiteral);
        } catch {
          throw new K6OutputRootContractError(
            'K6_OUTPUT_JSON_STRING_INVALID',
            'Output artifact contains an invalid JSON string',
          );
        }
      }
      outputRootInvariant(char.charCodeAt(0) >= 0x20,
        'K6_OUTPUT_JSON_STRING_INVALID',
        'Output artifact contains an invalid control character');
    }
    throw new K6OutputRootContractError(
      'K6_OUTPUT_JSON_STRING_INVALID',
      'Output artifact contains an unterminated JSON string',
    );
  }

  parseLiteral(token, value) {
    outputRootInvariant(this.text.slice(this.index, this.index + token.length)
        === token,
    'K6_OUTPUT_JSON_TOKEN_INVALID',
    'Output artifact contains an invalid JSON token');
    this.index += token.length;
    return value;
  }

  parseNumber() {
    const match = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/u
      .exec(this.text.slice(this.index));
    outputRootInvariant(Boolean(match),
      'K6_OUTPUT_JSON_NUMBER_INVALID',
      'Output artifact contains an invalid JSON number');
    this.index += match[0].length;
    const value = Number(match[0]);
    outputRootInvariant(Number.isFinite(value),
      'K6_OUTPUT_JSON_NUMBER_INVALID',
      'Output artifact contains a non-finite JSON number');
    return value;
  }

  skipWhitespace() {
    while (/[\t\n\r ]/u.test(this.text[this.index] ?? '')) this.index += 1;
  }

  expect(char) {
    outputRootInvariant(this.text[this.index] === char,
      'K6_OUTPUT_JSON_TOKEN_INVALID',
      `Output artifact JSON expected ${char}`);
    this.index += 1;
  }

  peek(char) {
    return this.text[this.index] === char;
  }
}
