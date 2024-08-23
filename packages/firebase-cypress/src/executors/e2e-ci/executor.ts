import { PromiseExecutor, ExecutorContext } from '@nx/devkit';
import { E2eCiExecutorSchema } from './schema';
import { terminateFirebaseServer, startFirebaseServer } from '../../utils/firebase-v2';
import runCypressInternal from '../../utils/run-cypress';

const runExecutor: PromiseExecutor<E2eCiExecutorSchema> = async (
	options: E2eCiExecutorSchema,
	context: ExecutorContext
) => {
	try {
		await startFirebaseServer(context);
		return runCypressInternal(options, context)
	} catch (err) {
		console.error(err);
		return {
			success: false
		}
	} finally {
		await terminateFirebaseServer(context);
	}
};

export default runExecutor;
