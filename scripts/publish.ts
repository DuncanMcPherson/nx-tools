import { createAPI } from 'nx/src/command-line/release/version';
import * as yargs from 'yargs';

async function determineArgs() {
	return await yargs
		.version(false)
		.option('projects', {
			description: 'Projects filter to use for the release script',
			type: 'string',
			default: '',
		})
		.option('dry-run', {
			description: 'Perform a dry run of the nx release operations',
			type: 'boolean',
			default: false,
		})
		.option('registry', {
			description: 'The npm registry to use for publishing the packages',
			type: 'string',
			default: undefined,
		})
		.option('specifier', {
			description:
				'The specifier to use when creating the release, can be set to "prerelease" for releasing an alpha version',
			type: 'string',
			default: undefined,
		})
		.option('skip-publish', {
			description: 'Skip publishing the package to the registry',
			type: 'boolean',
			default: false,
		})
		.option('preid', {
			description:
				'The version prefix to use, can be set in combination with specifier="prerelease"',
			type: 'string',
			default: undefined,
		})
		.option('first-release', {
			description: 'Is the first release for at least 1 project',
			type: 'boolean',
			default: false,
		})
		.parseAsync();
}

async function createReleaseVersions(
	args: Awaited<ReturnType<typeof determineArgs>>
) {
	const versionOptions = {
		dryRun: args.dryRun,
		gitCommit: false,
		stageChanges: true,
		projects:
			(Array.isArray(args.projects) ? args.projects : [args.projects]) ??
			[],
		firstRelease: args.firstRelease,
	};
	switch (args.specifier) {
		case 'prerelease':
			const preReleaseArgs = {
				dryRun: args.dryRun,
				specifier: args.specifier,
				preid: args.preid,
				gitCommit: false,
				gitTag: true,
			};
			return await createAPI({
				version: {
					preVersionCommand: '',
				},
			})(preReleaseArgs);
		default:
			return await createAPI({
				version: {
					preVersionCommand: undefined,
				},
			})(versionOptions);
	}
}

async function calculateNewVersion() {
	const args = await determineArgs();
	await createReleaseVersions(args);
	process.exit(0);
}

void calculateNewVersion();
