import { ExecutorContext, logger } from '@nx/devkit';
import { dirname, basename } from 'path';
import { existsSync, readdirSync, unlinkSync } from 'fs';
import { installedCypressVersion } from './cypress-version';
import { CypressRunnerSchema } from './cypress-runner.schema';
import request from './request';
import { killPort } from './kill-port';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const Cypress = require('cypress');

export default async function runCypressInternal(
	options: CypressRunnerSchema,
	context: ExecutorContext
): Promise<{
	success: boolean;
}> {
	process.env.NX_CYPRESS_TARGET_CONFIGURATION = context.configurationName;
	const success = await runCypress(options.baseUrl, options);

	return {
		success
	};
}

async function runCypress(
	baseUrl: string,
	opts: CypressRunnerSchema
): Promise<boolean> {
	const cypressVersion = installedCypressVersion();
	const projectFolderPath = dirname(opts.cypressConfig);
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const options: any = {
		project: projectFolderPath,
		configFile: basename(opts.cypressConfig)
	};

	if (baseUrl) {
		options.config = { baseUrl };
	}

	if (opts.browser) {
		options.browser = opts.browser;
	}

	if (opts.env) {
		options.env = {
			...options.env,
			...opts.env
		};
	}

	if (opts.spec) {
		options.spec = opts.spec;
	}

	options.tag = opts.tag;
	options.exit = opts.exit;
	options.headed = opts.headed;
	options.runnerUi = opts.runnerUi;

	if (opts.headless) {
		options.headless = opts.headless;
	}

	options.record = opts.record;
	options.key = opts.key;
	options.parallel = opts.parallel;
	options.ciBuildId = opts.ciBuildId?.toString();
	options.group = opts.group;

	if (cypressVersion >= 10) {
		options.config ??= {};
		options.config[opts.testingType] = {
			excludeSpecPattern: opts.ignoreTestFiles
		};
	} else {
		options.ignoreTestFiles = opts.ignoreTestFiles;
	}

	if (opts.reporter) {
		options.reporter = opts.reporter;
	}

	if (opts.reporterOptions) {
		options.reporterOptions = opts.reporterOptions;
	}
	if (opts.quiet) {
		options.quiet = opts.quiet;
	}

	if (opts.autoCancelAfterFailures !== undefined) {
		options.autoCancelAfterFailures = opts.autoCancelAfterFailures;
	}

	if (opts.testingType)
		options.testingType = opts.testingType;

	const result = await (opts.watch ? Cypress.open(options) : Cypress.run(options));

	cleanupTmpFile(opts.ctTailwindPath);
	cleanupTmpFile(opts.portLockFilePath);

	if (process.env.NX_VERBOSE_LOGGING === 'true' && opts.portLockFilePath) {
		readdirSync(dirname(opts.portLockFilePath)).forEach((f) => {
			if (f.endsWith('.txt')) {
				logger.debug(`Lock file ${f} still present`);
			}
		});
	}

	await ensureWebServerClosed(options.config.baseUrl);

	return !result.totalFailed && !result.failures;
}

function ensureWebServerClosed(url: string): Promise<void> {
	return new Promise((res) => {
		void request(url, async () => {
			const urlParts = url.split(':');
			const port = parseInt(urlParts[urlParts.length - 1]);
			await killPort(port);
			res();
		}, () => {
			res();
		})
	})
}

function cleanupTmpFile(path: string) {
	try {
		if (path && existsSync(path)) {
			unlinkSync(path);
		}
		return true;
	} catch {
		return false;
	}
}
