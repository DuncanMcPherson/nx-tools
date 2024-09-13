import isMockFunction = jest.isMockFunction;

jest.mock('@nx/devkit', () => ({
  readProjectsConfigurationFromProjectGraph: jest.fn(() => ({
    projects: {
      test: {
        root: 'apps/test',
        name: 'test',
        targets: {
          serve: {
            configurations: {
              production: 'test',
            },
          },
          'serve-static': {},
        },
      },
    },
  })),
  createProjectGraphAsync: jest.fn(() => Promise.resolve({})),
  joinPathFragments: jest.fn((...paths: string[]) =>
    paths.map((p) => p.split(/\\\//).join('/')).join('/')
  ),
  getWorkspaceLayout: jest.fn(() => ({ appsDir: 'apps' })),
  addProjectConfiguration: jest.fn(),
  offsetFromRoot: jest.fn((path: string) => {
    const segmentCount = (path.match(/[\\/]/g) || []).length + 1;
    return Array.from({ length: segmentCount }, () => '..').join('/');
  }),
  generateFiles: jest.fn(
    (tree: Tree, templatesPath: string, destinationPath: string) => {
      tree['recordedChanges'][`${destinationPath}${templatesPath}`] = {
        content: [],
        isDeleted: false,
      };
    }
  ),
  targetToTargetString: jest.fn(
    (target: { project: string; target: string; configuration?: string }) => {
      return `${target.project}:${target.target}${
        target.configuration ? ':' : ''
      }${target.configuration ? target.configuration : ''}`;
    }
  ),
  formatFiles: jest.fn(() => Promise.resolve()),
  installPackagesTask: jest.fn(),
  readJson: jest.fn(() => ({
    type: 'module',
  })),
}));

jest.mock('@nx/js', () => ({
  getRelativePathToRootTsConfig: jest.fn(() => '../../tsconfig.base.json'),
}));
jest.mock('../../utils/cypress-version');
jest.mock('../../utils/config');
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import {
  readJson,
  readProjectsConfigurationFromProjectGraph,
  Tree,
} from '@nx/devkit';

import { configGenerator } from './generator';
import { ConfigGeneratorSchema } from './schema';

describe('config generator', () => {
  let tree: Tree;
  let options: ConfigGeneratorSchema;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    jest.spyOn(tree, 'exists').mockImplementation((path) => {
      return path.includes('firebase.json');
    });
    options = {
      projects: 'test',
    };
  });

  it('should run successfully', async () => {
    (await configGenerator(tree, options))();
    const fileChanges = tree.listChanges();
    const newProjectFileChanges = fileChanges.filter((x) =>
      x.path.includes('test-e2e')
    );
    expect(newProjectFileChanges.length).toBeGreaterThanOrEqual(1);
  });

  it('should throw no projects error when no projects passed', async () => {
    options = {} as ConfigGeneratorSchema;
    try {
      (await configGenerator(tree, options))();
    } catch (error) {
      expect(error.message).toEqual('Projects must be provided');
    }
  });

  it('should throw no project exists error when no projects with expected key', async () => {
    options = {
      projects: ['test', 'app'],
    };

    try {
      (await configGenerator(tree, options))();
    } catch (error) {
      expect(error.message).toEqual(
        'Unable to find project configuration for project: app'
      );
    }
  });

  it('should not generate any files when firebase.json does not exist', async () => {
    jest.spyOn(tree, 'exists').mockImplementation(() => false);

    (await configGenerator(tree, options))();
    const fileChanges = tree.listChanges();
    const newProjectFileChanges = fileChanges.filter((x) =>
      x.path.includes('test-e2e')
    );
    expect(newProjectFileChanges.length).toEqual(0);
  });

  it('should not generate any files when project name is undefined', async () => {
    if (isMockFunction(readProjectsConfigurationFromProjectGraph)) {
      readProjectsConfigurationFromProjectGraph.mockImplementation(() => ({
        projects: {
          test: {
            root: 'apps/test',
          },
        },
      }));
    }
    (await configGenerator(tree, options))();
    const fileChanges = tree.listChanges();
    const newProjectFileChanges = fileChanges.filter((x) =>
      x.path.includes('test-e2e')
    );
    expect(newProjectFileChanges.length).toEqual(0);
  });

  it("should throw an error when the new project's directory already exists", async () => {
    if (isMockFunction(readProjectsConfigurationFromProjectGraph)) {
      readProjectsConfigurationFromProjectGraph.mockImplementation(() => ({
        projects: {
          test: {
            root: 'apps/test',
            name: 'test',
            targets: {
              serve: {},
            },
          },
        },
      }));
    }
    jest.spyOn(tree, 'exists').mockImplementation((path) => {
      if (path.includes('firebase.json')) {
        return true;
      }

      return path.includes('-e2e');
    });

    try {
      (await configGenerator(tree, options))();
      // noinspection ExceptionCaughtLocallyJS
      throw new Error('Test failed: Should not have exited gracefully');
    } catch (error) {
      expect(error.message).toEqual(
        'An error occurred while creating the project: apps/test-e2e already exists.'
      );
    }
  });

  it('should generate an esm project when js is true and package.json type is module', async () => {
    options = {
      ...options,
      useJavascript: true,
    };

    (await configGenerator(tree, options))();
    const fileChanges = tree.listChanges();
    const newProjectFileChanges = fileChanges.filter((x) =>
      x.path.includes('config-js-esm')
    );
    expect(newProjectFileChanges.length).toBeGreaterThanOrEqual(1);
  });

  it('should generate a cjs project when js is true and package.json type is not module', async () => {
    options = {
      ...options,
      useJavascript: true,
    };
    if (isMockFunction(readJson)) {
      readJson.mockImplementation(() => ({
        type: 'any',
      }));
    }
    jest.spyOn(tree, 'exists').mockImplementation((path) => {
      if (path.includes('firebase.json')) {
        return true;
      }

      return path.includes('package.json');
    });

    (await configGenerator(tree, options))();
    const fileChanges = tree.listChanges();
    const newProjectFileChanges = fileChanges.filter((x) =>
      x.path.includes('config-js-cjs')
    );
    expect(newProjectFileChanges.length).toEqual(1);
  });

  it('should not generate v10 files or cypress.config.ts file when no serve target exists', async () => {
    if (isMockFunction(readProjectsConfigurationFromProjectGraph)) {
      readProjectsConfigurationFromProjectGraph.mockImplementation(() => ({
        projects: {
          test: {
            root: 'apps/test',
            name: 'test',
            targets: {},
          },
        },
      }));
    }

    (await configGenerator(tree, options))();
    const fileChanges = tree.listChanges();
    const newProjectFileChanges = fileChanges.filter(
      (x) => x.path.includes('v10') || x.path.includes('cypress.config')
    );
    expect(newProjectFileChanges.length).toEqual(0);
  });
});
