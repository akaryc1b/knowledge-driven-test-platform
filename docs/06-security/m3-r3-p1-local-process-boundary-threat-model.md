# M3-R3-P1 Local Process Boundary Threat Model

## Assets

- accepted M3-R3-R0 Runtime Policy, Admission Request, Invocation Plan and Admission Evidence digests;
- immutable Source Bundle identity;
- fixed executable and argv semantics;
- deny-by-default environment and logical working-directory boundary;
- non-execution safety claims.

## Threats and controls

1. **Executable substitution** — executable is the constant `k6` and is revalidated.
2. **Shell injection** — argv must remain an array and rejects `;`, `&&`, pipes, backticks, `$()`, redirection, newlines and NUL.
3. **Shell escalation** — `shell=false` is fixed in code and Schema.
4. **Host path escape** — no absolute path field exists; only the logical immutable-bundle root identifier is accepted.
5. **Environment exfiltration** — only approved names are represented; values and full host inheritance are forbidden.
6. **stdin injection** — stdin mode is disabled and no content field is permitted.
7. **Predecessor drift** — all four R0 product digests are exact bindings.
8. **Port forgery** — receipt must bind the fixed port and Launch Specification digests.
9. **False execution claim** — process, PID, k6 and external-execution receipt fields must all remain false.
10. **Primitive bypass** — Repository Validator rejects process, VM, worker, shell and runtime invocation primitives in production code and Workflow.
11. **CI weakening** — permanent Workflow requires PR and natural `push -> main`, read-only permissions, locked installation and 90-day Evidence.

## Residual boundary

P1 does not contain a real host adapter and therefore cannot execute a process. P2 remains frozen.

```text
nodeProcessAdapterImplemented=false
processStarted=false
processIdCreated=false
k6Invoked=false
externalProcessExecuted=false
targetNetworkAccessed=false
databaseAccessed=false
secretAccessed=false
repositoryBlockers=[]
nextRequiredSlice=M3-R3-P2
```
