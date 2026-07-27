import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

/** @param {string} projectDirectory */
export async function loadProjectInput(projectDirectory) {
  const manifest = await readJson(join(projectDirectory, 'project-manifest.json'));
  const domains = [];
  for (const domainId of [...manifest.domainPacks].sort()) {
    domains.push({
      id: domainId,
      rules: await readJson(join(projectDirectory, 'domains', domainId, 'rules.json')),
    });
  }

  return {
    context: {
      globalId: manifest.globalId,
      projectId: manifest.projectId,
      environmentId: manifest.environmentId,
      releaseId: manifest.releaseId,
      domainPacks: manifest.domainPacks,
    },
    layers: {
      global: await readJson(join(projectDirectory, 'global', 'rules.json')),
      domains,
      project: await readJson(join(projectDirectory, 'project', 'rules.json')),
      environment: await readJson(
        join(projectDirectory, 'environments', `${manifest.environmentId}.rules.json`),
      ),
      release: await readJson(
        join(projectDirectory, 'releases', `${manifest.releaseId}.rules.json`),
      ),
    },
  };
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}
