import {
	CreateNodesContext,
	createNodesFromFiles, CreateNodesResult,
	CreateNodesV2,
	detectPackageManager,
	getPackageManagerCommand,
	joinPathFragments,
	normalizePath,
	NxJsonConfiguration,
	ProjectConfiguration,
	readJsonFile,
	TargetConfiguration,
	writeJsonFile
} from '@nx/devkit';
import { existsSync, readdirSync } from 'fs';
import { hashObject } from 'nx/src/devkit-internals';
import { join, dirname, relative } from 'path';
import { workspaceDataDirectory } from 'nx/src/utils/cache-directory';
import { calculateHashForCreateNodes } from '@nx/devkit/src/utils/calculate-hash-for-create-nodes';
import { getLockFileName } from '@nx/js';
import { loadConfigFile } from '@nx/devkit/src/utils/config-utils';
import { getNamedInputs } from '@nx/devkit/src/utils/get-named-inputs';
import { globWithWorkspaceContext } from 'nx/src/utils/workspace-context';
import { RunExecutorSchema } from '../executors/run/schema';

export const NX_PLUGIN_OPTIONS = '__NX_PLUGIN_OPTIONS__';

export interface PluginOptions {
	ciTargetName?: string;
	targetName?: string;
	openTargetName?: string;
	componentTestingTargetName?: string;
	emulatorTargetName?: string;
}

type PluginTargets = Pick<ProjectConfiguration, 'targets' | 'metadata'>;

function readTargetsCache(cachePath: string): Record<string, PluginTargets> {
	return existsSync(cachePath) ? readJsonFile(cachePath) : {};
}

function writeTargetsToCache(cachePath: string, targets: PluginTargets) {
	writeJsonFile(cachePath, targets);
}

const cypressConfigGlob = '**/cypress.config.{js,ts,mjs,cjs}';
const pmc = getPackageManagerCommand();

export const createNodesV2: CreateNodesV2<PluginOptions> = [
	cypressConfigGlob,
	async (configFiles, options, context) => {
		const optionsHash = hashObject(options);
		const cachePath = join(
			workspaceDataDirectory,
			`cypress-${optionsHash}.hash`
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

	targetsCache[hash] ??= await buildCypressTargets(
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

async function buildCypressTargets(
	configFile: string,
	projectRoot: string,
	options: PluginOptions,
	context: CreateNodesContext
): Promise<PluginTargets> {
	const cypressConfig = await loadConfigFile(
		join(context.workspaceRoot, configFile)
	);

	const pluginPresetOptions = {
		...cypressConfig.e2e?.[NX_PLUGIN_OPTIONS],
		...cypressConfig.env,
		...cypressConfig.e2e?.env
	};

	const dependencyProjectName = getProjectFromCommand(cypressConfig.e2e[NX_PLUGIN_OPTIONS].webServerCommands.default);
	const dependencyTarget = dependencyProjectName.length ? `${dependencyProjectName}:${options.emulatorTargetName}` : undefined;

	const webServerCommands: Record<string, string> =
		pluginPresetOptions.webServerCommands;
	const namedInputs = getNamedInputs(projectRoot, context);

	const targets: Record<string, TargetConfiguration> = {};
	let metadata: ProjectConfiguration['metadata'];

	if ('e2e' in cypressConfig) {
		const opts = buildCypressOptions(
			configFile,
			cypressConfig,
			projectRoot,
			'e2e',
			false
		);
		targets[options.targetName] = {
			executor: '@nxextensions/firebase-cypress:run',
			options: opts,
			cache: true,
			inputs: getInputs(namedInputs),
			outputs: getOutputs(projectRoot, cypressConfig, 'e2e'),
			parallelism: false,
			dependsOn: dependencyTarget ? [dependencyTarget] : undefined,
			metadata: {
				technologies: ['cypress'],
				description: 'Runs Cypress Tests',
				help: {
					command: `${pmc.exec} cypress run --help`,
					example: {
						args: ['--dev', '--headed']
					}
				}
			}
		};

		if (webServerCommands?.default) {
			delete webServerCommands.default;
		}

		if (Object.keys(webServerCommands ?? {}).length > 0) {
			targets[options.targetName].configurations ??= {};
			for (const [configuration, webServerCommand] of Object.entries(
				webServerCommands ?? {}
			)) {
				targets[options.targetName].configurations[configuration] = {
					env: {
						webServerCommand
					}
				};
			}
		}

		const ciWebServerCommand: string = pluginPresetOptions?.ciWebServerCommand;
		if (ciWebServerCommand) {
			const specPatterns: string[] = Array.isArray(
				cypressConfig.e2e.specPattern
			)
				? cypressConfig.e2e.specPattern.map((p: string) => join(projectRoot, p))
				: [join(projectRoot, cypressConfig.e2e.specPattern)];
			const excludeSpecPatterns: string[] = !cypressConfig.e2e
				.excludeSpecPattern
				? cypressConfig.e2e.excludeSpecPattern
				: Array.isArray(cypressConfig.e2e.excludeSpecPattern)
					? cypressConfig.e2e.excludeSpecPattern.map((p: string) =>
						join(projectRoot, p)
					)
					: [join(projectRoot, cypressConfig.e2e.excludeSpecPattern)];
			const specFiles = await globWithWorkspaceContext(
				context.workspaceRoot,
				specPatterns,
				excludeSpecPatterns
			);

			const dependsOn: TargetConfiguration['dependsOn'] = [];
			const outputs = getOutputs(projectRoot, cypressConfig, 'e2e');
			const inputs = getInputs(namedInputs);

			const groupName = 'E2E (CI)';
			metadata = { targetGroups: { [groupName]: [] } };
			const ciTargetGroup = metadata.targetGroups[groupName];
			for (const file of specFiles) {
				const relativeSpecPath = normalizePath(relative(projectRoot, file));
				const targetName = `${options.ciTargetName}--${relativeSpecPath}`;

				ciTargetGroup.push(targetName);
				targets[targetName] = {
					outputs,
					inputs,
					cache: true,
					executor: '@nxextensions/firebase-cypress:run-ci',
					options: {
						cwd: projectRoot,
						env: {
							webServerCommand: ciWebServerCommand,
							spec: relativeSpecPath
						}
					},
					parallelism: false,
					metadata: {
						technologies: ['cypress'],
						description: `Runs Cypress Tests in ${relativeSpecPath} in CI`,
						help: {
							command: `${pmc.exec} cypress run --help`,
							example: {
								args: ['--dev', '--headed']
							}
						}
					}
				};
				dependsOn.push({
					target: targetName,
					projects: 'self',
					params: 'forward'
				});
				dependencyTarget && dependsOn.push(dependencyTarget);
			}

			targets[options.ciTargetName] = {
				executor: 'nx:noop',
				cache: true,
				inputs,
				outputs,
				dependsOn,
				parallelism: false,
				metadata: {
					technologies: ['cypress'],
					description: 'Runs Cypress Tests in CI',
					nonAtomizedTarget: options.targetName,
					help: {
						command: `${pmc.exec} cypress run --help`,
						example: {
							args: ['--dev', '--headed']
						}
					}
				}
			};
			ciTargetGroup.push(options.ciTargetName);
		}
	}

	if ('component' in cypressConfig) {
		targets[options.componentTestingTargetName] ??= {
			executor: '@nxextensions/firebase-cypress:run-component',
			options: { cwd: projectRoot },
			cache: true,
			inputs: getInputs(namedInputs),
			outputs: getOutputs(projectRoot, cypressConfig, 'component'),
			metadata: {
				technologies: ['cypress'],
				description: 'Runs Cypress Component Tests',
				help: {
					command: `${pmc.exec} cypress run --help`,
					example: {
						args: ['--dev', '--headed']
					}
				}
			}
		};
	}

	targets[options.openTargetName] = {
		executor: '@nxextensions/firebase-cypress:open',
		options: { cwd: projectRoot },
		dependsOn: dependencyTarget ? [dependencyTarget] : undefined,
		metadata: {
			technologies: ['cypress'],
			description: 'Opens Cypress',
			help: {
				command: `${pmc.exec} cypress open --help`,
				example: {
					args: ['--dev', '--e2e']
				}
			}
		}
	};

	return { targets, metadata };
}

function normalizeOptions(options: PluginOptions): PluginOptions {
	options ??= {};
	options.ciTargetName ??= 'e2e-ci';
	options.componentTestingTargetName ??= 'component';
	options.openTargetName ??= 'open-cypress';
	options.targetName ??= 'e2e';
	options.emulatorTargetName ??= 'firebase-emulators';
	return options;
}

function getInputs(
	namedInputs: NxJsonConfiguration['namedInputs']
): TargetConfiguration['inputs'] {
	return [
		...('production' in namedInputs
			? ['default', '^production']
			: ['default', '^default']),
		{
			externalDependencies: ['cypress']
		}
	];
}

function getOutputs(
	projectRoot: string,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	cypressConfig: any,
	testingType: 'e2e' | 'component'
): string[] {
	function getOutput(path: string): string {
		if (path.startsWith('..')) {
			return joinPathFragments('{workspaceRoot}', projectRoot, path, path);
		} else {
			return joinPathFragments('{projectRoot}', path);
		}
	}

	const { screenshotsFolder, videosFolder, e2e, component } = cypressConfig;

	const outputs: string[] = [];

	if (videosFolder) {
		outputs.push(getOutput(videosFolder));
	}

	if (screenshotsFolder) {
		outputs.push(getOutput(screenshotsFolder));
	}

	switch (testingType) {
		case 'e2e':
			if (e2e.videosFolder) {
				outputs.push(getOutput(e2e.videosFolder));
			}
			if (e2e.screenshotsFolder) {
				outputs.push(getOutput(e2e.screenshotsFolder));
			}
			break;
		case 'component':
			if (component.videosFolder) {
				outputs.push(getOutput(component.videosFolder));
			}
			if (component.screenshotsFolder) {
				outputs.push(getOutput(component.screenshotsFolder));
			}
			break;
	}

	return outputs;
}

function buildCypressOptions(
	configFilePath: string,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	cypressConfig: any,
	_projectRoot: string,
	testingType: 'e2e' | 'component',
	isCi: boolean
): RunExecutorSchema {
	const config = testingType in cypressConfig ? cypressConfig[testingType] : {};
	return {
		devServerTarget: isCi
			? config[NX_PLUGIN_OPTIONS].ciWebServerCommand
			: config[NX_PLUGIN_OPTIONS].webServerCommands.default,
		baseUrl: config.baseUrl,
		cypressConfig: configFilePath,
		testingType
	};
}

function getProjectFromCommand(webServerCommand: string) {
	const commandTargets = webServerCommand.split(' ');
	const commandTarget = commandTargets[commandTargets.length - 1];
	if (!commandTarget) {
		return '';
	}

	const [project] = commandTarget.split(':');
	return project;
}
