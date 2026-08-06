# M3-R3-P4-P2 Adversarial Security Acceptance

## Scope

P2 tests the already accepted local Node process boundary against process-primitive, command, identity, environment, path, digest and information-leakage attacks. It adds no new runtime capability.

```text
p4Issue=67
p4Pr=68
p2ProductCapabilityAdded=false
realProcessStartedInCi=false
processIdCreatedInCi=false
signalSentInCi=false
externalProcessExecutedInCi=false
```

## Process and command boundary

The acceptance suite proves that the only production process primitive remains the dedicated adapter's `node:child_process.spawn`, with one spawn call site, fixed `k6` executable, argv array, `shell=false`, `detached=false` and ignored stdio. It rejects alternative descriptors, executable replacement, shell fragments, command substitution, unknown/repeated flags, output-path arguments and signal expansion.

## Adapter and digest identity

Copied or unregistered adapter objects are rejected by module-private `WeakMap` identity before spawn. Unsupported adapter options are rejected. A predecessor chain whose identities and command digest are fully recomputed is still rejected against the accepted P1 bindings.

## Environment and sensitive-material boundary

Only adapter-owned fixed values are supplied. Host `process.env` is not inherited. Errors containing Secret, stack and credential-shaped fixture markers are sanitized before public Evidence. Public products reject `stdout`, `stderr`, numeric `pid`, raw `stack`, Authorization/Bearer/JWT/Cookie/database/cloud/SSH/private-key and raw-secret material.

## Filesystem and path boundary

The executable tests require rejection before spawn for:

- relative traversal;
- Windows drive and UNC paths;
- URI paths;
- actual NUL characters;
- percent-encoded traversal;
- backslash traversal;
- symlink resolution;
- non-directory/special-file resolution;
- caller-provided output paths.

These tests are intentionally committed before any source correction. A natural failure is preserved and classified before a minimal R0-P3 behavior fix is allowed.

## Preserved decisions

```text
sourceBundleRemainsImmutable=true
governedOutputRootDefined=false
governedOutputRootImplemented=false
fileResultCollectionSupported=false
fileResultCollectionImplemented=false
callerPathAccepted=false
arbitraryFileReadEnabled=false
rawRuntimeOutputCollected=false
stdoutCollected=false
stderrCollected=false
numericProcessIdExposed=false
```

## Slice gate

P3 may begin only after the adversarial suite and all natural Pull Request workflows pass on one exact Head, all product or test findings are closed through new commits, and no actionable review thread remains. P2 does not authorize Ready, merge or M3-R3-G1.
