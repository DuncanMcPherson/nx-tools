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
}));
jest.mock('@nx/devkit/src/utils/calculate-hash-for-create-nodes', () => ({
  calculateHashForCreateNodes: jest.fn(() => {
    const length = Math.floor(Math.random() * 100);
    const options = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k'];
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
    const projectData = result[Object.keys(result)[0]];
    expect(projectData).toBeDefined();
    expect(projectData.targets['serve-firebase']).toBeDefined();
  });
});
