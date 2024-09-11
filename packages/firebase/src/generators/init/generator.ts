import {
  createProjectGraphAsync,
  ProjectConfiguration,
  ProjectGraph,
  readNxJson,
  readProjectsConfigurationFromProjectGraph,
  Tree,
} from '@nx/devkit';
import { addPlugin } from '@nx/devkit/src/utils/add-plugin';
import { createNodesV2 } from '../../targets';

export async function initGenerator(tree: Tree) {
  const nxJson = readNxJson(tree);
  const addPlugins =
    process.env.NX_ADD_PLUGINS !== 'false' &&
    nxJson.useInferencePlugins !== false;
  const graph = await createProjectGraphAsync({ exitOnError: true });

  if (addPlugins) {
    await addFirebasePlugin(tree, graph, true);
  }

  const projects = readProjectsConfigurationFromProjectGraph(graph).projects;
  await generateConfigurationFiles(tree, projects);
}

async function addFirebasePlugin(
  tree: Tree,
  graph: ProjectGraph,
  updatePackageScripts: boolean
) {
  return addPlugin(
    tree,
    graph,
    '@nxextensions/firebase',
    createNodesV2,
    {
      serveTargetName: ['serve-firebase'],
      includeHosting: [false],
    },
    updatePackageScripts
  );
}

async function generateConfigurationFiles(
  tree: Tree,
  projects: { [key: string]: ProjectConfiguration }
): Promise<void> {
  Object.entries(projects).forEach(([name, configuration]) => {
    if (!hasFirebaseJson(configuration.root, tree)) {
      return;
    }
  });
}

export default initGenerator;
