import {
  addProjectConfiguration,
  createProjectGraphAsync,
  formatFiles,
  generateFiles,
  getWorkspaceLayout,
  installPackagesTask,
  joinPathFragments,
  offsetFromRoot,
  ProjectConfiguration,
  readProjectsConfigurationFromProjectGraph,
  Tree,
} from '@nx/devkit';
import chalk from 'chalk';
import * as path from 'path';
import { ConfigGeneratorSchema } from './schema';

export async function configGenerator(
  tree: Tree,
  options: ConfigGeneratorSchema
) {
  console.log(options);
  const targetProjects =
    typeof options.projects === 'string'
      ? options.projects.split(/[ ,]/)
      : options.projects;
  const projects = readProjectsConfigurationFromProjectGraph(
    await createProjectGraphAsync()
  ).projects;
  const filteredConfigs: ProjectConfiguration[] = [];
  for (const proj of targetProjects) {
    if (!projects[proj]) {
      throw new Error(`Unable to find project for ${proj}`);
    }
    filteredConfigs.push(projects[proj]);
  }

  generateFilesForSelectedProjects(filteredConfigs, tree);

  await formatFiles(tree);
  return () => {
    installPackagesTask(tree);
  };
}

function generateFilesForSelectedProjects(
  projects: ProjectConfiguration[],
  tree: Tree
) {
  for (const project of projects) {
    if (!hasFirebaseJson(project.root, tree)) {
      process.stdout.write(
        `No firebase configuration was found for project: ${
          project.name ?? project.root
        }`
      );
      continue;
    }

    const appsDir = getWorkspaceLayout(tree).appsDir;
    const newProjectName = `${project.name}-e2e`;
    if (newProjectName === '-e2e') {
      const message = chalk.red(
        `Warning! The project located at: ${project.root} has no defined name. Aborting generation for this project`
      );
      process.stdout.write(message);
      continue;
    }
    const newProjectDir = joinPathFragments(appsDir, newProjectName);
    const newProject: ProjectConfiguration = {
      root: newProjectDir,
      name: newProjectName,
      projectType: 'application',
      sourceRoot: joinPathFragments(newProjectDir, 'src'),
      implicitDependencies: [project.name],
    };
    addProjectConfiguration(tree, newProjectName, newProject);
    createInitialCypressConfig(tree, newProject);
  }
}

function hasFirebaseJson(projectRoot: string, tree: Tree): boolean {
  return tree.exists(joinPathFragments(projectRoot, 'firebase.json'));
}

function createInitialCypressConfig(
  tree: Tree,
  project: ProjectConfiguration
): void {
  const packageJsonOffsetFromRoot = offsetFromRoot(project.root);
}

export default configGenerator;
