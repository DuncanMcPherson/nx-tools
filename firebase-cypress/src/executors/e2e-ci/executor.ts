import { PromiseExecutor, ExecutorContext } from '@nx/devkit';
import { E2eCiExecutorSchema } from './schema';
import { detectFirebase, startFirebaseEmulators } from "../../utils/firebase";
import runCypressInternal from "../../utils/run-cypress"

const runExecutor: PromiseExecutor<E2eCiExecutorSchema> = async (options: E2eCiExecutorSchema, context: ExecutorContext) => {
  const {isPresent, portNumber, projectRoot} = detectFirebase(context);

  let killEmulators: () => void;
  if (isPresent) {
    killEmulators = await startFirebaseEmulators(projectRoot, portNumber)
  }

  const result = await runCypressInternal(options, context);

  killEmulators && killEmulators();

  return result;
};

export default runExecutor;
