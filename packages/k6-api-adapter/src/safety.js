import {
  assertNoExecutableMaterial,
  assertNoPlaceholderData,
  assertNoSensitiveExecutionData,
} from '@kdtp/execution-contract';

export function assertK6ApiCompilationSafe(value, path = '$') {
  assertNoSensitiveExecutionData(value, path);
  assertNoExecutableMaterial(value, path);
  assertNoPlaceholderData(value, path);
}
