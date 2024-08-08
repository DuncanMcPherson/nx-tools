import { PromiseExecutor } from '@nx/devkit';
import { RunExecutorSchema } from './schema';
import { detectFirebase, startFirebaseEmulators, terminateEmulatorsIfStarted } from '../../utils/firebase';
import runCypressInternal from '../../utils/run-cypress';

const runExecutor: PromiseExecutor<RunExecutorSchema> = async (
	options,
	context
) => {
	try {
		const { isPresent } = detectFirebase(context);
		let result: { success: boolean };
		if (isPresent) {
			for await (const res of startFirebaseEmulators(options.watch, options.emulatorCommand, options, context)) {
				result = res;
			}
		} else {
			result = await runCypressInternal(options, context);
		}

		return result;
	} finally {
		await terminateEmulatorsIfStarted(context)
	}
};

export default runExecutor;
