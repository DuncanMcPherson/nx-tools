import { execSync } from 'child_process';
import { join, dirname } from 'path';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'fs';

describe('firebase-cypress', () => {
  let projectDirectory: string;

  beforeAll(() => {
    projectDirectory = createTestProject();

    // The plugin has been built and published to a local registry in the jest globalSetup
    // Install the plugin built with the latest source code into the test repo
    execSync(`npm install @nxextensions/firebase-cypress@e2e`, {
      cwd: projectDirectory,
      stdio: 'inherit',
      env: process.env,
    });
  });

  afterAll(() => {
    // Cleanup the test project
    if (projectDirectory) {
      rmSync(projectDirectory, {
        recursive: true,
        force: true,
      });
    }
  });

  it('should be installed', () => {
    // npm ls will fail if the package is not installed properly
    execSync('npm ls @nxextensions/firebase-cypress', {
      cwd: projectDirectory,
      stdio: 'inherit',
    });
  });

  it('should create the e2e project properly', () => {
    console.log('Removing old cypress e2e project');
    rmSync(join(projectDirectory, 'apps/test-project-e2e'), {
      recursive: true,
      force: true,
    });

    console.log('ensuring state of workspace:');
    expect(existsSync(join(projectDirectory, 'apps/test-project-e2e'))).toEqual(
      false
    );
    console.log(
      `Result (test-project-e2e): ${existsSync(
        join(projectDirectory, 'apps', 'test-project-e2e')
      )}`
    );
    expect(existsSync(join(projectDirectory, 'apps/test-project'))).toEqual(
      true
    );
    console.log(
      `Result (test-project): ${existsSync(
        join(projectDirectory, 'apps', 'test-project')
      )}`
    );

    console.log('initializing firebase cypress');
    execSync('nx g @nxextensions/firebase-cypress:init', {
      cwd: projectDirectory,
      stdio: 'inherit',
    });

    console.log('validating that proper directory exists');
    expect(existsSync(join(projectDirectory, 'apps/test-project-e2e'))).toEqual(
      true
    );
  });
});

/**
 * Creates a test project with create-nx-workspace and installs the plugin
 * @returns The directory where the test project was created
 */
function createTestProject() {
  const projectName = 'test-project';
  const projectDirectory = join(process.cwd(), 'tmp', projectName);

  // Ensure projectDirectory is empty
  rmSync(projectDirectory, {
    recursive: true,
    force: true,
  });
  mkdirSync(dirname(projectDirectory), {
    recursive: true,
  });

  execSync(
    `npx --yes create-nx-workspace@latest ${projectName} --preset angular-monorepo --ssr false --nxCloud=skip --appName ${projectName} --bundler esbuild --style scss --e2eTestRunner cypress`,
    {
      cwd: dirname(projectDirectory),
      stdio: 'inherit',
      env: process.env,
    }
  );
  console.log(`Created test project in "${projectDirectory}"`);

  convertAppToFirebaseApp(join(projectDirectory, 'apps', projectName));

  return projectDirectory;
}

function convertAppToFirebaseApp(projectRoot: string): void {
  const firebaseJson = {
    emulators: {
      auth: {
        port: 9099,
      },
      database: {
        port: 9000,
      },
      singleProjectMode: true,
      ui: {
        enabled: true,
      },
    },
  };
  const firebaseJsonPath = join(projectRoot, 'firebase.json');
  writeFileSync(firebaseJsonPath, JSON.stringify(firebaseJson));
  console.log(`Created firebase.json configuration at: ${firebaseJsonPath}`);
}
