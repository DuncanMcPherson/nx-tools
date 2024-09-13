import { PromiseExecutor } from '@nx/devkit';
import { ChildProcess, spawn } from 'child_process';

export interface DeployExecutorSchema {
  cwd: string;
  only?: string[];
}

const runExecutor: PromiseExecutor<DeployExecutorSchema> = async (options) => {
  const commandString = createCommand(options);
  let success = true;
  const cp = spawn(commandString, {
    stdio: 'inherit',
    cwd: options.cwd,
    shell: true,
    detached: process.platform !== 'win32',
  });

  cp.on('exit', (code) => {
    success = code === 0;
  });
  await waitForProcess(cp);
  return {
    success,
  };
};

function createCommand(options: DeployExecutorSchema): string {
  let commandString = 'npx firebase deploy';

  if (options.only) {
    commandString += ` --only ${options.only.join(',')}`;
  }

  return commandString;
}

async function waitForProcess(cp: ChildProcess): Promise<void> {
  return new Promise((res) => {
    cp.on('exit', () => res());
  });
}

export default runExecutor;
