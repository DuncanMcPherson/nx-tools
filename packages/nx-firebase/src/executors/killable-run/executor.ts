import { ExecutorContext } from '@nx/devkit';
import { getPseudoTerminal, PseudoTerminal, PseudoTtyProcess } from 'nx/src/tasks-runner/pseudo-terminal';
import { loadAndExpandDotEnvFile, unloadDotEnvFile } from 'nx/src/tasks-runner/task-env';
import * as yargsParser from 'yargs-parser';
// eslint-disable-next-line @typescript-eslint/no-var-requires
import * as chalk from 'chalk';
import * as process from 'node:process';


import { exec, ChildProcess, Serializable } from 'child_process';
import * as path from 'path';
import { env as appendLocalEnv } from 'npm-run-path';
import { signalToCode } from 'nx/src/utils/exit-codes';

export const LARGE_BUFFER = 1024 * 1000000;
let pseudoTerminal: PseudoTerminal | null;
const childProcesses = new Set<ChildProcess | PseudoTtyProcess>();

function loadEnvVarsFile(path: string, env: Record<string, string> = {}) {
	unloadDotEnvFile(path, env);
	const result = loadAndExpandDotEnvFile(path, env);
	if (result.error) {
		throw result.error;
	}
}

function loadEnvVars(path?: string, env: Record<string, string> = {}) {
	if (path) {
		loadEnvVarsFile(path, env);
	} else {
		try {
			loadEnvVarsFile('.env', env);
		} catch {
			// Intentionally swallowing error
		}
	}
}

export type Json = {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	[k: string]: any;
}

export interface KillableRunOptions extends Json {
	command?: string | string[];
	commands?: (
		| {
		command: string;
		forwardAllArgs?: boolean;
		/**
		 * description was added to allow users to document their commands inline,
		 * it is not intended to be used as part of the execution of the command.
		 */
		description?: string;
		prefix?: string;
		color?: string;
		bgColor?: string;
	}
		| string
		)[];
	color?: boolean;
	parallel?: boolean;
	readyWhen?: string | string[];
	cwd?: string;
	env?: Record<string, string>;
	forwardAllArgs?: boolean; // default is true
	args?: string | string[];
	envFile?: string;
	__unparsed__: string[];
	usePty?: boolean;
	streamOutput?: boolean;
	tty?: boolean;
}

const propKeys = [
	'command',
	'commands',
	'color',
	'no-color',
	'parallel',
	'no-parallel',
	'readyWhen',
	'cwd',
	'args',
	'envFile',
	'__unparsed__',
	'env',
	'usePty',
	'streamOutput',
	'verbose',
	'forwardAllArgs',
	'tty'
];

export interface NormalizedKillableRunOptions extends KillableRunOptions {
	commands: {
		command: string;
		forwardAllArgs?: boolean;
	}[];
	unknownOptions?: {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		[k: string]: any;
	},
	parsedArgs: {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		[k: string]: any;
	},
	unparsedCommandArgs?: {
		[k: string]: string | string[]
	};
	arks?: string;
	readyWhenStatus: { stringToMatch: string; found: boolean }[];
}

export default async function(
	options: KillableRunOptions,
	context: ExecutorContext
): Promise<{ success: boolean, terminalOutput?: string, killProcess: () => void }> {
	registerProcessListener();
	const normalized = normalizeOptions(options);

	if (normalized.readyWhenStatus.length && !normalized.parallel) {
		throw new Error(
			'ERROR: Bad executor config: "readyWhen" can only be used when "parallel=true".'
		);
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	if (options.commands.find((c: any) => c.prefix || c.color || c.bgColor) && !options.parallel) {
		throw new Error(
			'ERROR: Bad executor config: "prefix", "color", and "bgColor" can only be used when "parallel=true".'
		);
	}

	try {
		return options.parallel
			? await runInParallel(normalized, context)
			: await runSerially(normalized, context);
	} catch (e) {
		if (process.env.NX_VERBOSE_LOGGING === 'true') {
			console.error(e);
		}

		throw new Error(`ERROR: An error occurred running commands: ${e.message}`);
	}
}

async function runInParallel(
	options: NormalizedKillableRunOptions,
	context: ExecutorContext
): Promise<{ success: boolean, killProcess: () => void, terminalOutput: string }> {
	const procs = options.commands.map((c) =>
		createProcess(
			null,
			c,
			options.readyWhenStatus,
			options.color,
			calculateCwd(options.cwd, context),
			options.env ?? {},
			true,
			options.usePty,
			options.streamOutput,
			options.tty,
			options.envFile
		).then((result: { success: boolean, killProcess: () => void, terminalOutput: string }) => ({
			result,
			command: c.command
		})));

	let terminalOutput = '';
	if (options.readyWhenStatus.length) {
		const r: {
			result: { success: boolean; terminalOutput: string; killProcess: () => void };
			command: string;
		} = await Promise.race(procs);
		terminalOutput += r.result.terminalOutput;
		if (!r.result.success) {
			const output = `Warning: command ${r.command} exited with non-zero status code`;
			terminalOutput += output;
			if (options.streamOutput) {
				process.stderr.write(output);
			}
			return { success: false, terminalOutput, killProcess: r.result.killProcess };
		} else {
			return { success: true, terminalOutput, killProcess: r.result.killProcess };
		}
	} else {
		const r: {
			result: { success: boolean; terminalOutput: string; killProcess: () => void },
			command: string;
		}[] = await Promise.all(procs);
		terminalOutput += r.map(f => f.result.terminalOutput).join('');
		const failed = r.filter((v) => !v.result.success);
		const killProcess = () => {
			r.forEach((p) => {
				p.result.killProcess();
			});
		};
		if (failed.length > 0) {
			const output = failed.map((f) => `Warning: command ${f.command} exited with non-zero status code`).join('\r\n');
			terminalOutput += output;
			if (options.streamOutput) {
				process.stderr.write(output);
			}
			return {
				success: false,
				terminalOutput,
				killProcess
			};
		} else {
			return {
				success: true,
				terminalOutput,
				killProcess
			};
		}
	}
}

function normalizeOptions(
	options: KillableRunOptions
): NormalizedKillableRunOptions {
	if (options.readyWhen && typeof options.readyWhen === 'string') {
		options.readyWhenStatus = [
			{
				stringToMatch: options.readyWhen, found: false
			}
		];
	} else {
		options.readyWhenStatus = (options.readyWhen as string[])?.map((stringToMatch) => ({
			stringToMatch,
			found: false
		})) ?? [];
	}

	if (options.command) {
		options.commands = [
			{
				command: Array.isArray(options.command)
					? options.command.join(' ')
					: options.command
			}
		];
		options.parallel = options.readyWhenStatus?.length > 0;
	} else {
		options.commands = options.commands.map((c) => typeof c === 'string' ? { command: c } : c);
	}

	if (options.args && Array.isArray(options.args)) {
		options.args = options.args.join(' ');
	}

	const unparsedCommandArgs = yargsParser(options.__unparsed__, {
		configuration: {
			'parse-numbers': false,
			'parse-positional-numbers': false,
			'dot-notation': false,
			'camel-case-expansion': false
		}
	});
	// noinspection CommaExpressionJS
	options.unknownOptions = Object.keys(options)
		.filter((p) => propKeys.indexOf(p) === -1 && unparsedCommandArgs[p] === undefined)
		.reduce((m, c) => ((m[c] = options[c]), m), {});
	options.parsedArgs = parseArgs(
		unparsedCommandArgs,
		options.unknownOptions,
		options.args as string
	);
	options.unparsedCommandArgs = unparsedCommandArgs;

	(options as NormalizedKillableRunOptions).commands.forEach((c) => {
		c.command = interpolateArgsIntoCommand(
			c.command,
			options as NormalizedKillableRunOptions,
			c.forwardAllArgs ?? options.forwardAllArgs ?? true
		);
	});
	return options as NormalizedKillableRunOptions;
}

async function runSerially(
	options: NormalizedKillableRunOptions,
	context: ExecutorContext
): Promise<{ success: boolean, terminalOutput: string, killProcess: () => void }> {
	pseudoTerminal ??= PseudoTerminal.isSupported() ? getPseudoTerminal() : null;
	let terminalOutput = '';
	const processMethods = [];
	for (const c of options.commands) {
		const result = await createProcess(
			pseudoTerminal,
			c,
			[],
			options.color,
			calculateCwd(options.cwd, context),
			options.processEnv ?? options.env ?? {},
			false,
			options.usePty,
			options.streamOutput,
			options.tty,
			options.envFile
		);
		processMethods.push(result.killProcess);
		terminalOutput += result.terminalOutput;
		if (!result.success) {
			const output = ` Warning: command ${c.command} exited with non-zero status code`;
			result.terminalOutput += output;
			if (options.streamOutput) {
				process.stderr.write(output);
			}
			return {
				success: false, terminalOutput, killProcess: () => {
					processMethods.forEach((m) => {
						m();
					});
				}
			};
		}
	}
	return {
		success: true, terminalOutput, killProcess: () => {
			processMethods.forEach(m => m());
		}
	};
}

async function createProcess(
	pseudoTerminal: PseudoTerminal | null,
	commandConfig: {
		command: string;
		color?: string;
		bgColor?: string;
		prefix?: string;
	},
	readyWhenStatus: { stringToMatch: string; found: boolean }[] = [],
	color: boolean,
	cwd: string,
	env: Record<string, string>,
	isParallel: boolean,
	usePty = true,
	streamOutput = true,
	tty: boolean,
	envFile?: string
): Promise<{ success: boolean, terminalOutput: string, killProcess: () => void }> {
	env = processEnv(color, cwd, env, envFile);

	if (
		pseudoTerminal &&
		process.env.NX_NATIVE_COMMAND_RUNNER !== 'false' &&
		!commandConfig.prefix &&
		readyWhenStatus.length === 0 &&
		!isParallel &&
		usePty
	) {
		let terminalOutput = chalk.dim('> ') + commandConfig.command + '\r\n\r\n';
		if (streamOutput) {
			process.stdout.write(terminalOutput);
		}

		const cp = pseudoTerminal.runCommand(commandConfig.command, {
			cwd,
			jsEnv: env,
			quiet: !streamOutput,
			tty
		});

		childProcesses.add(cp);

		return new Promise((res) => {
			cp.onOutput((output) => {
				terminalOutput += output;
			});

			cp.onExit((code) => {
				if (code >= 128) {
					process.exit(code);
				} else {
					res({ success: code === 0, terminalOutput, killProcess: cp.kill });
				}
			});
		});
	}

	return nodeProcess(commandConfig, cwd, env, readyWhenStatus, streamOutput);
}

function nodeProcess(
	commandConfig: {
		command: string;
		color?: string;
		bgColor?: string;
		prefix?: string;
	},
	cwd: string,
	env: Record<string, string>,
	readyWhenStatus: { stringToMatch: string; found: boolean }[],
	streamOutput = true
): Promise<{ success: boolean, terminalOutput: string, killProcess: () => void }> {
	let terminalOutput = chalk.dim('> ') + commandConfig.command + '\r\n\r\n';
	if (streamOutput) {
		process.stdout.write(terminalOutput);
	}

	return new Promise((res) => {
		const cp = exec(commandConfig.command, {
			maxBuffer: LARGE_BUFFER,
			env,
			cwd,

		});

		childProcesses.add(cp);
		console.log(cp.channel?.hasRef())
		cp.ref();
		console.log(cp.connected);

		cp.stdout.on('data', (data) => {
			const output = addColorAndPrefix(data, commandConfig);
			terminalOutput += output;
			if (streamOutput) {
				process.stdout.write(output);
			}

			if (readyWhenStatus.length && isReady(readyWhenStatus, data.toString())) {
				res({ success: true, terminalOutput, killProcess: cp.kill });
			}
		});
		cp.on('error', (err) => {
			const output = addColorAndPrefix(err.toString(), commandConfig);
			terminalOutput += output;
			if (streamOutput) {
				process.stderr.write(output);
			}
			res({ success: false, terminalOutput, killProcess: cp.kill });
		});
		cp.on('exit', (code) => {
			childProcesses.delete(cp);
			if (!readyWhenStatus.length || isReady(readyWhenStatus)) {
				res({ success: code === 0, terminalOutput, killProcess: cp.kill });
			} else {
				res({ success: false, terminalOutput, killProcess: cp.kill });
			}
		});
	});
}

function addColorAndPrefix(
	out: string,
	config: {
		prefix?: string;
		color?: string;
		bgColor?: string
	}
) {
	if (config.prefix) {
		out = out.split('\n')
			.map((l) => l.trim().length > 0 ? `${chalk.bold(config.prefix)} ${l}` : l)
			.join('\n');
	}
	if (config.color && chalk[config.color]) {
		out = chalk[config.color](out);
	}
	if (config.bgColor && chalk[config.bgColor]) {
		out = chalk[config.bgColor](out);
	}
	return out;
}

function calculateCwd(
	cwd: string | undefined,
	context: ExecutorContext
): string {
	if (!cwd) return context.root;
	if (path.isAbsolute(cwd)) return cwd;
	return path.join(context.root, cwd);
}

function processEnv(
	color: boolean,
	cwd: string,
	env: Record<string, string>,
	envFile?: string
) {
	const localEnv = appendLocalEnv({ cwd: cwd ?? process.cwd() });
	const res = {
		...process.env,
		...localEnv,
		...env
	};
	if (process.env.NX_LOAD_DOT_ENV_FILES != 'false') {
		loadEnvVars(envFile, res);
	}

	if (localEnv.PATH) res.PATH = localEnv.PATH;
	if (localEnv.Path) res.Path = localEnv.Path;

	if (color) {
		res.FORCE_COLOR = `${color}`;
	}

	return res;
}

function interpolateArgsIntoCommand(
	command: string,
	opts: Pick<
		NormalizedKillableRunOptions,
		| 'args'
		| 'parsedArgs'
		| '__unparsed__'
		| 'unknownOptions'
		| 'unparsedCommandArgs'
	>,
	forwardAllArgs: boolean
): string {
	if (command.indexOf('{args.') > -1) {
		const regex = /{args\.([^}]+)}/g;
		return command.replace(regex, (_, group: string) => 	opts.parsedArgs[group] !== undefined ? opts.parsedArgs[group] : '');
	} else if (forwardAllArgs) {
		let args = '';
		if (Object.keys(opts.unknownOptions ?? {}).length > 0) {
			const unknownOptionsArgs = Object.keys(opts.unknownOptions)
				.filter(
					(k) => typeof opts.unknownOptions[k] !== 'object' &&
						opts.parsedArgs[k] === opts.unknownOptions[k]
				)
				.map((k) => `--${k}=${opts.unknownOptions[k]}`)
				.map(wrapArgIntoQuotesIfNeeded)
				.join(' ');
			if (unknownOptionsArgs) {
				args += ` ${unknownOptionsArgs}`;
			}
			if (opts.__unparsed__?.length > 0) {
				const filteredParsedOptions = filterPropKeysFromUnParsedOptions(
					opts.__unparsed__,
					opts.parsedArgs
				);
				if (filteredParsedOptions.length > 0) {
					args += ` ${filteredParsedOptions.map(wrapArgIntoQuotesIfNeeded).join(' ')}`;
				}
			}
			return `${command}${args}`;
		} else {
			return command;
		}
	}
}

function parseArgs(
	unparsedCommandArgs: { [k: string]: string},
	unknownOptions: {[k: string]: string},
	args?: string
) {
	if (!args) {
		return { ...unknownOptions, ...unparsedCommandArgs };
	}

	return {
		...unknownOptions,
		...yargsParser(args.replace(/(^"|"$)/g, ''), {
			configuration: {'camel-case-expansion': true}
		}),
		...unparsedCommandArgs
	}
}

function filterPropKeysFromUnParsedOptions(
	__unparsed__: string[],
	parseArgs: {
		[k: string]: string | string[]
	} = {}
): string[] {
	const parsedOptions = [];
	for (let i = 0; i < __unparsed__.length; i++) {
		const element = __unparsed__[i];
		if (element.startsWith('--')) {
			const key = element.replace('--', '');
			if (element.includes('=')) {
				if (!propKeys.includes(key.split('=')[0].split('.')[0])) {
					parsedOptions.push(element);
				}
			} else {
				if (propKeys.includes(key)) {
					if (
						i + 1 < __unparsed__.length &&
						parseArgs[key] &&
						__unparsed__[i + 1].toString() === parseArgs[key].toString()
					) {
						i++;
					}
				} else {
					parsedOptions.push(element);
				}
			}
		} else {
			parsedOptions.push(element);
		}
	}
	return parsedOptions;
}

let registered = false;

function registerProcessListener() {
	if (registered) {
		return;
	}

	registered = true;

	process.on('message', (message: Serializable) => {
		if (pseudoTerminal) {
			pseudoTerminal.sendMessageToChildren(message);
		}

		childProcesses.forEach((p) => {
			if ('connected' in p && p.connected) {
				p.send(message);
			}
		});
	});

	process.on('exit', () => {
		childProcesses.forEach((p) => {
			if ('connected' in p ? p.connected : p.isAlive) {
				p.kill();
			}
		});
	});
	process.on('SIGINT', () => {
		childProcesses.forEach((p) => {
			if ('connected' in p ? p.connected : p.isAlive) {
				p.kill('SIGTERM');
			}
		});

		process.exit(signalToCode('SIGINT'));
	});
	process.on('SIGTERM', () => {
		childProcesses.forEach((p) => {
			if ('connected' in p ? p.connected : p.isAlive) {
				p.kill('SIGTERM');
			}
		});
	});
	process.on('SIGHUP', () => {
		childProcesses.forEach((p) => {
			if ('connected' in p ? p.connected : p.isAlive) {
				p.kill('SIGTERM');
			}
		});
	});
}

function wrapArgIntoQuotesIfNeeded(arg: string): string {
	if (arg.includes('=')) {
		const [key, value] = arg.split('=');
		if (
			key.startsWith('--') &&
			value.includes(' ')  &&
			!(value[0] === "'" || value[0] === '"')
		) {
			return `${key}="${value}"`;
		}
		return arg;
	} else if (arg.includes(' ') && !(arg[0] === "'" || arg[0] === '"')) {
		return `"${arg}"`;
	} else {
		return arg;
	}
}

function isReady(
	readyWhenStatus: { stringToMatch: string; found: boolean}[] = [],
	data?: string
): boolean {
	if (data) {
		for (const readyWhenElement of readyWhenStatus) {
			if (data.toString().indexOf(readyWhenElement.stringToMatch) > -1) {
				readyWhenElement.found = true;
				break;
			}
		}
	}

	return readyWhenStatus.every((readyWhen) => readyWhen.found);
}
