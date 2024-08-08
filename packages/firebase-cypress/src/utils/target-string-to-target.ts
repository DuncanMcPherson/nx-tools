import { Target } from '@nx/devkit';

export function targetStringToTarget(targetString: string): Target {
	if (targetString.includes(' ')) {
		const parts = targetString.split(' ');
		const commandPart = parts.find(part => part.includes(':'));
		if (!commandPart) {
			throw new Error(`Unable to parse target: "${targetString}" to a valid target`);
		}
		targetString = commandPart;
	}

	if (targetString.includes(':')) {
		const [project, target, configuration] = targetString.split(':');
		return {
			project,
			target,
			configuration
		}
	}

	throw new Error(`Unable to parse target: "${targetString}" to a valid target`)
}
