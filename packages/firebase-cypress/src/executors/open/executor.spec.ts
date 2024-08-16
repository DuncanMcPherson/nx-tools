jest.mock('@nx/devkit', () => ({
	readProjectsConfigurationFromProjectGraph: jest.fn(() => {
		return {
			projects: {
				test: {
					root: 'apps/test'
				},
				'test-e2e': {
					implicitDependencies: ['test']
				}
			}
		};
	}),
	readJsonFile: jest.fn(() => ({
		emulators: {
			database: {
				port: 9000
			}
		}
	})),
	runExecutor: jest.fn(function* () {
		yield new Promise(res => res({success: true}));
	})
}));
jest.mock('../../utils/cypress-version')
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
jest.mock('../../utils/request');

import { ExecutorContext } from '@nx/devkit';

import { OpenExecutorSchema } from './schema';
import executor from './executor';

const options: OpenExecutorSchema = {
	emulatorCommand: 'test:open-firebase',
	cypressConfig: 'cypress.config.ts',
	baseUrl: 'http://localhost:4200',
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
