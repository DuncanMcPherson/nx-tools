import { PromiseExecutor } from '@nx/devkit';
import { ServeExecutorSchema } from './schema';
import { startEmulators } from '../../utils/firebase';

const runExecutor: PromiseExecutor<ServeExecutorSchema> = async (options) => {
	options = validateAndNormalizeOptions(options);
	console.log('Executor ran for Serve', options);
	const firebaseCommand = getFirebaseCommand(options.only, options.includeHosting, options.saveDataDir);
	console.log('Command to use for firebase: ', firebaseCommand);
	const killEmulators = await startEmulators(firebaseCommand);
	killEmulators && killEmulators();
	return {
		success: true,
	};
};

function validateAndNormalizeOptions(options: ServeExecutorSchema) {
	validateOptions(options);
	return normalizeOptions(options);
}

function validateOptions(options: ServeExecutorSchema) {
	if (!options.baseServeTarget) {
		throw new Error("A base server target is required.");
	}
	if (options.only?.length && options.includeHosting) {
		console.warn("Using --includeHosting causes the command to ignore --only.")
	}
}

function normalizeOptions(options: ServeExecutorSchema) {
	options ??= {};
	options.only ??= options.includeHosting ? undefined : [];
	options.includeHosting ??= false;
	options.saveDataDir ??= undefined;
	return options;
}

function getFirebaseCommand(emulators?: string[], includeHosting?: boolean, saveDataDir?: string) {
	let command = 'firebase emulators:start';
	if (!includeHosting) {
		let onlyPart = ' --only ';
		emulators.forEach((emulator) => {
			if (emulator !== 'hosting') {
				onlyPart += `${emulator},`
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

export default runExecutor;
