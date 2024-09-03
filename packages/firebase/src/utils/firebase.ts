import { readJsonFile } from 'nx/src/utils/fileutils';
import request from './request';
import { exec, spawn, ChildProcess } from 'child_process';
import * as es from 'event-stream';

export async function startEmulators(command: string): Promise<(() => void) | undefined> {
	if (await isServerUp(command)) {
		return;
	}

	const killEmulators = runCommand(command);
	await waitForServer(command);
	return killEmulators;
}

function isServerUp(command: string): Promise<boolean> {
	const parts = command.split('--');
	const onlyPart = parts.filter(p => p.includes('only'))[0];
	const firstPort = getFirstEmulatorPort(onlyPart);
	const url = `http://localhost:${firstPort}`;
	return new Promise((res) => {
		return request(url, () => {
				res(true);
			},
			() => {
				res(false);
			});
	});
}

function getFirstEmulatorPort(only?: string): number {
	const firebaseConfig = readJsonFile('firebase.json');
	if (!firebaseConfig?.emulators) {
		throw new Error(`firebase.json does not contain the necessary emulators configuration`);
	}
	let port: number;
	Object.keys(firebaseConfig.emulators).forEach(emulator => {
		if (!port && firebaseConfig.emulators[emulator].port) {
			if ((only && only.includes(emulator)) || !only)
				port = firebaseConfig.emulators[emulator].port;
		}
	});
	return port;
}

function runCommand(command: string): () => void {
	const cp = exec(command);

	return () => {
		if (process.platform === 'win32') {
			listChildProcessPID(cp.pid, (pids, err) => {
				if (err)
					throw err;
				pids.forEach(pid => {
					exec(`taskkill /f /pid ${pid.PID}`)
				});
			});
		} else {
			process.kill(-cp.pid, 'SIGINT');
		}
	}
}

function waitForServer(command: string): Promise<void> {
	const port = getFirstEmulatorPort(command);
	return new Promise<void>((res, rej) => {
		let pollTimeout: NodeJS.Timeout | null;
		const timeout = setTimeout(() => {
			clearTimeout(pollTimeout);
			rej();
		}, 120_000);

		function pollForServer()  {
			void request(`http://localhost:${port}`, () => {
				clearTimeout(timeout);
				res();
			}, () => {
				pollTimeout = setTimeout(pollForServer, 100);
			});
		}

		pollForServer();
	})
}

function listChildProcessPID(pid: string | number, callback: (pids: Array<{PID: string}>, err: Error | unknown) => void) {
	let headers: string[] | null = null;
	if (typeof callback !== 'function') {
		throw new Error('listChildProcessPID: callback must be a function');
	}

	if (typeof pid === 'number') {
		pid = pid.toString();
	}

	let processLister: ChildProcess;

	if (process.platform === 'win32') {
		processLister = spawn('wmic.exe', ['PROCESS', 'GET', 'Name,ProcessId,ParentProcessId,Status']);
	} else {
		processLister = spawn('ps', ['-A', '-o', 'ppid,pid,stat,comm']);
	}

	es.connect(
		processLister.stdout,
		es.split(),
		es.map((line, cb) => {
			const columns = line.trim().split(/\s+/);
			if (!headers) {
				headers = columns;
				headers = headers.map(normalizeHeaders);
				return cb();
			}

			const row = {};
			const h = headers.slice();
			while (h.length) {
				row[h.shift()] = h.length ? columns.shift() : columns.join(' ')
			}

			return cb(null, row);
		}),
		es.writeArray((err, ps) => {
			const parents = {},
				children = [];
			parents[pid] = true;
			ps.forEach((p) => {
				if (parents[p.PPID]) {
					parents[p.PID] = true;
					children.push(p);
				}
			});

			callback(children, null);
		})
	).on('error', (err) => {
		callback([], err);
	})
}

function normalizeHeaders(str: string): string {
	switch (str) {
		case 'Name':
		case 'COMM':
			return 'COMMAND';
		case 'ParentProcessId':
			return 'PPID';
		case 'ProcessId':
			return "PID";
		case 'Status':
			return 'STAT';
		default:
			return str;
	}
}
