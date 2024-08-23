jest.mock('@nx/devkit', () => ({
	readProjectsConfigurationFromProjectGraph: jest.fn((): ProjectsConfigurations => {
		return {
			version: 2,
			projects: {
				test: {
					root: 'apps/test'
				},
				'test-e2e': {
					implicitDependencies: ['test'],
					root: 'apps/test-e2e'
				}
			}
		};
	}),
	joinPathFragments: jest.fn((...paths: string[]) => {
		return paths.join('/');
	}),
	readJsonFile: jest.fn((path: string) => {
		if (path.includes('firebase')) {
			return {
				emulators: {
					auth: {
						port: 9099
					}
				}
			}
		} else {
			return {};
		}
	})
}));
jest.mock('fs', () => ({
	readdirSync: (path: string): string[] => {
		if (!path.includes('e2e')) {
			return ['firebase.json'];
		} else {
			return [];
		}
	},
	existsSync: () => true
}));
jest.mock('cypress', () => ({
	run: jest.fn(() => ({})),
	open: jest.fn(() => ({}))
}));
jest.mock('../../utils/cypress-version');
jest.mock('../../utils/request');
jest.mock('../../utils/kill-port');
jest.mock('node:child_process', () => ({
	exec: jest.fn(() => {
		const cp = new EventEmitter();
		cp['stdout'] = new Readable({
			read() {
				this.push(null);
			}
		});
		cp['stderr'] = new Readable({
			read() {
				this.push(null);
			}
		});

		return cp;
	})
}));

import { ExecutorContext, ProjectsConfigurations } from '@nx/devkit';

import { OpenExecutorSchema } from './schema';
import executor from './executor';
import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';

const options: OpenExecutorSchema = {
	emulatorCommand: 'test:open-firebase',
	cypressConfig: 'cypress.config.ts',
	baseUrl: 'http://localhost:4200',
	devServerTarget: 'test:serve'
};
const context: ExecutorContext = {
	root: '',
	cwd: process.cwd(),
	isVerbose: false,
	projectName: 'test-e2e'
};

describe('Open Executor', () => {
	it('can run', async () => {
		const output = await executor(options, context);
		expect(output.success).toBe(true);
	});
});
