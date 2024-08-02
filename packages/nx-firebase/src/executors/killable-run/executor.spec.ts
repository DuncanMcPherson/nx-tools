import { ExecutorContext } from '@nx/devkit';

import executor from './executor';

const context: ExecutorContext = {
	root: '',
	cwd: process.cwd(),
	isVerbose: false,
};

describe('KillableRun Executor', () => {
	it('can run', async () => {
		// const output = await executor(, context);
		// expect(output.success).toBe(true);
	});
});
