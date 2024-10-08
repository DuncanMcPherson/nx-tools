jest.mock('fs', () => ({
	readdirSync: jest.fn(() => ['firebase.json', 'project.json']),
	existsSync: jest.fn(() => false),
	writeFileSync: jest.fn(),
	unlinkSync: jest.fn()
}));
jest.mock('@nx/devkit', () => ({
	readJsonFile: jest.fn(() => {
		return {
			emulators: {
				auth: {
					port: 9099
				}
			}
		};
	}),
	readProjectsConfigurationFromProjectGraph: jest.fn(() => {
		return {
			projects: {
				'jets-test-e2e': {
					implicitDependencies: ['jets-test']
				},
				'jets-test': {
					root: 'apps/jets-test'
				}
			}
		};
	}),
	runExecutor: jest.fn(function* () {
		yield new Promise(res => res({ success: true }));
	}),
	joinPathFragments: jest.fn((...paths: string[]) => {
		return paths.join('/');
	})
}));

jest.mock('nx/src/command-line/run/executor-utils', () => ({
	getExecutorInformation: jest.fn(() => {
		return {
			schema: {
				watch: true
			}
		};
	})
}));
jest.mock('cypress', () => ({
	run: jest.fn(() => {
		return {};
	}),
	open: jest.fn(() => ({}))
}));
jest.mock('../../utils/cypress-version');
jest.mock('node:child_process', () => ({
	exec: jest.fn(() => {
		const cp = new EventEmitter();

		cp['stdout'] = new Readable({
			read() {
				this.push(null);
			}
		})

		cp['stderr'] = new Readable({
			read() {
				this.push(null);
			}
		})

		return cp;
	})
}));
jest.mock('../../utils/kill-port');
jest.mock('../../utils/request');
import { RunExecutorSchema } from './schema';
import executor from './executor';
import { ExecutorContext } from '@nx/devkit';
import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';

const options: RunExecutorSchema = {
	cypressConfig: '',
	emulatorCommand: 'test:firebase-emulators',
	baseUrl: 'https://localhost:4200',
	devServerTarget: 'test:serve'
};
const context: ExecutorContext = {
	root: '',
	cwd: process.cwd(),
	isVerbose: false,
	projectName: 'jets-test-e2e'
};

describe('Run Executor', () => {
	it('can run', async () => {
		const output = await executor(options, context);
		expect(output.success).toBe(true);
	});
});
