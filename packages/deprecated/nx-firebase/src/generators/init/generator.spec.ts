jest.mock('@nx/devkit', () => ({
	globAsync: jest.fn(() => {
		return new Promise((resolve) => {
			resolve(['fake-path/firebase.json']);
		});
	}),
	getPackageManagerCommand: jest.fn(),
	readNxJson: jest.fn(() => ({
		useInferencePlugins: true,
	})),
	createProjectGraphAsync: jest.fn(() => {
		return Promise.resolve({});
	}),
}));
jest.mock('@nx/js', () => ({
	getLockfileName: jest.fn(),
}));
jest.mock('@nx/devkit/src/utils/config-utils', () => ({
	loadConfigFile: jest.fn(),
}));
jest.mock('@nx/devkit/src/utils/add-plugin', () => ({
	addPlugin: jest.fn(),
}));

import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Tree, globAsync } from '@nx/devkit';
import { addPlugin } from '@nx/devkit/src/utils/add-plugin';

import { initGenerator } from './generator';

describe('init generator', () => {
	let tree: Tree;

	beforeEach(() => {
		tree = createTreeWithEmptyWorkspace();
	});

	it('should run successfully', async () => {
		await initGenerator(tree);
		if (isMockFn(addPlugin)) {
			expect(addPlugin).toHaveBeenCalled();
		}
	});

	it("should throw an error when workspace doesn't contain a firebase.json", async () => {
		if (isMockFn(globAsync)) {
			globAsync.mockReset();
			globAsync.mockImplementation(() => {
				return new Promise((resolve) => {
					resolve([]);
				});
			});
		}
		try {
			await initGenerator(tree);
			throw new Error('Test should fail');
		} catch (e) {
			if (e.message === 'Test should fail') {
				throw e;
			}
			expect(e.message).toEqual(
				`firebase.json was not found amongst workspace and project files`
			);
		}
	});

	// eslint-disable-next-line @typescript-eslint/ban-types
	function isMockFn(fn: Function): fn is jest.Mock {
		return jest.isMockFunction(fn);
	}
});
