import { PromiseExecutor } from '@nx/devkit';
import { ServeExecutorSchema } from './schema';
import { startEmulators } from '../../utils/firebase';
import { startServer } from '../../utils/server';
import * as rln from 'readline';

const runExecutor: PromiseExecutor<ServeExecutorSchema> = async (
	options,
	context
) => {
	options = validateAndNormalizeOptions(options);
	let killEmulators: () => Promise<void>;
	try {
		const firebaseCommand = getFirebaseCommand(
			options.only,
			options.includeHosting,
			options.saveDataDir
		);
		killEmulators = await startEmulators(
			firebaseCommand,
			context,
			options.saveDataDir
		);
		initProcessListeners(killEmulators);
		await startServer(options.baseServeTarget, context);
		return {
			success: true,
		};
	} finally {
		killEmulators && (await killEmulators());
	}
};

function validateAndNormalizeOptions(options: ServeExecutorSchema) {
	validateOptions(options);
	return normalizeOptions(options);
}

function validateOptions(options: ServeExecutorSchema) {
	if (!options.baseServeTarget) {
		throw new Error('A base server target is required.');
	}
	if (options.only?.length && options.includeHosting) {
		console.warn(
			'Using --includeHosting causes the command to ignore --only.'
		);
	}
}

function normalizeOptions(options: ServeExecutorSchema) {
	options ??= {};
	options.only ??= options.includeHosting ? undefined : [];
	options.includeHosting ??= false;
	options.saveDataDir ??= undefined;
	return options;
}

function getFirebaseCommand(
	emulators?: string[],
	includeHosting?: boolean,
	saveDataDir?: string
) {
	let command = 'firebase emulators:start';
	if (!includeHosting) {
		let onlyPart = ' --only ';
		emulators.forEach((emulator) => {
			if (emulator !== 'hosting') {
				onlyPart += `${emulator},`;
			}
		});
		onlyPart = onlyPart.substring(0, onlyPart.length - 1);
		command += onlyPart;
	}

	if (saveDataDir) {
		command += ` --import ${saveDataDir} --export-on-exit ${saveDataDir}`;
	}

	return command;
}

function initProcessListeners(cb: () => Promise<void>) {
	if (process.platform === 'win32') {
		const rl = rln.createInterface({
			input: process.stdin,
			output: process.stdout,
		});

		rl.on('SIGINT', () => {
			process.emit('SIGINT');
		});
		process.stdout.write('\n');
		process.stdout.write(rl.listeners('SIGINT').toString());
	}

	process.on('SIGINT', async () => {
		await cb();
		process.exit();
	});
}

export default runExecutor;
