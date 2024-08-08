import { ExecutorContext } from '@nx/devkit';

import { FirebaseExecutorSchema } from './schema';
import executor from './executor';

const options: FirebaseExecutorSchema = {};
const context: ExecutorContext = {
	root: '',
	cwd: process.cwd(),
	isVerbose: false,
};

describe('Firebase Executor', () => {
	it('can run', async () => {
		const output = await executor(options, context);
		expect(output.success).toBe(true);
	});
});
