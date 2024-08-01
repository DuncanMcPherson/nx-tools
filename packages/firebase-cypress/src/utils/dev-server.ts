import { ExecutorContext, runExecutor, Target } from '@nx/devkit';
import request from './request';
import { spawn } from 'child_process';
import * as process from 'node:process';

export default async function (command: string, baseUrl: string, cwd: string, context: ExecutorContext): Promise<() => void> {
	const serverStartedExternally = await isServerUp(baseUrl);
	if (serverStartedExternally) {
		console.log(`Re-using existing server at ${baseUrl}`);
		return undefined;
	}

	const target = getFullCommand(command);

	await startServer(target, cwd, context);
	await waitForServer(baseUrl, undefined);
	// if (!killServer) {
	// 	throw new Error('Unable to start server');
	// }
	// return killServer;
}

async function isServerUp(baseUrl: string): Promise<boolean> {
	if (!isNaN(+baseUrl)) {
		baseUrl = `http://localhost:${baseUrl}`;
	}

	return new Promise((resolve) => {
		return request(baseUrl, () => {
			resolve(true);
		}, () => {
			resolve(false);
		})
	})
}

function getFullCommand(command: string): Target {
	const parts = command.split(' ');
	const commandString = parts.find(x => x.includes(':'));
	if (!commandString) {
		throw new Error(`Invalid command: ${command}`);
	}

	const [project, target, configuration] = commandString.split(':');
	return {
		project,
		target,
		configuration
	}
}

async function *startServer(command: Target, cwd: string, context: ExecutorContext): /*() => void */ AsyncGenerator<any> {
	for await (const s of await runExecutor(command, {}, context)) {
		yield s;
	}
	// const serverProcess = spawn(command, {
	// 	cwd,
	// 	shell: true,
	// 	detached: true,
	// 	stdio: process.platform === 'win32' ? 'ignore' : 'inherit'
	// });
	//
	// return () => {
	// 	if (process.platform === 'win32') {
	// 		// spawn('taskkill', ['/im', 'node.exe', '/f', '/t', '/fi', 'PID ne', process.pid.toString()]);
	// 		serverProcess.kill();
	//
	// 		// process.kill(serverProcess.pid, 'SIGKILL')
	// 	} else {
	// 		process.kill(-serverProcess.pid);
	// 	}
	// }
}

function waitForServer(baseUrl: string, abortProcessor: () => void): Promise<void> {
	let pollTimeout: NodeJS.Timeout | null;
	const timeoutDuration = 60 * 1000;
	const timeout = setTimeout(() => {
		clearTimeout(pollTimeout);
		abortProcessor();
		abortProcessor = undefined;
	}, timeoutDuration);

	return new Promise((resolve) => {
		if (!isNaN(+baseUrl)) {
			baseUrl = `http://localhost:${baseUrl}`;
		}
		function pollForServer() {
			return request(baseUrl, () => {
				clearTimeout(timeout);
				resolve();
			}, () => {
				pollTimeout = setTimeout(pollForServer, 100);
			});
		}

		return pollForServer();
	});
}
