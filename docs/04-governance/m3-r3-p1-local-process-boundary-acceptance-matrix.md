# M3-R3-P1 Local Process Boundary Acceptance Matrix

| Control | Permanent proof | Required result |
| --- | --- | --- |
| Exact R0 baseline | fixed main, PR, Run, Artifact and four product digests | exact match |
| Port contract | closed Draft 2020-12 Schema and deterministic descriptor | injected/non-executing |
| Launch Specification | fixed executable, argv array, logical cwd, deny-by-default environment | no widening |
| Port delegation | fake/in-memory port called exactly once with frozen defensive copy | accepted receipt only |
| Receipt binding | port and specification digests | exact match |
| Negative security | executable, argv, shell, path, environment, stdin and digest tampering | fail closed |
| Execution primitive gate | source and Workflow scan | no prohibited primitive |
| Repository Validator | root `npm run validate` and dedicated validator | success |
| Permanent CI | PR and natural `push -> main` triggers | completed/success |
| Artifact | 90-day Evidence, Schemas, logs and docs | present/non-expired |
| Sensitive-material scan | every upload candidate | zero matches |

## Required decision

```text
localProcessPortContractReady=true
launchSpecificationReady=true
launchAdapterBoundaryReady=true
nodeProcessAdapterImplemented=false
processStarted=false
processIdCreated=false
k6Invoked=false
externalProcessExecuted=false
shellUsed=false
repositoryBlockers=[]
nextRequiredSlice=M3-R3-P2
```

The P1 Pull Request must remain Draft/Open/Unmerged. Ready and merge transitions require a later authorization naming the PR and its exact 40-character Head SHA.
