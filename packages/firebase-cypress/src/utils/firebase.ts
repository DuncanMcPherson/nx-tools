import {
	ExecutorContext,
	ProjectConfiguration,
	readJsonFile,
	readProjectsConfigurationFromProjectGraph,
	runExecutor
} from '@nx/devkit';
import { readdirSync } from 'fs';
import { join } from 'path';
import { targetStringToTarget } from './target-string-to-target';
import { CypressRunnerSchema } from './cypress-runner.schema';
// @ts-expect-error This is the only way to import this
import * as killPort from 'kill-port';
import runCypressInternal from './run-cypress';

export function detectFirebase(context: ExecutorContext): {
	isPresent: boolean;
} {
	const dependency = getE2EProjectDependency(context);
	const siblingFiles = readdirSync(join(context.root, dependency.root));
	if (!siblingFiles.includes('firebase.json')) {
		return { isPresent: false };
	}

	const { hasEmulators } = getPortForFirebaseEmulator(
		join(context.root, dependency.root, 'firebase.json')
	);

	return hasEmulators
		? { isPresent: true }
		: { isPresent: false };
}

function getPortForFirebaseEmulator(firebaseJsonPath: string): {
	hasEmulators: boolean;
} {
	const firebaseConfig = readJsonFile(firebaseJsonPath);
	if (!firebaseConfig?.emulators) {
		return { hasEmulators: false };
	}
	let port: number;
	Object.keys(firebaseConfig.emulators).forEach((key) => {
		if (!port) {
			port = firebaseConfig.emulators[key]?.port;
		}
	});

	if (!port) {
		return { hasEmulators: false };
	}

	return { hasEmulators: true };
}

export async function* startFirebaseEmulators(
	watch: boolean, command: string, options: CypressRunnerSchema, context: ExecutorContext
): AsyncGenerator<{ success: boolean }> {
	const target = targetStringToTarget(command);

	for await (const _s of await runExecutor(target, {}, context)) {
		if (!_s.success) {
			yield { success: false };
			break;
		}

		const result = await runCypressInternal(options, context);
		yield result;

		if (!watch) {
			break;
		}
	}
}

export async function terminateEmulatorsIfStarted(context: ExecutorContext): Promise<void> {
	const dependency = getE2EProjectDependency(context);
	const portsArray = getPortsForEmulators(join(context.root, dependency.root, 'firebase.json'));

	try {
		for (const port of portsArray) {
			await killPort(+port);
		}
	} catch (e) {
		console.error(e);
	}
}

function getE2EProjectDependency(context: ExecutorContext): ProjectConfiguration {
	const projectName = context.projectName;
	const projects = readProjectsConfigurationFromProjectGraph(
		context.projectGraph
	);
	const dependencyName = projects.projects[projectName].implicitDependencies[0];
	return projects.projects[dependencyName];
}

function getPortsForEmulators(firebaseJsonPath: string): string[] {
	const firebaseConfig = readJsonFile(firebaseJsonPath);
	if (!firebaseConfig?.emulators) {
		return [];
	}

	const res: string[] = [];

	Object.keys(firebaseConfig.emulators).forEach((key) => {
		if (!!firebaseConfig.emulators[key].port &&!res.includes(firebaseConfig.emulators[key].port)) {
			res.push(firebaseConfig.emulators[key].port);
		}
	});

	return res;
}
