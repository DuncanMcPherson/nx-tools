import {ExecutorContext, readProjectsConfigurationFromProjectGraph, readJsonFile} from "@nx/devkit";
import {readdirSync} from 'fs';
import {join} from 'path';
import request from "./request";
import {spawn} from "child_process";

export function detectFirebase(context: ExecutorContext): { isPresent: boolean, portNumber?: number, projectRoot?: string } {
  const projectName = context.projectName;
  const projects = readProjectsConfigurationFromProjectGraph(context.projectGraph);
  const dependencyName = projects.projects[projectName].implicitDependencies[0];
  const dependency = projects.projects[dependencyName];
  const siblingFiles = readdirSync(join(context.root, dependency.root));
  if (!siblingFiles.includes("firebase.json")) {
    return {isPresent: false};
  }

  const {hasEmulators, portNumber} = getPortForFirebaseEmulator(join(context.root, dependency.root, 'firebase.json'));

  return hasEmulators ? {isPresent: true, portNumber, projectRoot: dependency.root} : {isPresent: false};
}

function getPortForFirebaseEmulator(firebaseJsonPath: string): { hasEmulators: boolean, portNumber?: number } {
  const firebaseConfig = readJsonFile(firebaseJsonPath);
  if (!firebaseConfig?.emulators) {
    return {hasEmulators: false};
  }
  let port: number;
  Object.keys(firebaseConfig.emulators).forEach((key) => {
    if (!port) {
      port = firebaseConfig.emulators[key]?.port;
    }
  });

  if (!port) {
    return {hasEmulators: false};
  }

  return {hasEmulators: true, portNumber: port};
}

export async function startFirebaseEmulators(cwd: string, port: number): Promise<(() => void) | undefined> {
  const emulatorsStartedExternally = await isServerUp(port);
  let killEmulators: () => void;
  if (!emulatorsStartedExternally) {
    killEmulators = startEmulators(cwd);
  }
  await waitForServer(port);
  return killEmulators;
}

function isServerUp(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    return request(`http://127.0.0.1: ${port}`, () => {
      resolve(true);
    }, () => {
      resolve(false);
    });
  });
}

function startEmulators(cwd: string): () => void {
  const emulatorProcess = spawn('npx firebase:emulators:start', {
    cwd,
    shell: true,
    detached: true,
    stdio: 'inherit'
  });

  return () => {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', emulatorProcess.pid.toString(), '/f', '/t']);
    } else {
      process.kill(-emulatorProcess.pid, 'SIGINT');
    }
  }
}

async function waitForServer(port: number): Promise<void> {
  const url = `http://127.0.0.1:${port}`;

  return new Promise((resolve, reject) => {
    let pollTimeout: NodeJS.Timeout | null;
    const timeoutDuration = 60 * 1000;

    const timeout = setTimeout(() => {
      clearTimeout(pollTimeout);
      reject(
        new Error(`Emulators failed to start in ${timeoutDuration}ms. Cancelling the operation.`)
      );
    }, timeoutDuration);

    function pollForServer() {
      void request(url, () => {
        clearTimeout(timeout);
        resolve();
      }, () => {
        pollTimeout = setTimeout(pollForServer, 100);
      });
    }

    pollForServer();
  });
}
