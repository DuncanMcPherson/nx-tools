jest.mock("@nx/devkit", () => ({
	readJsonFile: jest.fn((path: string) => {
		if (path.includes('virtual')) {
			return {
			} as NxJsonConfiguration;
		} else if (path === 'nx.json') {
			return {
				plugins: [
					{
						plugin: '@nxextensions/nx-firebase',
						options: {
							firebaseEmulatorsTargetName: 'firebase-emulators',
						}
					}
				]
			} as NxJsonConfiguration;
		}

		return {};
	}),
	globAsync: jest.fn(() => {
		return new Promise((resolve) => {
			resolve(['fake-path/firebase.json'])
		});
	}),
	updateNxJson: jest.fn()
}))

import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Tree, readJsonFile, NxJsonConfiguration } from '@nx/devkit';

import { initGenerator } from './generator';

describe('init generator', () => {
	let tree: Tree;

	beforeEach(() => {
		tree = createTreeWithEmptyWorkspace();
	});

	it('should run successfully', async () => {
		await initGenerator(tree);
		const nxJson = readJsonFile<NxJsonConfiguration>("nx.json");
		expect(nxJson.plugins.find(x => x["plugin"] === '@nxextensions/nx-firebase')).toBeDefined();
		expect(jest.isMockFunction(readJsonFile)).toBe(true);
		if (isMockFn(readJsonFile)) {
			expect(readJsonFile.mock.calls.length).toBe(2)
		}
	});

	// eslint-disable-next-line @typescript-eslint/ban-types
	function isMockFn(fn: Function): fn is jest.Mock {
		return jest.isMockFunction(fn);
	}
});
