import { PromiseExecutor } from '@nx/devkit';
import { EmulatorsExecutorSchema } from './schema';

const runExecutor: PromiseExecutor<EmulatorsExecutorSchema> = async (
	options
) => {
	console.log('Executor ran for Emulators', options);
	return {
		success: true,
	};
};

export default runExecutor;
