jest.mock('child_process', () => ({
  spawn: jest.fn(() => {
    const cp = new EventEmitter();
    setTimeout(() => {
      cp.emit('exit', 0);
    });
    return cp;
  }),
}));

import { ExecutorContext } from '@nx/devkit';
import executor, { DeployExecutorSchema } from './executor';
import { EventEmitter } from 'node:events';

const options: DeployExecutorSchema = {
  cwd: '',
};
const context: ExecutorContext = {
  root: '',
  cwd: process.cwd(),
  isVerbose: false,
};

describe('Deploy Executor', () => {
  it('can run', async () => {
    const output = await executor(options, context);
    expect(output.success).toBe(true);
  });
});
