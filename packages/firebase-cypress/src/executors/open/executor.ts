import { PromiseExecutor } from '@nx/devkit';
import { OpenExecutorSchema } from './schema';
import { detectFirebase, startFirebaseEmulators, terminateEmulatorsIfStarted } from '../../utils/firebase';
import runCypressInternal from '../../utils/run-cypress';

// TODO: update other commands to allow for opening cypress
const runExecutor: PromiseExecutor<OpenExecutorSchema> = async (options, context) => {
	try {
		const { isPresent } = detectFirebase(context);
		let result: { success: boolean };
		options.watch = true;
		if (isPresent) {
			for await (const res of startFirebaseEmulators(options.watch, options.emulatorCommand, options, context)) {
				result = res;
			}
		} else {
			result = await runCypressInternal(options, context)
		}

		return result;
	} finally {
		await terminateEmulatorsIfStarted(context);
	}
};

export default runExecutor;
