import { PromiseExecutor } from '@nx/devkit';
import { RunExecutorSchema } from './schema';
import runCypressInternal from '../../utils/run-cypress';
import { startFirebaseServer, terminateFirebaseServer } from '../../utils/firebase-v2';

const runExecutor: PromiseExecutor<RunExecutorSchema> = async (
	options,
	context
) => {
	validateOptions(options);
	try {
		await startFirebaseServer(context);

		return await runCypressInternal(options, context);
	} finally {
		await terminateFirebaseServer(context)
	}
};

function validateOptions(options: RunExecutorSchema) {
	if (!options.devServerTarget && !options.webServerCommand) {
		throw new Error('Invalid command: Either devServerTarget or webServerCommand must be provided. This can be configured in cypress.config.ts, or in project.json');
	}
}

export default runExecutor;
