import { canonicalStringify } from '@kdtp/knowledge-core';
import { sourceRendererInvariant } from './errors.js';
import {
  ABSOLUTE_FILE_PATH,
  CREDENTIAL_URI,
  SECRET_TEXT,
  VOLATILE_TEXT,
  countLines,
} from './source-renderer-shared.js';

export function validateRenderedSourceText(source, context) {
  sourceRendererInvariant(typeof source === 'string' && source.length > 0,
    'INVALID_K6_API_RENDERED_SOURCE', 'Rendered source must be a non-empty string');
  sourceRendererInvariant(!source.startsWith('\uFEFF') && !source.includes('\r'),
    'K6_API_SOURCE_ENCODING_POLICY_VIOLATION', 'Rendered source must be UTF-8 LF without BOM');
  sourceRendererInvariant(source.endsWith('\n') && !source.endsWith('\n\n'),
    'K6_API_SOURCE_TRAILING_NEWLINE_POLICY_VIOLATION',
    'Rendered source must contain exactly one trailing newline');
  sourceRendererInvariant(Buffer.byteLength(source, 'utf8')
      <= context.descriptor.limits.maxSerializedSpecBytes,
  'K6_API_SOURCE_TOO_LARGE', 'Rendered source exceeds the fixed P1 byte limit');
  sourceRendererInvariant(countLines(source) <= context.descriptor.limits.maxSerializedSpecBytes,
    'K6_API_SOURCE_TOO_MANY_LINES', 'Rendered source exceeds the fixed derived line limit');
  const importLines = source.split('\n').filter((line) => /^import\b/.test(line));
  const expectedImportLines = [
    "import { check, group } from 'k6';",
    "import http from 'k6/http';",
  ];
  sourceRendererInvariant(canonicalStringify(importLines)
      === canonicalStringify(expectedImportLines),
  'K6_API_SOURCE_IMPORT_ALLOW_LIST_VIOLATION',
  'Rendered source import declarations do not match the fixed canonical forms');
  const imports = [...source.matchAll(/^import\s+[^\n]+\s+from\s+'([^']+)';$/gm)]
    .map((match) => match[1]);
  sourceRendererInvariant(canonicalStringify(imports)
      === canonicalStringify(context.moduleImports),
  'K6_API_SOURCE_IMPORT_ALLOW_LIST_VIOLATION',
  'Rendered source imports do not match the fixed module allow-list and order');
  for (const [code, pattern] of [
    ['K6_API_SOURCE_DYNAMIC_IMPORT_FORBIDDEN', /\bimport\s*\(/],
    ['K6_API_SOURCE_REQUIRE_FORBIDDEN', /\brequire\s*\(/],
    ['K6_API_SOURCE_EVAL_FORBIDDEN', /\beval\s*\(/],
    ['K6_API_SOURCE_FUNCTION_CONSTRUCTOR_FORBIDDEN', /\b(?:new\s+)?Function\s*\(/],
    ['K6_API_SOURCE_WEBASSEMBLY_FORBIDDEN', /\bWebAssembly\b/],
    ['K6_API_SOURCE_NODE_API_FORBIDDEN', /\bnode:|\bchild_process\b|\bprocess\b/],
    ['K6_API_SOURCE_EXTERNAL_RUNTIME_FORBIDDEN', /\bDeno\b|\bBun\b/],
    ['K6_API_SOURCE_FETCH_FORBIDDEN', /\bfetch\s*\(/],
    ['K6_API_SOURCE_FILE_READ_FORBIDDEN', /\bopen\s*\(/],
    ['K6_API_SOURCE_ENVIRONMENT_ACCESS_FORBIDDEN', /\b__ENV\b/],
    ['K6_API_SOURCE_TEMPLATE_LITERAL_FORBIDDEN', /`|\$\{/],
    ['K6_API_SOURCE_NETWORK_TARGET_FORBIDDEN', /\bhttps?:\/\//i],
    ['K6_API_SOURCE_CREDENTIAL_URI_FORBIDDEN', CREDENTIAL_URI],
    ['K6_API_SOURCE_FILE_PATH_FORBIDDEN', ABSOLUTE_FILE_PATH],
    ['K6_API_SOURCE_SECRET_MATERIAL_FORBIDDEN', SECRET_TEXT],
    ['K6_API_SOURCE_VOLATILE_METADATA_FORBIDDEN', VOLATILE_TEXT],
  ]) sourceRendererInvariant(!pattern.test(source), code,
    'Rendered source violates the static non-execution safety policy');
}
