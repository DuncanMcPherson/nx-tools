import { PromiseExecutor } from '@nx/devkit';
import { FirebaseExecutorSchema } from './schema';
import { exec } from 'node:child_process';
import * as process from 'node:process';

interface IReadyWhenData {
	stringToMatch: string;
	found: boolean;
}

interface INormalizedExecutorSchemaOptions extends FirebaseExecutorSchema {
	readyWhenData?: IReadyWhenData;
}

const runExecutor: PromiseExecutor<FirebaseExecutorSchema> = async (
	options
) => {
	const opts = normalizeOptions(options);

	if (opts.readyWhen && !opts.parallel) {
		throw new Error('The "--parallel" flag must be set to true in order to use "--readyWhen"')
	}

	const command = stringifyCommandAndOpts(opts.command, opts);

	return await startProcess(command, opts.cwd, opts.readyWhenData)
};

function normalizeOptions(options?: FirebaseExecutorSchema): INormalizedExecutorSchemaOptions {
	const opts: INormalizedExecutorSchemaOptions = {};
	options ??= {};
	opts.cwd ??= options.cwd ?? '.';
	opts.command ??= options.command ?? "npx firebase emulators:start";
	opts.parallel ??= options.parallel ??  true;
	opts.readyWhen ??= options.readyWhen ?? "It is now safe to connect";
	opts.only ??= options.only ?? [];
	opts.disableOnly ??= options.disableOnly ?? false;

	opts.readyWhenData = opts.readyWhen ? {
		stringToMatch: opts.readyWhen,
		found: false
	} : undefined;

	return opts;
}

function isReady(readyWhen: IReadyWhenData, data?: string): boolean {
	if (data !== undefined && data.length > 0) {
		if (data.includes(readyWhen.stringToMatch)) {
			readyWhen.found = true;
		}
	}

	return readyWhen.found;
}

function stringifyCommandAndOpts(command: string, options: INormalizedExecutorSchemaOptions): string {
	let opts = '';

	if (options.disableOnly) {
		return command;
	}

	if (options.only?.length > 0) {
		opts += ' --only=' + options.only.join(',');
	}

	return `${command}${opts}`;
}

function startProcess(command: string, cwd: string, readyWhen?: IReadyWhenData): Promise<{success: boolean}> {
	return new Promise((resolve) => {
		const cp = exec(command, {
			cwd
		});

		cp.stdout.on('data', (chunk) => {
			process.stdout.write(chunk);
			if (readyWhen && isReady(readyWhen, chunk)) {
				resolve({success: true})
			}
		});
		cp.stderr.on('data', (chunk) => {
			process.stderr.write(chunk);
			if (readyWhen && isReady(readyWhen, chunk)) {
				resolve({success: true});
			}
		});

		cp.on('error', (err) => {
			process.stderr.write(err.toString());
			resolve({success: false});
		});
		cp.on('exit', (code) => {
			if (!readyWhen || isReady(readyWhen)) {
				resolve({success: code === 0});
			}
		})
	})
}

export default runExecutor;
