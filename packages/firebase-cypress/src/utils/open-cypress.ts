import { OpenExecutorSchema } from '../executors/open/schema';
import { ExecutorContext } from '@nx/devkit';

export async function openCypress(options: OpenExecutorSchema, context: ExecutorContext): Promise<{
	success: boolean
}> {

	return {
		success: true
	};
}


