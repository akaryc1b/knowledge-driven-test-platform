# M3-R4-P3 — Bounded Sealed-Root Result Collector

## Scope

M3-R4-P3 adds a deterministic fake-only injected collector on top of the
accepted P2 logical allocation and artifact handle. It models logical sealing,
exact artifact inspection, transient byte delivery and bounded UTF-8/JSON
verification.

## Delivered behavior

```text
logicalRootSealSupported=true
logicalRootSealed=true
exactArtifactInspectionSupported=true
exactArtifactInspected=true
transientPayloadVerificationSupported=true
boundedJsonResultCollected=true
currentState=COLLECTED
artifactKind=k6-run-summary-json
artifactPath=outputs/summary.json
rawPayloadIncluded=false
rawPayloadPersisted=false
```

## Security boundary

```text
realFilesystemCollectorImplemented=false
realDirectoryCreated=false
realFilesystemAccessed=false
realHostFileOpened=false
realHostFileRead=false
realHostFileWritten=false
hostPathIncluded=false
callerPathAccepted=false
recursiveDiscoveryPerformed=false
symbolicLinkFollowed=false
hardLinkTrusted=false
specialFileAccepted=false
sourceBundleMutated=false
```

P3 is not a production host filesystem collector. P4 remains responsible for
fault, race, platform and compatibility acceptance before any concrete adapter
can be considered.

## Compatibility

Node.js 22 is the baseline. Node.js 24 is used only for fake-only canonical
product comparison. No k6 process, target network, database or Secret is used.
