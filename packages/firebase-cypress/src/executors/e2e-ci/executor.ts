import { PromiseExecutor, ExecutorContext } from '@nx/devkit';
import { E2eCiExecutorSchema } from './schema';
import { detectFirebase, startFirebaseEmulators, terminateEmulatorsIfStarted } from '../../utils/firebase';
import runCypressInternal from '../../utils/run-cypress';

const runExecutor: PromiseExecutor<E2eCiExecutorSchema> = async (
	options: E2eCiExecutorSchema,
	context: ExecutorContext
) => {
	try {
		const { isPresent } = detectFirebase(context);
		let result: { success: boolean };
		if (isPresent) {
			for await (const res of startFirebaseEmulators(options.watch, options.emulatorCommand, options, context)) {
				result = res;
			}
		} else {
			result = await runCypressInternal(options, context)
		}

		return result;
	} catch (err) {
		console.error(err);
		return {
			success: false
		}
	} finally {
		await terminateEmulatorsIfStarted(context);
	}
};

export default runExecutor;
