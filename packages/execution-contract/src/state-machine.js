import { executionInvariant } from './errors.js';
import { validateNonEmptyString, validateUtcTimestamp } from './identity.js';
import { EXECUTION_STATES, EXECUTION_TERMINAL_STATES } from './constants.js';
import {
  assertNoExecutableMaterial,
  assertNoPlaceholderData,
  assertNoSensitiveExecutionData,
} from './json.js';

const ALLOWED_TRANSITIONS = Object.freeze({
  PENDING: Object.freeze(['VALIDATED', 'REJECTED', 'CANCELLED']),
  VALIDATED: Object.freeze(['RUNNING', 'CANCELLED']),
  REJECTED: Object.freeze([]),
  RUNNING: Object.freeze(['CANCELLATION_REQUESTED', 'SUCCEEDED', 'FAILED', 'TIMED_OUT']),
  CANCELLATION_REQUESTED: Object.freeze(['CANCELLED', 'FAILED', 'TIMED_OUT']),
  SUCCEEDED: Object.freeze([]),
  FAILED: Object.freeze([]),
  CANCELLED: Object.freeze([]),
  TIMED_OUT: Object.freeze([]),
});

export function assertExecutionStateTransition(from, to) {
  validateState(from, 'from');
  validateState(to, 'to');
  executionInvariant(ALLOWED_TRANSITIONS[from].includes(to),
    'INVALID_EXECUTION_STATE_TRANSITION', `Execution state cannot transition from ${from} to ${to}`, {
      from,
      to,
    });
  return to;
}

export function validateExecutionStateHistory(input, expectedTerminalState) {
  executionInvariant(Array.isArray(input) && input.length >= 2 && input.length <= 100,
    'INVALID_EXECUTION_STATE_HISTORY', 'Execution state history must contain between 2 and 100 events');
  const history = input.map((event, index) => normalizeEvent(event, index));
  executionInvariant(history[0].state === 'PENDING',
    'INVALID_EXECUTION_STATE_HISTORY', 'Execution state history must begin with PENDING');
  for (let index = 1; index < history.length; index += 1) {
    assertExecutionStateTransition(history[index - 1].state, history[index].state);
    executionInvariant(Date.parse(history[index].at) >= Date.parse(history[index - 1].at),
      'INVALID_EXECUTION_STATE_HISTORY', 'Execution state history timestamps must be monotonic');
  }
  const terminal = history.at(-1).state;
  executionInvariant(EXECUTION_TERMINAL_STATES.includes(terminal),
    'INVALID_EXECUTION_STATE_HISTORY', 'Execution state history must end in a terminal state');
  if (expectedTerminalState !== undefined) {
    executionInvariant(terminal === expectedTerminalState,
      'EXECUTION_STATE_MISMATCH', 'Execution result state does not match state history', {
        expected: expectedTerminalState,
        actual: terminal,
      });
  }
  return history;
}

function normalizeEvent(event, index) {
  executionInvariant(event && typeof event === 'object' && !Array.isArray(event),
    'INVALID_EXECUTION_STATE_EVENT', 'Execution state event must be an object', { index });
  const keys = Object.keys(event).sort();
  const expected = event.reason === undefined ? ['at', 'state'] : ['at', 'reason', 'state'];
  executionInvariant(JSON.stringify(keys) === JSON.stringify(expected),
    'INVALID_EXECUTION_STATE_EVENT', 'Execution state event fields are invalid', { index });
  const normalized = {
    state: validateState(event.state, `history[${index}].state`),
    at: validateUtcTimestamp(event.at, `history[${index}].at`),
  };
  if (event.reason !== undefined) {
    normalized.reason = validateNonEmptyString(event.reason, `history[${index}].reason`, 256);
  }
  assertNoSensitiveExecutionData(normalized, `$.stateHistory[${index}]`);
  assertNoExecutableMaterial(normalized, `$.stateHistory[${index}]`);
  assertNoPlaceholderData(normalized, `$.stateHistory[${index}]`);
  return normalized;
}

function validateState(state, field) {
  executionInvariant(EXECUTION_STATES.includes(state),
    'INVALID_EXECUTION_STATE', `${field} is not a supported execution state`, { state });
  return state;
}
