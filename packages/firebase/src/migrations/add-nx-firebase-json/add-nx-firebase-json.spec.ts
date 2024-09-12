jest.mock('@nx/devkit', () => ({
  createProjectGraphAsync: jest.fn(() =>
    Promise.resolve({
      nodes: {},
      version: '1',
    } as ProjectGraph)
  ),
  readProjectsConfigurationFromProjectGraph: jest.fn(
    (): ProjectsConfigurations => {
      return {
        projects: {
          'test-project': {
            root: 'apps/test-project',
            projectType: 'application',
            targets: {
              serve: {},
            },
          },
        },
        version: 2,
      };
    }
  ),
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
import {
  ProjectGraph,
  ProjectsConfigurations,
  Tree,
  readProjectsConfigurationFromProjectGraph,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';

import update from './add-nx-firebase-json';

describe('add-nx-firebase-json migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    jest.spyOn(tree, 'exists').mockImplementation((filePath) => {
      return !filePath.includes('nx-firebase.json');
    });
  });

  it("should generate an nx-firebase.json if it doesn't exist", async () => {
    await update(tree);
    // ... expect changes made
    const changes = tree.listChanges();
    const nxFirebaseChange = changes.find((c) =>
      c.path.includes('nx-firebase.json')
    );
    expect(nxFirebaseChange).toBeDefined();
    expect(nxFirebaseChange.type).toEqual('CREATE');
  });

  it("should not generate an nx-firebase.json if it doesn't exist and there is no firebase.json", async () => {
    jest.spyOn(tree, 'exists').mockImplementation(() => false);
    await update(tree);
    const changes = tree.listChanges();
    const nxFirebaseChange = changes.find((c) =>
      c.path.includes('nx-firebase.json')
    );
    expect(nxFirebaseChange).not.toBeDefined();
  });

  it('should not generate any files if nx-firebase.json exists', async () => {
    jest.spyOn(tree, 'exists').mockImplementation(() => true);
    await update(tree);
    const changes = tree.listChanges();
    const nxFirebaseChange = changes.find((c) =>
      c.path.includes('nx-firebase.json')
    );
    expect(nxFirebaseChange).not.toBeDefined();
  });

  it('should generate 2 files when 2 valid projects exist', async () => {
    if (isMockFn(readProjectsConfigurationFromProjectGraph)) {
      readProjectsConfigurationFromProjectGraph.mockImplementation(() => {
        return {
          projects: {
            test1: {
              root: 'apps/test1',
              projectType: 'application',
              targets: {
                serve: {},
              },
            },
            test2: {
              root: 'apps/test2',
              projectType: 'application',
              targets: {
                'serve-static': {},
              },
            },
          },
        };
      });
    }

    await update(tree);
    const changes = tree.listChanges();
    const projectChanges = changes.filter((c) =>
      c.path.includes('nx-firebase.json')
    );
    expect(projectChanges).toBeDefined();
    expect(projectChanges.length).toEqual(2);
  });

  it('should generate 1 file when only 1 of the projects is missing nx-firebase.json', async () => {
    if (isMockFn(readProjectsConfigurationFromProjectGraph)) {
      readProjectsConfigurationFromProjectGraph.mockImplementation(() => {
        return {
          projects: {
            test1: {
              root: 'apps/test1',
              projectType: 'application',
              targets: {
                serve: {},
              },
            },
            libProject: {
              root: 'libs/libProject',
              projectType: 'library',
            },
            test2: {
              root: 'apps/test2',
              projectType: 'application',
              targets: {
                'serve-static': {},
              },
            },
          },
        };
      });
    }
    jest.spyOn(tree, 'exists').mockImplementation((path) => {
      if (path.includes('test2')) {
        return !path.includes('nx-firebase.json');
      }
      return true;
    });

    await update(tree);
    const changes = tree.listChanges();
    const projectChanges = changes.filter((c) =>
      c.path.includes('nx-firebase')
    );
    expect(projectChanges).toBeDefined();
    expect(projectChanges.length).toEqual(1);
  });
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isMockFn(fn: any): fn is jest.MockedFn<any> {
  return jest.isMockFunction(fn);
}
