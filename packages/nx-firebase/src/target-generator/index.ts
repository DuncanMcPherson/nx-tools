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
	writeJsonFile
} from '@nx/devkit';
import { existsSync, readdirSync } from 'fs';
import { hashObject } from 'nx/src/devkit-internals';
import { join, dirname } from 'path';
import { workspaceDataDirectory } from 'nx/src/utils/cache-directory';
import { calculateHashForCreateNodes } from '@nx/devkit/src/utils/calculate-hash-for-create-nodes';
import { getLockFileName } from '@nx/js';
import { loadConfigFile } from '@nx/devkit/src/utils/config-utils';

export interface PluginOptions {
	firebaseEmulatorsTargetName?: string;
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
		console.log(configFiles);
		const optionsHash = hashObject(options);
		const cachePath = join(
			workspaceDataDirectory,
			`firebase-${optionsHash}.hash`
		);
		const targetsCache = readTargetsCache(cachePath);
		try {
			return await createNodesFromFiles(
				(configFile, options, context) => createNodesInternal(configFile, options, context, targetsCache),
				configFiles,
				options,
				context
			);
		} finally {
			writeTargetsToCache(cachePath, targetsCache);
		}
	}
];

async function createNodesInternal(
	configFile: string,
	options: object,
	context: CreateNodesContext,
	targetsCache: Record<string, PluginTargets>
): Promise<CreateNodesResult> {
	options = normalizeOptions(options);
	const projectRoot = dirname(configFile);

	const siblingFiles = readdirSync(join(context.workspaceRoot, projectRoot));

	if (
		!siblingFiles.includes('package.json') &&
		!siblingFiles.includes('project.json')
	) {
		return {};
	}

	const hash = await calculateHashForCreateNodes(
		projectRoot,
		options,
		context,
		[getLockFileName(detectPackageManager(context.workspaceRoot))]
	);

	targetsCache[hash] ??= await buildFirebaseTargets(
		configFile,
		projectRoot,
		options,
		context
	);

	const { targets, metadata } = targetsCache[hash];

	const project: Omit<ProjectConfiguration, 'root'> = {
		projectType: 'application',
		targets,
		metadata
	};

	return {
		projects: {
			[projectRoot]: project
		}
	};
}

async function buildFirebaseTargets(
	configFile: string,
	projectRoot: string,
	options: PluginOptions,
	context: CreateNodesContext
): Promise<PluginTargets> {
	const firebaseConfig = await loadConfigFile(
		join(context.workspaceRoot, configFile),
	);

	if (!firebaseConfig?.emulators ?? true) {
		return {};
	}

	const targets: Record<string, TargetConfiguration> = {};

	targets[options.firebaseEmulatorsTargetName] = {
		executor: "@nxextensions/nx-firebase:emulators",
		parallelism: true,
		options: {
			cwd: projectRoot,
		},
		metadata: {
			technologies: ['firebase'],
			description: 'Starts Firebase emulators for the given project',
			help: {
				command: `${pmc.exec} firebase emulators:start --help`,
				example: {
					args: ['--only', 'database']
				}
			}
		}
	}

	return { targets };
}

function normalizeOptions(options: PluginOptions): PluginOptions {
	options ??= {};
	options.firebaseEmulatorsTargetName ??= "firebase-emulators";
	return options;
}
