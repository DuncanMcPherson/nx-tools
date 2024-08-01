import { ExecutorContext } from '@nx/devkit';

import { EmulatorsExecutorSchema } from './schema';
import executor from './executor';

const options: EmulatorsExecutorSchema = {};
const context: ExecutorContext = {
	root: '',
	cwd: process.cwd(),
	isVerbose: false,
};

describe('Emulators Executor', () => {
	it('can run', async () => {
		const output = await executor(options, context);
		expect(output.success).toBe(true);
	});
});
