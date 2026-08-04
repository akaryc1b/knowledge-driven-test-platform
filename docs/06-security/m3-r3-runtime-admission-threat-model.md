# M3-R3-R0 Runtime Admission Threat Model

## Protected assets

- accepted Execution Request identity and context;
- immutable M3-R1 Spec and Compilation Evidence;
- immutable M3-R2 Source Bundle, Receipt and Publication Evidence;
- Runtime Policy ceilings and allow-lists;
- deterministic Invocation Plan and Admission Evidence;
- the non-execution decision.

## Threats and controls

### Execution Request substitution

An attacker could present an approved Source Bundle with a different project, environment, plan or Adapter request.

**Control:** the Admission Request validates Spec context and Compilation Evidence against the exact Execution Request digest and Adapter descriptor digest.

### Source or provenance substitution

An attacker could replace Source bytes, Bundle metadata, Receipt or Publication Evidence.

**Control:** existing M3-R2 integrity validators replay the accepted P3 trust anchor and verify Bundle, Manifest, Source Artifact, validation Evidence, Receipt and Publication Evidence digests.

### Shell injection

An attacker could place metacharacters or multiple commands in a runtime command.

**Control:** R0 never stores a command string. It creates a closed argv array, forbids shell use and rejects `;`, `&`, pipes, redirection, backticks, dollar expansion and line breaks.

### Binary or subcommand substitution

An attacker could replace `k6`, change `run` or authorize another execution mode.

**Control:** Runtime Policy fixes runtime ID/version, executable label, subcommand, execution mode and `ADMISSION_ONLY` implementation status.

### Resource exhaustion

An attacker could request unbounded VUs, iterations or runtime.

**Control:** fixed ceilings are 50 VUs, 10,000 iterations, 900,000 ms duration and 30,000 ms graceful stop. Values are safe integers and durations use whole seconds.

### Environment or Secret leakage

An attacker could provide arbitrary environment names or values.

**Control:** R0 permits only the names `K6_LOG_FORMAT` and `K6_NO_COLOR`. No values, Secret references, Authorization headers, cookies or credential files are represented.

### Mutable or escaping paths

An attacker could reference an absolute or traversal path.

**Control:** the Source is identified by content-addressed logical URI and fixed relative path `source/main.js`. Materialization is deferred to a future server-owned boundary.

### Evidence forgery

An attacker could change a decision or safety claim and recompute unrelated fields.

**Control:** Admission Request, Invocation Plan and Evidence each have independent canonical digests; validators reconstruct expected objects from immutable predecessors.

## R0 attack surface exclusions

R0 imports no `child_process`, shell, Worker, VM, HTTP client or Kubernetes execution API. It does not install or discover k6, create directories, access a target or collect a result.

```text
M3-R3-R0
executionImplementationStarted=false
sourceExecuted=false
executionRuntimeStarted=false
k6Invoked=false
xk6Invoked=false
playwrightInvoked=false
externalProcessExecuted=false
shellUsed=false
targetNetworkAccessed=false
databaseAccessed=false
secretAccessed=false
filesystemCredentialAccessed=false
runtimeResultCollected=false
repositoryBlockers=[]
nextRequiredSlice=M3-R3-P1
```
