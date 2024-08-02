import { AsyncIteratorExecutor } from '@nx/devkit';
import { EmulatorsExecutorSchema } from './schema';
import { spawn } from 'child_process';
import * as process from 'node:process';

const runExecutor: AsyncIteratorExecutor<EmulatorsExecutorSchema> = async function* (
	options
) {
	for await (const res of startEmulator(options)) {
		yield {
			success: res
		};
	}
};

async function* startEmulator(options: EmulatorsExecutorSchema): AsyncGenerator<boolean> {
	const optionsString = stringifyOptions(options);
	const childProcess = spawn('npx firebase emulators:start', optionsString, {
		cwd: options.cwd,
		shell: true,
		detached: process.platform !== 'win32',
	});

	let validStatus: boolean;

	childProcess.stdout.setEncoding("utf8");
	childProcess.stdout.on('data', (data) => {
		const dataString = data.toString();
		console.log(dataString);

		if (dataString.includes('It is now')) {
			validStatus = true;
		} else if (dataString.includes('Error')) {
			validStatus = false;
		}
	});

	childProcess.stderr.setEncoding("utf8");
	childProcess.stderr.on('data', (data) => {
		console.error(data);
		validStatus = false;
	})

	yield true
}

function stringifyOptions(options: EmulatorsExecutorSchema): string[] {
	const results: string[] = [];

	Object.keys(options).forEach((key: string) => {
		if (key === 'cwd') {
			return;
		}

		switch (key) {
			case 'only': {
				const validatedEmulators = getValidEmulators(options[key]);
				results.push('--only');
				results.push(validatedEmulators.join(','));
				break;
			}
			case 'inspectFunctions': {
				results.push('--inspect-functions');
				typeof options[key] === 'string' || typeof options[key] === 'number' && results.push(options[key].toString());
				break;
			}
			case 'import':
				results.push('--import');
				results.push(options[key]);
				break;
			case 'exportOnExit':
				if (typeof options[key] === 'string') {
					results.push('--export-on-exit');
					results.push(options[key]);
				} else if (typeof options[key] === 'boolean') {
					options[key] && results.push('--export-on-exit')
				}
				break;
			case 'logVerbosity': {
				if (validateVerbosityLevel(options[key]))
				results.push('--log-verbosity');
				results.push(options[key]);
				break;
			}
		}
	});

	return results;
}

function getValidEmulators(emulators: string[] | string): string[] {
	const validEmulators = ['auth', 'functions', 'firestore', 'database', 'hosting', 'pubsub', 'storage', 'eventarc'];
	if (Array.isArray(emulators)) {
		emulators.forEach((em) => {
			if (!validEmulators.includes(em)) {
				console.warn(`Emulator: "${em}" is not a valid Firebase emulator`);
			}
		});
		return emulators.filter(em => validEmulators.includes(em));
	}

	const emulatorsArray = emulators.split(',').map(em => em.trim());
	emulatorsArray.forEach(em => {
		if (!validEmulators.includes(em)) {
			console.warn(`Emulator: "${em}" is not a valid Firebase emulator`);
		}
	});

	return emulatorsArray.filter(em => validEmulators.includes(em));
}

function validateVerbosityLevel(level: string): level is 'DEBUG' | 'INFO' | 'QUIET' | 'SILENT' {
	const validVerbosities = ['DEBUG', 'INFO', 'QUIET', 'SILENT'];
	return validVerbosities.includes(level);
}

export default runExecutor;
