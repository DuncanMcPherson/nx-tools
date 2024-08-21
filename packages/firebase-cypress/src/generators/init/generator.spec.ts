jest.mock('@nx/devkit', () => ({
	readNxJson: jest.fn(() => (
		{
			useInferencePlugins: true,
			plugins: []
		})
	),
	createProjectGraphAsync: jest.fn(() => {
		return Promise.resolve({
			nodes: {
				test: {
					type: 'app',
					name: 'test',
					data: {
						root: 'apps/test'
					}
				}
			},
			version: '1',
			externalNodes: {},
			dependencies: {}
		})
	}),
	getPackageManagerCommand: jest.fn(() => {
		return {
			exec: 'test'
		};
	}),
	readProjectsConfigurationFromProjectGraph: jest.fn(() => {
		return {
			projects: {
				test: {
					root: 'apps/test',
					name: 'test',
					targets: {
						serve: {
						},
						'serve-static': {
						}
					}
				} as ProjectConfiguration
			}
		}
	}),
	globAsync: jest.fn(() => {
		return Promise.resolve(['apps/test/firebase.json']);
	}),
	joinPathFragments: jest.fn((...paths: string[]) => {
		return paths.join('/');
	}),
	getWorkspaceLayout: jest.fn(() => ({appsDir: 'apps'})),
	addProjectConfiguration: jest.fn(),
	offsetFromRoot: jest.fn(() => {
		return '..'
	}),
	generateFiles: jest.fn(),
	targetToTargetString: jest.fn((target: {project: string, target: string, configuration: string}) => {
		return `${target.project}:${target.target}${target.configuration ? `:${target.configuration}` : ''}`;
	}),
	formatFiles: jest.fn(),
}));
jest.mock('readline/promises');
jest.mock('@nx/devkit/src/utils/add-plugin', () => ({
	addPlugin: jest.fn(() => Promise.resolve())
}));
jest.mock('../../utils/cypress-version');
jest.mock('../../utils/config');
jest.mock('child_process', () => ({
	execSync: () => {
		// intentionally empty
	}
}));
jest.mock("@nx/js", () => ({
	getRelativePathToRootTsConfig: jest.fn(() => {
		return "tsconfig.json";
	})
}));
jest.mock('nx/src/devkit-internals', () => ({
	hashObject: jest.fn(),
}));
jest.mock('@nx/devkit/src/utils/calculate-hash-for-create-nodes', () => ({
	calculateHashForCreateNodes: jest.fn(),
}));
jest.mock('@nx/devkit/src/utils/config-utils', () => ({
	loadConfigFile: jest.fn(),
}))
jest.mock('@nx/devkit/src/utils/get-named-inputs', () => ({
	getNamedInputs: jest.fn(),
}))
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Tree, ProjectConfiguration } from '@nx/devkit';

import { initGenerator, InitGeneratorSchema } from './generator';

describe('init generator', () => {
	let tree: Tree;
	const options: InitGeneratorSchema = {}

	beforeEach(() => {
		tree = createTreeWithEmptyWorkspace();
		jest.spyOn(tree, 'read').mockImplementation(() => {
			return '';
		});
		jest.spyOn(tree, 'write').mockImplementation((fileName: string) => {
			tree["recordedChanges"][fileName] = {isDeleted: false};
		});
	});

	it('should run successfully', async () => {
		await initGenerator(tree, options);
		const fileChanges = tree.listChanges();
		const configFile = fileChanges.filter(x => x.path.includes('cypress.config'))[0];
		expect(configFile).toBeDefined();
	});
});
