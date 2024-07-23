import {ExecutorContext, PromiseExecutor, readJsonFile, readProjectsConfigurationFromProjectGraph} from '@nx/devkit';
import {RunExecutorSchema} from './schema';
import {readdirSync} from "fs";
import {join} from "path";
import {spawn} from "child_process";
import {request as httpRequest} from 'http';
import {request as httpsRequest} from 'https';
import runCypressInternal from "../../utils/run-cypress";

const runExecutor: PromiseExecutor<RunExecutorSchema> = async (options, context) => {
  const projectName = context.projectName;
  const projects = readProjectsConfigurationFromProjectGraph(context.projectGraph);
  const dependencyProjectName = projects.projects[projectName].implicitDependencies[0];
  const dependencyProject = projects.projects[dependencyProjectName];
  const siblingFiles = readdirSync(join(context.root, dependencyProject.root));
  if (siblingFiles.includes('firebase.json')) {
    console.log('Running with emulators');
    return await runCypressWithEmulators(options, context.root, dependencyProject.root, context);
  } else {
    console.log("Running without emulators");
    return runCypress(options, context);
  }
};

async function runCypress(options: RunExecutorSchema, context: ExecutorContext): Promise<{ success: boolean }> {
  options = normalizeOptions(options);
  return runCypressInternal(options, context);
}

function normalizeOptions(options: RunExecutorSchema): RunExecutorSchema {
  options ??= {} as RunExecutorSchema;
  options.watch = options.watch ?? false;

  return options;
}

async function runCypressWithEmulators(options: RunExecutorSchema, workspaceRoot: string, projectRoot: string, context: ExecutorContext) {
  const firebaseConfig = readJsonFile(join(workspaceRoot, projectRoot, 'firebase.json'));
  let result: { success: boolean };

  if (firebaseConfig?.emulators) {
    let port: number;
    let portCheck: number = 0;
    const emulatorTypes = ['auth', 'functions', 'firestore', 'database', 'hosting', 'pubsub', 'storage', 'eventarc', 'dataconnect'];
    do {
      const emulator = firebaseConfig.emulators[emulatorTypes[portCheck++]];
      if (emulator?.port) {
        port = emulator.port;
      }
    } while (port === undefined)

    // TODO: start emulators
    const emulatorsStartedExternally = await isServerUp(port);
    let killEmulators: () => void;
    if (!emulatorsStartedExternally) {
      killEmulators = startEmulators(projectRoot);
    }
    await waitForServer(port);
    result = await runCypress(options, context);
    // TODO: kill emulators
    if (!emulatorsStartedExternally && killEmulators) {
      killEmulators();
    }
  } else {
    result = await runCypress(options, context);
  }

  return result;
}

function startEmulators(workingDirectory: string): () => void {
  const serverProcess = spawn('npx firebase emulators:start', {
    cwd: workingDirectory,
    shell: true,
    detached: process.platform !== 'win32',
    stdio: 'inherit'
  });

  return () => {
    if (process.platform === 'win32') {
      spawn("taskkill", ["/pid", serverProcess.pid.toString(), "/f", '/t']);
    } else {
      process.kill(-serverProcess.pid, "SIGINT");
    }
  }
}

async function waitForServer(port?: number, url?: string): Promise<void> {
  if (port) {
    url = `http://127.0.0.1:${port}`
  }
  const {protocol} = new URL(url);
  const makeRequest = protocol === "http:" ? httpRequest : httpsRequest;

  return new Promise((resolve, reject) => {
    let pollTimeout: NodeJS.Timeout | null;
    const timeoutDuration = 120 * 1000;

    const timeout = setTimeout(() => {
      clearTimeout(pollTimeout);
      reject(
        new Error(`${port !== undefined ? 'Emulators' : 'Web server'} failed to start in ${timeoutDuration}ms. Cancelling the operation.`)
      );
    }, timeoutDuration);

    function pollForServer() {
      const request = makeRequest(url, () => {
        clearTimeout(timeout);
        resolve();
      });

      request.on('error', () => {
        pollTimeout = setTimeout(pollForServer, 100);
      });

      request.end();
    }

    pollForServer();
  });
}

function isServerUp(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const request = httpRequest(`http://127.0.0.1:${port}`, () => {
      resolve(true);
    });

    request.on('error', () => {
      resolve(false);
    });

    request.end();
  })
}

export default runExecutor;
