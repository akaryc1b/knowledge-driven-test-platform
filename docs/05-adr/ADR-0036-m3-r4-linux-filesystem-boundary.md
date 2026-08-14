# ADR-0036 — M3-R4 Linux Filesystem Implementation Boundary

## Status

Accepted for P4 assessment; implementation is not authorized.

## Context

P3 verifies a transient payload supplied by an injected trusted port. It makes
no claim that a real host file was safely resolved, opened or read. A concrete
Linux adapter would introduce effects and object-identity risks not represented
by path strings or fake receipts.

## Decision

```text
slice=M3-R4-P4
issue=85
implementationStatus=ACCEPTANCE_ONLY
realFilesystemImplementationEvaluated=true
realFilesystemImplementationAuthorized=false
realFilesystemCollectorImplemented=false
platformCompatibility=linux-contract-baseline
windowsCompatibilityClaimed=false
macosCompatibilityClaimed=false
```

Any future Linux adapter requires a separate authorization and must satisfy all
of the following:

1. allocate a private platform-owned root outside the immutable Source Bundle;
2. reject all caller-provided absolute, relative, URI and environment-expanded
   host paths;
3. resolve only contract-declared root-relative components;
4. use no-follow semantics and reject symlinks or equivalent indirections;
5. accept regular files only and reject directories, devices, sockets and FIFOs;
6. validate and read through the same trusted handle;
7. compare stable object identity before and after a bounded read;
8. start collection only after the logical root is sealed;
9. enforce file, aggregate, count and duration limits while reading;
10. expose no public host path and persist no raw payload in Evidence.

## Consequences

P4 can accept the contract and adversarial fake behavior without weakening the
boundary. Linux implementation proof remains absent. Windows and macOS are not
claimed compatible because their path, handle and link semantics require
separate evidence.

```text
callerPathAccepted=false
absolutePathAccepted=false
hostPathIncluded=false
realHostFileOpened=false
realHostFileRead=false
realHostFileWritten=false
separateAuthorizationRequired=true
m3R4G1Started=false
nextRequiredSlice=M3-R4-G1
```
