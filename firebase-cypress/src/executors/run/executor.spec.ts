import { ExecutorContext } from '@nx/devkit';

import { RunExecutorSchema } from './schema';
import executor from './executor';

const options: RunExecutorSchema = {};
const context: ExecutorContext = {
  root: '',
  cwd: process.cwd(),
  isVerbose: false,
};

describe('Run Executor', () => {
  it('can run', async () => {
    const output = await executor(options, context);
    expect(output.success).toBe(true);
  });
});
