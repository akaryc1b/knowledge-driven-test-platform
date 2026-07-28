import { createServer } from 'node:http';
import {
  HttpBoundaryError,
  normalizeHttpHeaders,
  resolveRequestId,
} from '@kdtp/governance-http';
import { mapTestPlanHttpBoundaryError } from './transport.js';

export function createReadOnlyTestPlanNodeHttpHandler({ transport }) {
  if (!transport || typeof transport.dispatch !== 'function') {
    throw new TypeError('transport.dispatch must be a function');
  }
  return async function readOnlyTestPlanNodeHttpHandler(request, response) {
    let requestId = null;
    try {
      const headers = normalizeHttpHeaders(request.headers);
      requestId = resolveRequestId(headers, transport.requestIdFactory);
      headers['x-request-id'] = requestId;
      const body = await readNodeBody(request, transport.maxBodyBytes);
      const result = await transport.dispatch({
        method: request.method,
        url: request.url,
        headers,
        body,
        remoteAddress: request.socket?.remoteAddress ?? null,
      });
      writeNodeResponse(response, result);
    } catch (error) {
      writeNodeResponse(response, mapTestPlanHttpBoundaryError(error, requestId));
    }
  };
}

export function createReadOnlyTestPlanNodeHttpServer(options) {
  return createServer(createReadOnlyTestPlanNodeHttpHandler(options));
}

async function readNodeBody(request, maxBytes) {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bytes += buffer.length;
    if (bytes > maxBytes) {
      throw new HttpBoundaryError('PAYLOAD_TOO_LARGE', 'Request body exceeds the read-only limit', 413, {
        maxBodyBytes: maxBytes,
        actualBodyBytes: bytes,
      });
    }
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}

function writeNodeResponse(response, result) {
  response.statusCode = result.status;
  for (const [name, value] of Object.entries(result.headers)) {
    if (value !== '') response.setHeader(name, value);
  }
  response.end(result.payload);
}
