# M3-R3-P2 Bounded Process Lifecycle Acceptance Matrix

| Area | Acceptance condition | Permanent evidence |
| --- | --- | --- |
| Predecessor | Exact P1 main SHA, PR Head, Run, Job, Artifact and corrected digests are pinned | P2 baseline and Repository Validator |
| Process primitive | Production module imports only `spawn` from `node:child_process` | Static Repository Validator and negative tests |
| Governed entry | Adapter executor is private and cannot be invoked by an unregistered copied descriptor | WeakMap registration test |
| Command | Exact `k6` argv structure, logical Source Bundle, fixed environment digest and lifecycle bounds | Command Schema and tamper tests |
| Filesystem | Resolver returns a normalized absolute real directory; no directory is created | Resolver and symlink rejection tests |
| Environment | Only adapter-owned values for approved names; no host inheritance | Spawn-option assertions and digest validation |
| Start | Missing spawn acknowledgement is bounded and force-killed | Startup-timeout tests |
| Timeout | Runtime timeout requests `SIGINT` before `SIGKILL` | Fake clock and signal tests |
| Cancellation | Pre-start and post-start abort races settle once | Abort and race tests |
| Privacy | Numeric PID, output, raw errors, stack traces and host paths are absent | Sanitization and Evidence tests |
| CI | No real process, k6, signal, target, database or Secret access | Static acceptance Evidence |
| Compatibility | P1, R0, M3-R2, M3-R1, M3-R0 and M2 validators remain successful | Permanent Workflow |

```text
nodeProcessAdapterImplemented=true
boundedLifecycleImplemented=true
realProcessStartedInCi=false
runtimeResultCollected=false
nextRequiredSlice=M3-R3-P3
```
