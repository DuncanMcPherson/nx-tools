import { Target, runExecutor, ExecutorContext } from '@nx/devkit';

export async function startServer(
	targetString: string,
	context: ExecutorContext
) {
	const target = targetStringToTarget(targetString);
	// TODO: fail point
	for await (const res of await runExecutor(target, {}, context)) {
		if (!res.success) {
			break;
		}
	}
}

function targetStringToTarget(targetString: string): Target {
	if (targetString.includes(' ')) {
		const parts = targetString.split(' ');
		targetString = parts.find((p) => p.includes(':'));
	}

	if (targetString.includes(':')) {
		const [project, target, configuration] = targetString.split(':');
		return {
			target,
			configuration,
			project,
		};
	}

	throw new Error('Unable to parse base serve target');
}
