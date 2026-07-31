export class K6ApiCompilerError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'K6ApiCompilerError';
    this.code = code;
    this.details = details;
  }
}

export function compilerInvariant(condition, code, message, details = {}) {
  if (!condition) throw new K6ApiCompilerError(code, message, details);
}

export class K6ApiSourceContractError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'K6ApiSourceContractError';
    this.code = code;
    this.details = details;
  }
}

export function sourceContractInvariant(condition, code, message, details = {}) {
  if (!condition) throw new K6ApiSourceContractError(code, message, details);
}

export class K6ApiSourceRendererError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'K6ApiSourceRendererError';
    this.code = code;
    this.details = details;
  }
}

export function sourceRendererInvariant(condition, code, message, details = {}) {
  if (!condition) throw new K6ApiSourceRendererError(code, message, details);
}
