import { PromiseExecutor } from '@nx/devkit';
import { OpenExecutorSchema } from './schema';
import { detectFirebase, startFirebaseEmulators } from '../../utils/firebase';
import { openCypress } from '../../utils/open-cypress';

const runExecutor: PromiseExecutor<OpenExecutorSchema> = async (options, context) => {
	const { isPresent, portNumber, projectRoot } = detectFirebase(context);

	let killEmulators: () => void;

	if (isPresent) {
		killEmulators = await startFirebaseEmulators(projectRoot, portNumber);
	}

	const result = await openCypress(options, context);

	killEmulators && killEmulators();

	return result;
};

export default runExecutor;
