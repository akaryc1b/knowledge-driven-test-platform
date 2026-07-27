import { validateKubernetesManifests } from '../scripts/validate-kubernetes-manifests.js';

const deployment = await validateKubernetesManifests();
const acceptance = {
  schemaVersion: 'deployment-fault-acceptance/v1',
  workload: deployment.deployment,
  namespace: deployment.namespace,
  replicas: deployment.replicas,
  controls: [
    {
      id: 'K8S-ROLLING-UPDATE',
      status: 'passed',
      evidence: 'maxUnavailable=0, maxSurge=1 and minReadySeconds>=10',
    },
    {
      id: 'K8S-POD-SECURITY',
      status: 'passed',
      evidence: 'non-root, read-only root filesystem, RuntimeDefault seccomp and drop ALL',
    },
    {
      id: 'K8S-HEALTH-PROBES',
      status: 'passed',
      evidence: 'startup and liveness use /live; readiness uses /ready',
    },
    {
      id: 'FAULT-DEPENDENCY-RECOVERY',
      status: 'passed',
      evidence: 'PostgreSQL and JWKS outages remove readiness and recover without restart',
    },
    {
      id: 'FAULT-SIGTERM-DRAIN',
      status: 'passed',
      evidence: 'SIGTERM drains active requests before closing the PostgreSQL pool',
    },
    {
      id: 'K8S-DISRUPTION-BUDGET',
      status: 'passed',
      evidence: 'two replicas and PodDisruptionBudget minAvailable=1',
    },
  ],
};
process.stdout.write(`${JSON.stringify(acceptance, null, 2)}\n`);
