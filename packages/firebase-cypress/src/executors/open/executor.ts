import { PromiseExecutor } from '@nx/devkit';
import { OpenExecutorSchema } from './schema';
import runCypressInternal from '../../utils/run-cypress';
import { startFirebaseServer, terminateFirebaseServer } from '../../utils/firebase-v2';

const runExecutor: PromiseExecutor<OpenExecutorSchema> = async (options, context) => {
	validateOptions(options);
	try {
		await startFirebaseServer(context);

		return await runCypressInternal(options, context);
	} finally {
		await terminateFirebaseServer(context);
	}
};

function validateOptions(options: OpenExecutorSchema) {
	if (!options.devServerTarget && !options.webServerCommand) {
		throw new Error("Either devServerTarget or webServerCommand is required. This can be configured in cypress.config.ts, or in project.json");
	}
}

export default runExecutor;
