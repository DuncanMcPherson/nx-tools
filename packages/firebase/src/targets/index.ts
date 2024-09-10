import {
  CreateNodesContext,
  createNodesFromFiles,
  CreateNodesResult,
  CreateNodesV2,
  detectPackageManager,
  getPackageManagerCommand,
  ProjectConfiguration,
  readJsonFile,
  TargetConfiguration,
  writeJsonFile,
  joinPathFragments,
} from '@nx/devkit';
import { existsSync, readdirSync } from 'fs';
import { hashObject } from 'nx/src/hasher/file-hasher';
import { join, dirname } from 'path';
import { workspaceDataDirectory } from 'nx/src/utils/cache-directory';
import { calculateHashForCreateNodes } from '@nx/devkit/src/utils/calculate-hash-for-create-nodes';
import { getLockFileName } from 'nx/src/plugins/js/lock-file/lock-file';

export interface PluginOptions {
  serveTargetName?: string;
  includeHosting?: boolean;
  saveDataDirectory?: string;
}

type PluginTargets = Pick<ProjectConfiguration, 'targets' | 'metadata'>;

function readTargetsCache(cachePath: string): Record<string, PluginTargets> {
  return existsSync(cachePath) ? readJsonFile(cachePath) : {};
}

function writeTargetsToCache(cachePath: string, targets: PluginTargets) {
  writeJsonFile(cachePath, targets);
}

const firebaseConfigGlob = '**/firebase.json';
const pmc = getPackageManagerCommand();

export const createNodesV2: CreateNodesV2<PluginOptions> = [
  firebaseConfigGlob,
  async (configFiles, options, context) => {
    const optionsHash = hashObject(options);
    const cachePath = join(
      workspaceDataDirectory,
      `firebase-${optionsHash}.hash`
    );
    const targetsCache = readTargetsCache(cachePath);
    try {
      return await createNodesFromFiles(
        (configFile, options, context) =>
          createNodesInternal(configFile, options, context, targetsCache),
        configFiles,
        options,
        context
      );
    } finally {
      writeTargetsToCache(cachePath, targetsCache);
    }
  },
];

export async function createNodesInternal(
  configFile: string,
  options: PluginOptions,
  context: CreateNodesContext,
  targetsCache: Record<string, PluginTargets>
): Promise<CreateNodesResult> {
  options = normalizePluginOptions(options);
  const projectRoot = dirname(configFile);

  const siblingFiles = readdirSync(join(context.workspaceRoot, projectRoot));

  if (
    !siblingFiles.includes('package.json') &&
    !siblingFiles.includes('project.json')
  ) {
    return {};
  }

  // TODO: fail point
  const hash = await calculateHashForCreateNodes(
    projectRoot,
    options,
    context,
    [getLockFileName(detectPackageManager(context.workspaceRoot))]
  );

  targetsCache[hash] = await buildFirebaseTargets(
    configFile,
    projectRoot,
    options,
    context
  );

  const { targets, metadata } = targetsCache[hash];

  const project: Omit<ProjectConfiguration, 'root'> = {
    projectType: 'application',
    targets,
    metadata,
  };

  return {
    projects: {
      [projectRoot]: project,
    },
  };
}

function normalizePluginOptions(options: PluginOptions) {
  options ??= {};
  options.serveTargetName ??= 'serve-firebase';
  options.includeHosting ??= false;
  return options;
}

async function buildFirebaseTargets(
  configFile: string,
  projectRoot: string,
  options: PluginOptions,
  context: CreateNodesContext
): Promise<PluginTargets> {
  const firebaseConfig = readJsonFile(join(context.workspaceRoot, configFile));

  if (!firebaseConfig?.emulators) {
    return {};
  }

  const targets: Record<string, TargetConfiguration> = {};
  const onlyEmulators = getEmulatorsFromConfig(firebaseConfig);
  const baseServeTarget = await getBaseServeTarget(configFile, context);
  const fullTargetName = `${baseServeTarget.split(':')[0]}:${
    options.serveTargetName
  }`;

  targets[options.serveTargetName] = {
    executor: '@nxextensions/firebase:serve',
    options: {
      cwd: projectRoot,
      baseServeTarget,
      only: onlyEmulators,
      includeHosting: options.includeHosting,
      saveDataDir: options.saveDataDirectory
        ? options.saveDataDirectory
        : undefined,
    },
    parallelism: false,
    metadata: {
      description: 'Runs the firebase emulators alongside your application',
      technologies: ['firebase'],
      help: {
        command: `${pmc.exec} nx run ${fullTargetName} --help`,
        example: {
          args: ['--only auth,database', '--saveDataDir ./firebase/data'],
        },
      },
    },
  };

  return { targets };
}

function getEmulatorsFromConfig(firebaseConfig: {
  emulators: { [key: string]: { port?: number; enabled?: boolean } | boolean };
}): string[] {
  const emulatorConfig = firebaseConfig.emulators;

  const keys: string[] = [];

  Object.keys(emulatorConfig).forEach((key) => {
    if (
      typeof emulatorConfig[key] === 'boolean' ||
      !emulatorConfig[key].port ||
      key === 'hosting'
    ) {
      return;
    }

    keys.push(key);
  });

  return keys;
}

async function getBaseServeTarget(
  configFile: string,
  context: CreateNodesContext
): Promise<string> {
  const rootDir = dirname(configFile);
  if (existsSync(join(context.workspaceRoot, rootDir, 'nx-firebase.json'))) {
    const config = readJsonFile(
      join(context.workspaceRoot, rootDir, 'nx-firebase.json')
    );
    if (config.baseServeTarget) {
      return config.baseServeTarget;
    }
  }

  const projectJson: ProjectConfiguration = readJsonFile(
    joinPathFragments(context.workspaceRoot, rootDir, 'project.json')
  );
  let serveTarget: string;
  if (projectJson.targets['serve']) {
    serveTarget = 'serve';
  } else {
    Object.keys(projectJson.targets).forEach((key) => {
      if (key.toLowerCase().includes('serve') && !serveTarget) {
        serveTarget = key;
      }
    });
  }

  return `${projectJson.name}:${serveTarget}`;
}
