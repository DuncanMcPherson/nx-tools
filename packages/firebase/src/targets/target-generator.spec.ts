jest.mock('fs', () => ({
  readdirSync: jest.fn(() => {
    return ['project.json', 'firebase.json'];
  }),
  existsSync: jest.fn(() => false),
}));

jest.mock('@nx/devkit', () => ({
  getPackageManagerCommand: jest.fn(() => {
    return {
      exec: 'npx',
    };
  }),
  detectPackageManager: jest.fn(() => 'npm'),
  readJsonFile: jest.fn((file: string) => {
    if (file.includes('firebase.json')) {
      return {
        emulators: {
          auth: {
            port: 9099,
          },
          database: {
            port: 9000,
          },
          hosting: {
            port: 5000,
          },
          ui: {
            enabled: true,
          },
        },
      };
    } else if (file.includes('project.json')) {
      return {
        name: 'test-project',
        targets: {
          serve: {},
        },
      };
    }
  }),
  joinPathFragments: jest.fn((...paths: string[]) => {
    return paths.map((part) => part.split(/[/\\]/).join('/')).join('/');
  }),
}));
jest.mock('@nx/devkit/src/utils/calculate-hash-for-create-nodes', () => ({
  calculateHashForCreateNodes: jest.fn(() => {
    const length = Math.floor(Math.random() * 100);
    const options = [
      'a',
      'b',
      'c',
      'd',
      'e',
      'f',
      'g',
      'h',
      'i',
      'j',
      'k',
      'l',
      'm',
      'n',
      'o',
      'p',
      'q',
      'r',
      's',
      't',
      'u',
      'v',
      'w',
      'x',
      'y',
      'z',
      1,
      2,
      3,
      4,
      5,
      6,
      7,
      8,
      9,
      0,
    ];
    let result = '';
    for (let i = 0; i < length; i++) {
      const index = Math.floor(Math.random() * options.length);
      result += options[index];
    }
    return result;
  }),
}));
jest.mock('nx/src/plugins/js/lock-file/lock-file', () => ({
  getLockFileName: jest.fn(() => 'package-lock.json'),
}));

import { CreateNodesContext, ProjectConfiguration } from '@nx/devkit';
import { createNodesInternal } from './index';

const testPath = 'apps/test-project';

describe('firebase inferred targets', () => {
  it('should return a valid projects object with the proper data', async () => {
    const context: CreateNodesContext = {
      workspaceRoot: '',
      configFiles: [`${testPath}/firebase.json`],
      nxJsonConfiguration: {},
    };
    const targetsCache: Record<
      string,
      Pick<ProjectConfiguration, 'targets' | 'metadata'>
    > = {};
    const result = await createNodesInternal(
      `${testPath}/firebase.json`,
      {},
      context,
      targetsCache
    );
    const projectData = result.projects[Object.keys(result.projects)[0]];
    expect(projectData).toBeDefined();
    expect(projectData.targets['serve-firebase']).toBeDefined();
  });
});
