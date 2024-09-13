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
  readJson,
  readProjectsConfigurationFromProjectGraph,
  targetToTargetString,
  Tree,
} from '@nx/devkit';
import { ConfigGeneratorSchema } from './schema';
import { getRelativePathToRootTsConfig } from '@nx/js';
import { join } from 'path';
import { installedCypressVersion } from '../../utils/cypress-version';
import { addDefaultE2eConfig } from '../../utils/config';

export interface NormalizedConfigGeneratorSchema {
  js?: boolean;
  jsx?: boolean;
  hasTsConfig?: boolean;
  offsetFromProjectRoot?: string;
  directory?: string;
  bundler?: 'vite' | 'webpack';
  baseUrl?: string;
}

export async function configGenerator(
  tree: Tree,
  options: ConfigGeneratorSchema
) {
  if (!options?.projects) {
    throw new Error(`Projects must be provided`);
  }
  const targetProjects = Array.isArray(options.projects)
    ? options.projects
    : options.projects.split(/[ ,]/);
  const projects = readProjectsConfigurationFromProjectGraph(
    await createProjectGraphAsync()
  ).projects;

  const filteredConfigs = targetProjects.map((proj) => {
    const projectConfig = projects[proj];
    if (!projectConfig) {
      throw new Error(
        `Unable to find project configuration for project: ${proj}`
      );
    }
    return projectConfig;
  });

  await Promise.all(
    filteredConfigs.map((config) =>
      generateFilesForSelectedProjects(config, tree, options)
    )
  );

  await formatFiles(tree);
  return () => {
    installPackagesTask(tree);
  };
}

function normalizeOptions(
  options: ConfigGeneratorSchema,
  tree: Tree,
  project: ProjectConfiguration
): NormalizedConfigGeneratorSchema {
  const opts: NormalizedConfigGeneratorSchema = {};

  opts.directory = options.directory ?? 'src';
  opts.js = options.useJavascript ?? false;
  opts.jsx = opts.js ?? false;

  const segmentCount = (opts.directory.match(/[\\/]/g) || []).length + 1;
  const offsetFromProjectRoot = Array.from(
    { length: segmentCount },
    () => '..'
  ).join('/');

  opts.hasTsConfig = tree.exists(
    joinPathFragments(project.root, 'tsconfig.json')
  );
  opts.bundler = options.bundler ?? 'webpack';
  opts.baseUrl = options.baseUrl ?? 'http://localhost:4200';
  opts.offsetFromProjectRoot = `${offsetFromProjectRoot}/`;
  return opts;
}

// to refactor
async function generateFilesForSelectedProjects(
  project: ProjectConfiguration,
  tree: Tree,
  options: ConfigGeneratorSchema
) {
  if (!hasFirebaseJson(project.root, tree)) {
    process.stdout.write(
      `No firebase configuration was found for project: ${
        project.name ?? project.root
      }. Skipping the project.\n`
    );
    return;
  }

  const appsDir = getWorkspaceLayout(tree).appsDir;
  const newProjectName = `${project.name ? project.name : ''}-e2e`;
  if (newProjectName === '-e2e') {
    const message = `Warning! The project located at: ${project.root} has no defined name. Aborting generation for this project`;

    process.stdout.write(message);
    return;
  }
  const newProjectDir = joinPathFragments(appsDir, newProjectName);
  if (tree.exists(newProjectDir)) {
    throw new Error(
      `An error occurred while creating the project: ${newProjectDir} already exists.`
    );
  }
  const newProject: ProjectConfiguration = {
    root: newProjectDir,
    name: newProjectName,
    projectType: 'application',
    sourceRoot: joinPathFragments(newProjectDir, 'src'),
    implicitDependencies: [project.name],
  };
  addProjectConfiguration(tree, newProjectName, newProject);
  const opts = normalizeOptions(options, tree, newProject);
  createInitialCypressConfig(tree, newProject, opts);
  await injectConfiguration(tree, project, newProject, opts);
}

function hasFirebaseJson(projectRoot: string, tree: Tree): boolean {
  return tree.exists(joinPathFragments(projectRoot, 'firebase.json'));
}

function createInitialCypressConfig(
  tree: Tree,
  project: ProjectConfiguration,
  options: NormalizedConfigGeneratorSchema
): void {
  const templateVars = {
    ...options,
    offsetFromRoot: offsetFromRoot(project.root),
    offsetFromProjectRoot: options.hasTsConfig
      ? options.offsetFromProjectRoot
      : '',
    tsConfigPath: options.hasTsConfig
      ? `${options.offsetFromProjectRoot}tsconfig.json`
      : getRelativePathToRootTsConfig(tree, project.root),
    ext: '',
  };
  generateFiles(
    tree,
    join(__dirname, 'files/common'),
    project.root,
    templateVars
  );

  if (options.js) {
    if (isEsmProject(tree, project.root)) {
      generateFiles(
        tree,
        join(__dirname, 'files/config-js-esm'),
        project.root,
        templateVars
      );
    } else {
      generateFiles(
        tree,
        join(__dirname, 'files/config-js-cjs'),
        project.root,
        templateVars
      );
    }
  } else {
    generateFiles(
      tree,
      join(__dirname, 'files/config-ts'),
      project.root,
      templateVars
    );
  }
}

function isEsmProject(tree: Tree, projectRoot: string): boolean {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let packageJson: any;
  if (tree.exists(joinPathFragments(projectRoot, 'package.json'))) {
    packageJson = readJson(
      tree,
      joinPathFragments(projectRoot, 'package.json')
    );
  } else {
    packageJson = readJson(tree, 'package.json');
  }
  return packageJson.type === 'module';
}

async function injectConfiguration(
  tree: Tree,
  projectConfig: ProjectConfiguration,
  e2eProjectConfig: ProjectConfiguration,
  options: NormalizedConfigGeneratorSchema
) {
  const serveTarget = projectConfig.targets?.['serve'];
  if (!serveTarget) {
    process.stdout.write(
      `The current project: ${projectConfig.name} does not have a serve target. Skipping configuration for this project.`
    );
    return;
  }
  const cypressVersion = installedCypressVersion();
  const filesToUse = cypressVersion && cypressVersion < 10 ? 'v9' : 'v10';

  const hasTsConfig = tree.exists(
    joinPathFragments(e2eProjectConfig.root, 'tsconfig.json')
  );
  const segmentCount = (options.directory.match(/[\\/]/g) || []).length + 1;
  const offsetFromProjectRoot = Array.from(
    { length: segmentCount },
    () => '..'
  ).join('/');

  const fileOpts = {
    ...options,
    project: projectConfig.name,
    dir: options.directory ?? 'src',
    ext: options.js ? 'js' : 'ts',
    offsetFromRoot: offsetFromRoot(e2eProjectConfig.root),
    offsetFromProjectRoot,
    projectRoot: projectConfig.root,
    tsConfigPath: hasTsConfig
      ? `${offsetFromProjectRoot}/tsconfig.json`
      : getRelativePathToRootTsConfig(tree, e2eProjectConfig.root),
    tmpl: '',
  };

  generateFiles(
    tree,
    join(__dirname, 'files', filesToUse),
    e2eProjectConfig.root,
    fileOpts
  );
  if (filesToUse === 'v10') {
    const cyFile = joinPathFragments(
      e2eProjectConfig.root,
      options.js ? 'cypress.config.js' : 'cypress.config.ts'
    );
    const webServerCommands: Record<string, string> = {};
    let ciWebServerCommand: string;
    const targetString = targetToTargetString({
      project: projectConfig.name,
      target: 'serve',
    });
    webServerCommands.default = `nx run ${targetString}`;
    if (serveTarget.configurations?.['production']) {
      webServerCommands.production = `nx run ${targetString}:production`;
    }

    if (projectConfig.targets?.['serve-static']) {
      ciWebServerCommand = `nx run ${projectConfig.name}:serve-static`;
    }
    const updatedCyConfig = await addDefaultE2eConfig(
      tree.read(cyFile, 'utf-8'),
      {
        cypressDir: options.directory,
        bundler: options.bundler === 'vite' ? 'vite' : undefined,
        webServerCommands,
        ciWebServerCommand: ciWebServerCommand,
      },
      options.baseUrl
    );

    tree.write(cyFile, updatedCyConfig);
  }
}

// noinspection JSUnusedGlobalSymbols
export default configGenerator;
