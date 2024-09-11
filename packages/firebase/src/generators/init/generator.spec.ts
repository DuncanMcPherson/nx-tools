import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Tree, readProjectConfiguration } from '@nx/devkit';

import { initGenerator } from './generator';

describe('init generator', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should run successfully', async () => {
    await initGenerator(tree);
    const config = readProjectConfiguration(tree, 'test');
    expect(config).toBeDefined();
  });
});
