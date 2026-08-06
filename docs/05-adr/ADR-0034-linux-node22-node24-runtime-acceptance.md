# ADR-0034 — Linux Runtime Acceptance with Node.js 22 Baseline and Node.js 24 Compatibility

## Status

Accepted by M3-R3-P4 acceptance evidence. This ADR does not authorize a new execution capability.

## Context

The runtime Adapter uses POSIX signals, filesystem realpath semantics and a shell-free Node child-process boundary. The repository declares ESM and `node >=22`. Prior slices established runtime behavior but did not formally state a cross-Node compatibility contract or claim support for operating systems not directly proven by permanent acceptance.

GitHub Actions may internally use a different Node version to execute an Action. That implementation detail is not project compatibility evidence.

## Decision

1. Node.js 22 remains the formal project baseline.
2. Node.js 24 is a permanent fake-only compatibility target.
3. Both versions execute the same compatibility fixture and must emit the same canonical product digest.
4. A digest difference fails closed; the Workflow does not accept separate unexplained products.
5. Formal runtime platform compatibility is limited to Linux.
6. `windowsHide=true` does not establish Windows support.
7. macOS and Windows remain unclaimed until independent platform-specific evidence exists.
8. Compatibility testing must not start a real governed process or invoke k6.

```text
nodeEngine=>=22
node22Baseline=true
node24Compatibility=true
platformCompatibility=linux
windowsCompatibilityClaimed=false
macosCompatibilityClaimed=false
realProcessStartedInCi=false
newRuntimeCapabilityAdded=false
```

## Consequences

- Node 22 cannot be removed merely because Node 24 passes.
- Production code cannot adopt Node 24-only APIs while the declared baseline remains Node 22.
- Public exports, accepted Schema identities, terminal classifications and file-result deferral are part of the compatibility acceptance.
- Linux is the only platform represented by the permanent runtime acceptance claim.
- A later platform expansion requires new evidence and a separate decision.

## Non-goals

This ADR does not authorize remote execution, distributed Workers, Queues, Schedulers, containers, Kubernetes jobs, a governed output root, file-result collection, Allure or UI work.
