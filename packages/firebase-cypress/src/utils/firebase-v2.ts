import { isServerUp, waitForServer } from './server';
import { ExecutorContext, joinPathFragments, readJsonFile } from '@nx/devkit';
import { getE2EProjectDependency, validateFirebaseProject } from './project-graph';
import { exec } from 'node:child_process';
import * as process from 'node:process';
// @ts-expect-error This is the only way to import this
import * as killPort from 'kill-port';

export async function startFirebaseServer(context: ExecutorContext) {
	const port = getFirstEmulatorPort(context);
	if (port && await isServerUp(port)) {
		return;
	} else if (!port) {
		return;
	}

	const cp = exec('npx firebase emulators:start', {
		cwd: joinPathFragments(context.root, getE2EProjectDependency(context).root),
	});

	cp.stdout?.on('data', (data) => {
		process.stdout.write(data);
	});
	cp.stderr.on('data', (data) => {
		process.stderr.write(data);
	});

	await waitForServer(port);
}

function getFirstEmulatorPort(context: ExecutorContext): string | undefined {
	const applicationProject = getE2EProjectDependency(context);
	if (!applicationProject) {
		return;
	}

	if (!validateFirebaseProject(applicationProject, context)) {
		return;
	}

	let port: string;
	for (const p of getPortsForEmulators(joinPathFragments(context.root, applicationProject.root, 'firebase.json'))) {
		if (p && !isNaN(+p)) {
			port = p;
			break;
		}
	}
	return port;
}

function *getPortsForEmulators(firebaseJsonPath: string): Generator<string> {
	const firebaseConfig = readJsonFile(firebaseJsonPath);
	if (!firebaseConfig?.emulators) {
		return undefined;
	}

	const ports: string[] = [];

	Object.keys(firebaseConfig.emulators).forEach((key) => {
		if (firebaseConfig.emulators[key].port) {
			ports.push(firebaseConfig.emulators[key].port);
		}
	});

	for (const port of ports) {
		yield port;
	}
}

export async function terminateFirebaseServer(context: ExecutorContext) {
	const dependency = getE2EProjectDependency(context);
	for (const port of getPortsForEmulators(joinPathFragments(context.root, dependency.root, 'firebase.json'))) {
		await killPort(+port);
	}
}
