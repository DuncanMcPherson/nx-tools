import { ExecutorContext, runExecutor } from '@nx/devkit';
import { CypressRunnerSchema } from './cypress-runner.schema';
import { targetStringToTarget } from './target-string-to-target';
import runCypressInternal from './run-cypress';

export default async function* (command: string, watch: boolean, options: CypressRunnerSchema, context: ExecutorContext): AsyncGenerator<{
	success: boolean
}> {
	const target = targetStringToTarget(command);

	for await (const _s of await runExecutor(target, {}, context)) {
		if (_s.success) {
			yield await runCypressInternal(options, context);
		}
		if (!watch) {
			break;
		}
	}
}
