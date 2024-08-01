import { PromiseExecutor } from '@nx/devkit';
import { RunExecutorSchema } from './schema';
import { detectFirebase, startFirebaseEmulators } from '../../utils/firebase';
import startWebServer from '../../utils/dev-server';

const runExecutor: PromiseExecutor<RunExecutorSchema> = async (
	options,
	context
) => {
	const { isPresent } = detectFirebase(context);
	let result: {success: boolean};
	if (isPresent) {
		for await (const res of startFirebaseEmulators(options.watch, options.emulatorCommand, options, context)) {
			result = res;
		}
	} else {
		for await (const res of startWebServer(options.webServerCommand ?? options.devServerTarget, options.watch, options, context)) {
			result = res;
		}
	}

	return result;
};

export default runExecutor;
