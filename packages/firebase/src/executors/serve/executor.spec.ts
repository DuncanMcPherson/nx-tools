jest.mock('nx/src/utils/fileutils', () => ({
	readJsonFile: jest.fn(() => ({
		emulators: {
			auth: {
				port: 9000,
			},
			database: {
				port: 9099,
			},
		},
	})),
	fileExists: jest.fn(() => true),
}));
jest.mock('../../utils/request');
let totalExecs = 0;
jest.mock('child_process', () => ({
	exec: jest.fn(() => {
		totalExecs++;
		const cp = new EventEmitter();
		cp['stdout'] = new Readable({
			read() {
				if (cp['pid'] === 1843) {
					this.push('Name   ParentProcessId   ProcessId   Status\n');
					this.push('cmd.exe   1567   1843\n');
				}
				this.push(null);
			},
		});
		cp['stderr'] = new Readable({
			read() {
				this.push(null);
			},
		});
		cp['pid'] = totalExecs === 1 ? 1567 : totalExecs === 2 ? 1843 : 1996;
		if (cp['pid'] === 1843) {
			setTimeout(() => {
				cp.emit('exit', 0);
			}, 150);
		}
		return cp;
	}),
	execSync: jest.fn(),
}));
jest.mock('@nx/devkit', () => ({
	joinPathFragments: jest.fn((...pathParts: string[]) => {
		return pathParts.map((part) => part.split(/[/\\]/).join('/')).join('/');
	}),
	runExecutor: jest.fn(function* () {
		yield Promise.resolve({ success: true });
	}),
}));
import { ExecutorContext } from '@nx/devkit';

import { ServeExecutorSchema } from './schema';
import executor from './executor';
import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';

const options: ServeExecutorSchema = {
	baseServeTarget: 'test:serve',
	only: ['auth'],
};
const context: ExecutorContext = {
	root: '',
	cwd: process.cwd(),
	isVerbose: false,
	projectsConfigurations: {
		projects: {
			test: {
				root: 'apps/test',
			},
		},
		version: 2,
	},
	projectName: 'test',
};

describe('Serve Executor', () => {
	it.skip('can run', async () => {
		const output = await executor(options, context);
		expect(output.success).toBe(true);
	});
});
