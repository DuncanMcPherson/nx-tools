import {
  createProjectGraphAsync,
  formatFiles,
  generateFiles,
  joinPathFragments,
  ProjectConfiguration,
  readProjectsConfigurationFromProjectGraph,
  Tree,
} from '@nx/devkit';
import { join } from 'path';

export default async function update(host: Tree) {
  const graph = await createProjectGraphAsync();
  const projects = readProjectsConfigurationFromProjectGraph(graph).projects;
  if (allProjectsMigrated(projects, host)) {
    return;
  }

  configureProjects(projects, host);
  await formatFiles(host);
}

type ProjectConfigurations = { [key: string]: ProjectConfiguration };

function allProjectsMigrated(
  projects: ProjectConfigurations,
  tree: Tree
): boolean {
  for (const [, configuration] of Object.entries(projects)) {
    if (configuration.projectType !== 'application') {
      continue;
    }

    const hasFirebaseJson = tree.exists(
      joinPathFragments(configuration.root, 'firebase.json')
    );
    if (hasFirebaseJson) {
      const hasNxFirebaseJson = tree.exists(
        joinPathFragments(configuration.root, 'nx-firebase.json')
      );
      if (!hasNxFirebaseJson) {
        return false;
      }
    }
  }

  return true;
}

function configureProjects(projects: ProjectConfigurations, host: Tree) {
  Object.entries(projects)
    .filter(([, configuration]) => configuration.projectType === 'application')
    .forEach(([name, configuration]) => {
      const firebasePath = joinPathFragments(
        configuration.root,
        'firebase.json'
      );
      const nxFirebasePath = joinPathFragments(
        configuration.root,
        'nx-firebase.json'
      );

      if (!host.exists(firebasePath) || host.exists(nxFirebasePath)) {
        return;
      }

      let target: string | undefined = configuration.targets?.['serve']
        ? 'serve'
        : undefined;
      if (!target) {
        target = Object.keys(configuration.targets).find((key) =>
          key.toLowerCase().includes('serve')
        );
      }

      if (target) {
        generateFiles(host, join(__dirname, 'files'), configuration.root, {
          project: name,
          target,
        });
      }
    });
}
