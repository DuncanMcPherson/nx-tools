import { ExecutorContext, PromiseExecutor } from '@nx/devkit';
import { RunExecutorSchema } from './schema';
import runCypressInternal from '../../utils/run-cypress';
import { detectFirebase, startFirebaseEmulators } from '../../utils/firebase';

const runExecutor: PromiseExecutor<RunExecutorSchema> = async (
  options,
  context
) => {
  const { isPresent, portNumber, projectRoot } = detectFirebase(context);
  let killEmulators: () => void;
  if (isPresent) {
    killEmulators = await startFirebaseEmulators(projectRoot, portNumber);
  }
  const result = await runCypress(options, context);
  killEmulators && killEmulators();
  return result;
};

async function runCypress(
  options: RunExecutorSchema,
  context: ExecutorContext
): Promise<{ success: boolean }> {
  options = normalizeOptions(options);
  return runCypressInternal(options, context);
}

function normalizeOptions(options: RunExecutorSchema): RunExecutorSchema {
  options ??= {} as RunExecutorSchema;
  options.watch = options.watch ?? false;

  return options;
}

export default runExecutor;
