import { PromiseExecutor } from '@nx/devkit';
import { OpenExecutorSchema } from './schema';

const runExecutor: PromiseExecutor<OpenExecutorSchema> = async (options) => {
  return {
    success: true,
  };
};

export default runExecutor;
