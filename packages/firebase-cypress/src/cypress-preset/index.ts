import { workspaceRoot } from '@nx/devkit';
import { dirname, join, relative } from 'path';
import { lstatSync } from 'fs';
// TODO: vitePreprocessor

import { NX_PLUGIN_OPTIONS } from '../target-generator';

import type { InlineConfig } from 'vite';
import * as process from 'node:process';

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
			ciWebServerCommand: options?.ciWebServerCommand
		},

		async setupNodeEvents(on, config) {
			if (options?.bundler === 'vite') {
				// TODO: vite preprocessor
			}
		}
	};

	return baseConfig;
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
};
