import { PromiseExecutor, ExecutorContext } from '@nx/devkit';
import { E2eCiExecutorSchema } from './schema';
import { detectFirebase, startFirebaseEmulators } from '../../utils/firebase';
import startDevServer from '../../utils/dev-server'

const runExecutor: PromiseExecutor<E2eCiExecutorSchema> = async (
  options: E2eCiExecutorSchema,
  context: ExecutorContext
) => {
  const { isPresent } = detectFirebase(context);
  let result: {success: boolean}
  if (isPresent) {
	  for await (const res of startFirebaseEmulators(options.watch, options.emulatorCommand, options, context)) {
		  result = res;
	  }
  } else {
	  for await (const res of startDevServer(options.webServerCommand ?? options.devServerTarget, options.watch, options, context)) {
		  result = res;
	  }
  }

  return result;
};

export default runExecutor;
