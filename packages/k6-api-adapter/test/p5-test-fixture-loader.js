import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import {
  ACCEPTED_P4, ACCEPTED_P4_ARTIFACT_RECEIPT_PATH, ACCEPTED_P4_EVIDENCE_PATH,
} from '../../../scripts/m3-r2-p5-baseline.js';
import {
  canonicalStringify, gitBlobSha, invariant, sha256,
} from './p5-test-canonical.js';
import {
  productIdentity, verifyAcceptedP4,
} from './p5-test-publication-verifier.js';

const receiptUrl = new URL(`../../../${ACCEPTED_P4_ARTIFACT_RECEIPT_PATH}`, import.meta.url);
const evidenceUrl = new URL(`../../../${ACCEPTED_P4_EVIDENCE_PATH}`, import.meta.url);

export async function loadAcceptedP5Fixture() {
  const [receiptRaw, evidenceRaw] = await Promise.all([
    readFile(receiptUrl, 'utf8'), readFile(evidenceUrl, 'utf8'),
  ]);
  const compactReceipt = JSON.parse(receiptRaw); const evidence = JSON.parse(evidenceRaw);
  invariant(compactReceipt.publicationArchive.encoding === 'gzip+base64-parts'
      && compactReceipt.publicationArchive.archiveBlobSha === ACCEPTED_P4.publicationArchiveBlobSha
      && compactReceipt.publicationArchive.parts.length === 4,
  'P4 accepted publication archive part contract mismatch');
  const partRaws = await Promise.all(compactReceipt.publicationArchive.parts.map(async (part, index) => {
    invariant(part.path === `evidence/m3-r2/m3-r2-source-generation-p4-accepted-publication.json.gz.b64.${String(index).padStart(2, '0')}`,
      'P4 accepted publication archive part path mismatch');
    const raw = await readFile(new URL(`../../../${part.path}`, import.meta.url), 'utf8');
    invariant(Buffer.byteLength(raw) === part.byteLength && sha256(raw) === part.rawSha256
        && gitBlobSha(raw) === part.gitBlobSha,
    'P4 accepted publication archive part digest mismatch');
    return raw.trim();
  }));
  const archive = Buffer.from(partRaws.join(''), 'base64');
  invariant(createHash('sha256').update(archive).digest('hex') === ACCEPTED_P4.publicationArchiveSha256
      && gitBlobSha(archive) === ACCEPTED_P4.publicationArchiveBlobSha
      && compactReceipt.publicationArchive.archiveSha256 === ACCEPTED_P4.publicationArchiveSha256,
    'P4 accepted publication archive SHA-256 mismatch');
  const payloadRaw = gunzipSync(archive);
  invariant(payloadRaw.byteLength === compactReceipt.publicationArchive.payloadByteLength
      && createHash('sha256').update(payloadRaw).digest('hex') === ACCEPTED_P4.publicationPayloadSha256
      && compactReceipt.publicationArchive.payloadSha256 === ACCEPTED_P4.publicationPayloadSha256
      && compactReceipt.publicationArchive.payloadByteLength === ACCEPTED_P4.publicationPayloadByteLength,
  'P4 accepted publication archive payload digest mismatch');
  const payloadText = payloadRaw.toString('utf8');
  const payload = JSON.parse(payloadText);
  invariant(`${canonicalStringify(payload)}
` === payloadText,
    'P4 accepted publication archive payload is not canonical JSON');
  const receipt = { ...compactReceipt, publication: payload.publication, store: payload.store };
  verifyAcceptedP4({ receipt, compactReceipt, receiptRaw, evidence, evidenceRaw });
  return Object.freeze({ receiptRaw, evidenceRaw, receipt, evidence,
    identity: productIdentity(receipt) });
}
