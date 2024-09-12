jest.mock('@nx/devkit', () => ({
  readNxJson: jest.fn(() => ({
    useInferencePlugins: true,
  })),
  getPackageManagerCommand: jest.fn(() => ({ exec: 'npx' })),
  createProjectGraphAsync: jest.fn(() => Promise.resolve({})),
  readProjectsConfigurationFromProjectGraph: jest.fn(() => ({
    projects: {
      test: {
        root: 'apps/test',
        targets: {
          serve: {},
        },
      },
    },
  })),
  joinPathFragments: jest.fn((...paths: string[]) => {
    return paths.map((part) => part.split(/[/\\]/).join('/')).join('/');
  }),
  generateFiles: jest.fn((tree: Tree, _, targetDir) => {
    tree['recordedChanges'][`${targetDir}/nx-firebase.json`] = {
      content: [],
      isDeleted: false,
      options: undefined,
    };
  }),
  formatFiles: jest.fn(() => Promise.resolve()),
}));
jest.mock('@nx/devkit/src/utils/add-plugin', () => ({
  addPlugin: jest.fn(() => Promise.resolve()),
}));

import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Tree } from '@nx/devkit';

import { initGenerator } from './generator';

describe('init generator', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    jest.spyOn(tree, 'exists').mockImplementation(() => true);
  });

  it('should run successfully', async () => {
    await initGenerator(tree);
    const changes = tree.listChanges();
    const nxFirebaseJsonChange = changes.find((change) =>
      change.path.includes('nx-firebase.json')
    );
    expect(nxFirebaseJsonChange).toBeDefined();
    expect(nxFirebaseJsonChange.type).toEqual('CREATE');
  });
});
