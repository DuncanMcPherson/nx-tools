import { workspaceRoot } from '@nx/devkit';
import { dirname, join, relative } from 'path';
import { lstatSync } from 'fs';
// TODO: vitePreprocessor

import { NX_PLUGIN_OPTIONS } from '../target-generator';

import type { InlineConfig } from 'vite';
import * as process from 'node:process';
import request from '../utils/request';
import { spawn } from 'child_process'

interface BaseCypressPreset {
	videosFolder: string;
	screenshotsFolder: string;
	chromeWebSecurity: boolean;
}

export interface NxComponentTestingOptions {
	ctTargetName?: string;
	buildTarget?: string;
	bundler?: 'vite' | 'webpack';
	compiler?: 'swc' | 'babel';
}

export interface WebServerConfig {
	timeout?: number;
	reuseExistingServer?: boolean;
}

export type NxCypressE2EPresetOptions = {
	bundler?: string;
	cypressDir?: string;
	webServerCommands?: Record<string, string>;
	ciWebServerCommand?: string;
	webServerConfig?: WebServerConfig;
	viteConfigOverrides?: InlineConfig;
	emulatorCommand?: string;
};


export function nxBaseCypressPreset(
	pathToConfig: string,
	options?: { testingType: 'component' | 'e2e' }
): BaseCypressPreset {
	process.env.NX_CYPRESS_COMPONENT_TEST =
		options?.testingType === 'component' ? 'true' : 'false';

	const normalizedPath = lstatSync(pathToConfig).isDirectory()
		? pathToConfig
		: dirname(pathToConfig);
	const projectPath = relative(workspaceRoot, normalizedPath);
	const offset = relative(normalizedPath, workspaceRoot);
	const videosFolder = join(offset, 'dist', 'cypress', projectPath, 'videos');
	const screenshotsFolder = join(
		offset,
		'dist',
		'cypress',
		projectPath,
		'screenshots'
	);

	return {
		chromeWebSecurity: false,
		screenshotsFolder,
		videosFolder
	};
}

export function nxE2EPreset(
	pathToConfig: string,
	options?: NxCypressE2EPresetOptions
) {
	const basePath = options?.cypressDir || 'src';
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const baseConfig: any = {
		...nxBaseCypressPreset(pathToConfig),
		fileServerFolder: '.',
		supportFile: `${basePath}/support/e2e.{js,ts}`,
		specPattern: `${basePath}/**/*.cy.{js,jsx,ts,tsx}`,
		fixturesFolder: `${basePath}/fixtures`,

		[NX_PLUGIN_OPTIONS]: {
			webServerCommand: options?.webServerCommands?.default,
			webServerCommands: options?.webServerCommands,
			ciWebServerCommand: options?.ciWebServerCommand,
			emulatorCommand: options?.emulatorCommand
		},

		async setupNodeEvents(on, config) {
			const webServerCommands = config.env.webServerCommands ?? options.webServerCommands;
			const webServerCommand = config.env.webServerCommand ?? webServerCommands?.default;
			if (options?.bundler === 'vite') {
				// TODO: vite preprocessor
			}

			if (!options?.webServerCommands) {
				return;
			}

			if (!webServerCommand) {
				return;
			}

			const baseUrl = config.baseUrl;
			if (baseUrl && webServerCommand) {
				if (await isServerUp(baseUrl)) {
					if (options?.webServerConfig?.reuseExistingServer === undefined ? true : options?.webServerConfig?.reuseExistingServer) {
						console.log(`Reusing the server already running at ${baseUrl}`);
						return;
					}

					throw new Error(`Web server is already running at ${baseUrl}`);
				}
			}
			const killWebServer = startWebServer(webServerCommand);

			on('after:run', () => {
				killWebServer();
			});
			await waitForServer(baseUrl, options?.webServerConfig);
		}
	};

	return baseConfig;
}

function isServerUp(url: string): Promise<boolean> {
	return new Promise((res) => {
		void request(
			url,
			() => res(true),
			() => res(false)
		);
	})
}

function startWebServer(webServerCommand: string): () => void {
	if (!validateCommand(webServerCommand)) {
		throw new Error(`Command is in improper format: "${webServerCommand}" should be in the format of "[npx] nx run <targetForWebServer>"`)
	}

	const serverProcess = spawn(webServerCommand, {
		cwd: workspaceRoot,
		shell: true,
		detached: process.platform !== 'win32',
		stdio: 'inherit'
	});

	return () => {
		if (process.platform === 'win32') {
			spawn('taskkill', ['/pid', serverProcess.pid.toString(), '/f', '/t']);
		} else {
			process.kill(-serverProcess.pid, 'SIGKILL');
		}
	}
}

function waitForServer(
	url: string,
	webServerConfig: WebServerConfig
): Promise<void> {
	return new Promise((resolve, reject) => {
		let pollTimeout: NodeJS.Timeout | null;
		const timeoutDuration = webServerConfig?.timeout ?? 60 * 1000;
		const timeout = setTimeout(() => {
			clearTimeout(pollTimeout);
			reject(new Error(`Web server failed to start in ${timeoutDuration/1000}s. This can be configured in cypress.config.ts.`));
		}, timeoutDuration);

		function pollForServer() {
			void request(
				url,
				() => {
					clearTimeout(timeout);
					resolve();
				},
				() => {
					pollTimeout = setTimeout(pollForServer, 100);
				}
			);
		}

		pollForServer();
	})
}

function validateCommand(command: string): boolean {
	if (!command.includes(' ')) {
		return false;
	}

	const commandParts = command.split(' ');
	let isValid = true;
	for (let i = 0; i < commandParts.length; i++) {
		const commandPart = commandParts[i];
		if (i === 0) {
			isValid = commandPart === 'nx' || commandPart === 'npx';
		} else if (i === 1) {
			isValid = commandPart === 'nx' || commandPart === 'run'
		} else if (i === 2) {
			isValid = commandPart.includes(':') || commandPart === 'run';
		} else {
			isValid = commandPart.includes(':');
		}

		if (!isValid) {
			return false;
		}
	}

	return isValid;
}
