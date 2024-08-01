import { PromiseExecutor } from '@nx/devkit';
import { OpenExecutorSchema } from './schema';
import { detectFirebase, startFirebaseEmulators } from '../../utils/firebase';
import startDevServer from '../../utils/dev-server';

// TODO: update other commands to allow for opening cypress
const runExecutor: PromiseExecutor<OpenExecutorSchema> = async (options, context) => {
	const { isPresent } = detectFirebase(context);
	let result: {success: boolean};
	options.watch = true;
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
