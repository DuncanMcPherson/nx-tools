import { ExecutorContext } from '@nx/devkit';

import { OpenExecutorSchema } from './schema';
import executor from './executor';

const options: OpenExecutorSchema = {};
const context: ExecutorContext = {
  root: '',
  cwd: process.cwd(),
  isVerbose: false,
};

describe('Open Executor', () => {
  it('can run', async () => {
    const output = await executor(options, context);
    expect(output.success).toBe(true);
  });
});
