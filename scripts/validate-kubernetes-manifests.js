import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_DEPLOYMENT_DIRECTORY = resolve(
  scriptDirectory,
  '../deploy/kubernetes/read-only-governance-service',
);
const IMMUTABLE_IMAGE = 'ghcr.io/akaryc1b/knowledge-driven-test-platform/read-only-governance-service@sha256:9ea3d4ac1ece9aa3d47c658a0781e15ce9eafdfc56a20eb041251298b465ab13';

export async function validateKubernetesManifests(directory = DEFAULT_DEPLOYMENT_DIRECTORY) {
  const resources = Object.fromEntries(await Promise.all([
    ['deployment', 'deployment.yaml'],
    ['service', 'service.yaml'],
    ['configMap', 'configmap.yaml'],
    ['serviceAccount', 'serviceaccount.yaml'],
    ['pdb', 'pdb.yaml'],
    ['secretExample', 'secret.example.yaml'],
    ['kustomization', 'kustomization.yaml'],
  ].map(async ([key, file]) => [key, await readJsonYaml(join(directory, file))])));

  validateIdentity(resources);
  validateDeployment(resources.deployment, resources.configMap);
  validateService(resources.service, resources.deployment);
  validateServiceAccount(resources.serviceAccount, resources.deployment);
  validatePdb(resources.pdb, resources.deployment);
  validateSecretContract(resources.secretExample, resources.deployment);
  validateKustomization(resources.kustomization);

  return {
    resources: 7,
    deployment: resources.deployment.metadata.name,
    namespace: resources.deployment.metadata.namespace,
    replicas: resources.deployment.spec.replicas,
  };
}

async function readJsonYaml(path) {
  const content = await readFile(path, 'utf8');
  invariant(content.endsWith('\n'), `${path} must end with a newline`);
  try { return JSON.parse(content); } catch (error) {
    throw new Error(`${path} must use JSON-compatible YAML: ${error.message}`);
  }
}

function validateIdentity(resources) {
  const namespaced = [
    resources.deployment,
    resources.service,
    resources.configMap,
    resources.serviceAccount,
    resources.pdb,
    resources.secretExample,
  ];
  invariant(namespaced.every((resource) => resource?.metadata?.namespace === 'kdtp-system'),
    'All deployment resources must use namespace kdtp-system');
  invariant(resources.deployment.apiVersion === 'apps/v1' && resources.deployment.kind === 'Deployment',
    'Deployment identity is invalid');
  invariant(resources.service.apiVersion === 'v1' && resources.service.kind === 'Service',
    'Service identity is invalid');
  invariant(resources.pdb.apiVersion === 'policy/v1' && resources.pdb.kind === 'PodDisruptionBudget',
    'PDB identity is invalid');
}

function validateDeployment(deployment, configMap) {
  const spec = deployment.spec;
  const podSpec = spec.template.spec;
  const container = exactlyOne(podSpec.containers, 'Deployment must contain exactly one container');
  const labels = spec.selector.matchLabels;

  invariant(Number.isSafeInteger(spec.replicas) && spec.replicas >= 2,
    'Deployment must run at least two replicas');
  invariant(spec.strategy?.type === 'RollingUpdate' &&
    spec.strategy.rollingUpdate?.maxUnavailable === 0 &&
    spec.strategy.rollingUpdate?.maxSurge === 1,
  'RollingUpdate must use maxUnavailable=0 and maxSurge=1');
  invariant(Number.isSafeInteger(spec.minReadySeconds) && spec.minReadySeconds >= 10,
    'Deployment minReadySeconds must be at least 10');
  invariant(JSON.stringify(labels) === JSON.stringify(spec.template.metadata.labels),
    'Deployment selector and pod labels must match exactly');

  invariant(podSpec.automountServiceAccountToken === false,
    'Pod must disable automatic ServiceAccount token mounting');
  invariant(podSpec.terminationGracePeriodSeconds >= 30,
    'Pod terminationGracePeriodSeconds must be at least 30');
  invariant(podSpec.securityContext?.runAsNonRoot === true &&
    podSpec.securityContext?.seccompProfile?.type === 'RuntimeDefault',
  'Pod security context must require non-root and RuntimeDefault seccomp');

  invariant(container.image === IMMUTABLE_IMAGE,
    'Container image must match the governed immutable Registry digest');
  invariant(/^ghcr\.io\/akaryc1b\/knowledge-driven-test-platform\/read-only-governance-service@sha256:[a-f0-9]{64}$/.test(container.image),
    'Container image must use a complete immutable GHCR digest reference');
  invariant(container.imagePullPolicy === 'IfNotPresent',
    'Immutable digest image must use IfNotPresent');
  invariant(container.securityContext?.allowPrivilegeEscalation === false &&
    container.securityContext?.readOnlyRootFilesystem === true &&
    container.securityContext?.runAsNonRoot === true,
  'Container must disable privilege escalation and use a read-only root filesystem');
  invariant(container.securityContext?.capabilities?.drop?.includes('ALL'),
    'Container must drop all Linux capabilities');

  assertProbe(container.startupProbe, '/live', 'startup');
  assertProbe(container.livenessProbe, '/live', 'liveness');
  assertProbe(container.readinessProbe, '/ready', 'readiness');
  invariant(container.resources?.requests?.cpu && container.resources?.requests?.memory &&
    container.resources?.limits?.cpu && container.resources?.limits?.memory,
  'Container CPU and memory requests/limits are required');

  const envNames = new Set((container.envFrom ?? []).map((entry) =>
    entry.configMapRef?.name ?? entry.secretRef?.name));
  invariant(envNames.has('kdtp-read-only-governance-config') &&
    envNames.has('kdtp-read-only-governance-secrets'),
  'Deployment must consume the expected ConfigMap and Secret');
  invariant(configMap.data?.KDTP_HTTP_PORT === '8080' && configMap.data?.KDTP_HTTP_HOST === '0.0.0.0',
    'ConfigMap HTTP binding must match the container port');
  const shutdownMs = Number(configMap.data?.KDTP_SHUTDOWN_TIMEOUT_MS);
  invariant(Number.isSafeInteger(shutdownMs) && podSpec.terminationGracePeriodSeconds * 1000 >= shutdownMs + 5000,
    'Termination grace period must exceed application shutdown timeout by at least five seconds');

  const tmpMount = (container.volumeMounts ?? []).find((item) => item.mountPath === '/tmp');
  const tmpVolume = (podSpec.volumes ?? []).find((item) => item.name === tmpMount?.name);
  invariant(tmpMount && tmpVolume?.emptyDir?.sizeLimit,
    'Read-only root filesystem requires a bounded writable /tmp emptyDir');
}

function validateService(service, deployment) {
  invariant(service.spec?.type === 'ClusterIP', 'Service must remain internal ClusterIP');
  invariant(JSON.stringify(service.spec?.selector) === JSON.stringify(deployment.spec.selector.matchLabels),
    'Service selector must match Deployment labels');
  const port = exactlyOne(service.spec?.ports, 'Service must expose exactly one port');
  invariant(port.port === 80 && port.targetPort === 'http',
    'Service must map port 80 to the named http container port');
}

function validateServiceAccount(serviceAccount, deployment) {
  invariant(serviceAccount.automountServiceAccountToken === false,
    'ServiceAccount must disable token automount');
  invariant(deployment.spec.template.spec.serviceAccountName === serviceAccount.metadata.name,
    'Deployment must use the dedicated ServiceAccount');
}

function validatePdb(pdb, deployment) {
  invariant(pdb.spec?.minAvailable === 1,
    'PDB must keep at least one replica available');
  invariant(JSON.stringify(pdb.spec?.selector?.matchLabels) ===
    JSON.stringify(deployment.spec.selector.matchLabels),
  'PDB selector must match Deployment labels');
}

function validateSecretContract(secret, deployment) {
  invariant(secret.kind === 'Secret' && secret.type === 'Opaque',
    'Secret example must be an Opaque Secret');
  const values = secret.stringData ?? {};
  invariant(typeof values.KDTP_DATABASE_URL === 'string' &&
    typeof values.KDTP_OIDC_SUBJECT_MAPPINGS_JSON === 'string',
  'Secret example must declare database URL and OIDC subject mappings');
  invariant(JSON.stringify(secret).includes('replace'),
    'Secret example must use explicit non-production placeholders');
  const referenced = deployment.spec.template.spec.containers[0].envFrom
    .some((entry) => entry.secretRef?.name === secret.metadata.name);
  invariant(referenced, 'Deployment Secret reference must match the documented Secret contract');
}

function validateKustomization(kustomization) {
  invariant(kustomization.kind === 'Kustomization', 'Kustomization identity is invalid');
  const resources = kustomization.resources ?? [];
  for (const required of [
    'serviceaccount.yaml',
    'configmap.yaml',
    'deployment.yaml',
    'service.yaml',
    'pdb.yaml',
  ]) invariant(resources.includes(required), `Kustomization is missing ${required}`);
  invariant(!resources.includes('secret.example.yaml'),
    'Example Secret must never be applied by the default Kustomization');
}

function assertProbe(probe, path, name) {
  invariant(probe?.httpGet?.path === path && probe.httpGet.port === 'http',
    `${name} probe must use ${path} on the named http port`);
  invariant(Number.isSafeInteger(probe.timeoutSeconds) && probe.timeoutSeconds > 0,
    `${name} probe timeout must be positive`);
}

function exactlyOne(input, message) {
  invariant(Array.isArray(input) && input.length === 1, message);
  return input[0];
}

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const result = await validateKubernetesManifests();
  process.stdout.write(`${JSON.stringify(result)}\n`);
}
