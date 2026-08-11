# M3-R4-R0 Governed Output Root — Threat Model

## Assets

- immutable M3-R3 Source Bundle identity and publication Evidence;
- exact Runtime Policy, Admission Request, Invocation Plan and lifecycle identities;
- a future execution-scoped writable root identity;
- future allow-listed result files and their canonical digests;
- sanitized Runtime Result and immutable aggregate Evidence;
- host filesystem confidentiality and integrity.

## Trust boundaries

The caller, generated source and child process are untrusted with respect to host paths. A future output-root allocator is a private platform component. Public contracts may carry logical identities, relative artifact descriptors, limits and digests, but never an absolute host path. R0 adds no allocator, filesystem port, directory, reader or collector.

## Threats and required controls

### Caller-controlled root

**Threat:** a caller points collection at a repository, home directory, credential directory or another execution's root.

**Required control:** platform-owned allocation; no caller-provided root path; exact execution binding; closed contracts.

### Traversal and path syntax confusion

**Threat:** `..`, absolute paths, drive letters, URI-like prefixes, backslashes, NUL bytes, Unicode normalization or case folding escape the intended root or collide.

**Required control:** one canonical relative-path grammar; normalization before comparison; collision detection; fail-closed mutation tests.

### Symlink, hard-link and special-file substitution

**Threat:** an allow-listed name resolves to a link, device, FIFO, socket or aliased object.

**Required control:** regular-file-only policy; explicit alias policy; handle/object identity checks; no follow-by-default semantics; bounded operations.

### Time-of-check/time-of-use replacement

**Threat:** an object passes validation and is replaced before read or digesting.

**Required control:** bind validation, read and digest to the same trusted object or handle; deterministic replacement-race tests.

### Source Bundle mutation

**Threat:** `outputs/summary.json` is written beneath the content-addressed immutable Source Bundle root.

**Required control:** separate root role and identity; bundle digest stability; no silent working-directory or publication-contract change.

### Stale or cross-execution result replay

**Threat:** valid output from a previous execution is presented as current.

**Required control:** root identity binds exact invocation, admission and execution identities; sealed lifecycle; substitution rejection.

### Partial-write promotion

**Threat:** collection reads a file while the child process is still writing or after termination is unconfirmed.

**Required control:** explicit create, launch, terminal, seal, collect and cleanup states; collection only from a sealed root.

### Resource exhaustion

**Threat:** excessive file count, file size, aggregate size, parser depth or read time exhausts the service.

**Required control:** closed numeric limits, one-over-limit tests, bounded parsers and deterministic timeouts.

### Unexpected recursive disclosure

**Threat:** recursive walking captures logs, temporary files or credentials not declared by the contract.

**Required control:** exact artifact descriptor allow-list; no unrestricted recursive scan; unexpected entries fail closed.

### Host path and sensitive material disclosure

**Threat:** absolute paths, environment values, credentials, raw stdout, raw stderr or raw exceptions enter public Evidence.

**Required control:** path-independent logical identity; digest and enum-only public records; closed Schema; sensitive-value scan.

### Cleanup and retention races

**Threat:** cleanup deletes evidence before collection, or retained roots leak data indefinitely.

**Required control:** explicit retention outcome, idempotent cleanup and ordering tests. R0 does not choose a production retention duration.

### CI boundary escalation

**Threat:** contract acceptance creates real directories, starts k6, reads arbitrary host files, accesses network, database, Secrets, containers or Kubernetes.

**Required control:** R0 static boundary tests only; later effectful slices require separate authorization and remain fake-first.

## Residual risks

- R0 does not prove an operating-system-specific safe-open strategy.
- Hard-link and filesystem identity behavior requires a later platform-specific decision.
- Retention duration and crash recovery are intentionally unresolved.
- No file result is collected in R0; useful k6 summary ingestion remains deferred.

## Security decision

```text
threatModelFrozen=true
newRuntimeCapabilityAdded=false
governedOutputRootDefined=false
governedOutputRootImplemented=false
outputDirectoryCreated=false
fileResultCollectionImplemented=false
callerPathAccepted=false
arbitraryFileReadEnabled=false
sourceBundleRemainsImmutable=true
securityDashboardsEnumerable=false
zeroAlertClaimMade=false
nextRequiredSlice=M3-R4-R0
```
