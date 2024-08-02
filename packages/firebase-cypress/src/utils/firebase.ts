import {
	ExecutorContext,
	readProjectsConfigurationFromProjectGraph,
	readJsonFile, runExecutor
} from '@nx/devkit';
import { readdirSync } from 'fs';
import { join } from 'path';
import { targetStringToTarget } from './target-string-to-target';
import { CypressRunnerSchema } from './cypress-runner.schema';
import startDevServer from './dev-server';

export function detectFirebase(context: ExecutorContext): {
  isPresent: boolean;
} {
  const projectName = context.projectName;
  const projects = readProjectsConfigurationFromProjectGraph(
    context.projectGraph
  );
  const dependencyName = projects.projects[projectName].implicitDependencies[0];
  const dependency = projects.projects[dependencyName];
  const siblingFiles = readdirSync(join(context.root, dependency.root));
  if (!siblingFiles.includes('firebase.json')) {
    return { isPresent: false };
  }

  const { hasEmulators } = getPortForFirebaseEmulator(
    join(context.root, dependency.root, 'firebase.json')
  );

  return hasEmulators
    ? { isPresent: true }
    : { isPresent: false };
}

function getPortForFirebaseEmulator(firebaseJsonPath: string): {
  hasEmulators: boolean;
} {
  const firebaseConfig = readJsonFile(firebaseJsonPath);
  if (!firebaseConfig?.emulators) {
    return { hasEmulators: false };
  }
  let port: number;
  Object.keys(firebaseConfig.emulators).forEach((key) => {
    if (!port) {
      port = firebaseConfig.emulators[key]?.port;
    }
  });

  if (!port) {
    return { hasEmulators: false };
  }

  return { hasEmulators: true };
}

export async function *startFirebaseEmulators(
  watch: boolean, command: string, options: CypressRunnerSchema, context: ExecutorContext
): AsyncGenerator<{ success: boolean }> {
	const target = targetStringToTarget(command);

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	for await (const _s of await runExecutor<{success: boolean, killProcess: () => void}>(target, {}, context)) {
		if (!_s.success) {
			_s.killProcess();
			yield { success: false };
			break;
		}
		for await (const res of startDevServer(options.webServerCommand ?? options.devServerTarget, options.watch, options, context)) {
			yield res;
		}

		if (!watch) {
			_s.killProcess();
			break;
		}
	}
}
