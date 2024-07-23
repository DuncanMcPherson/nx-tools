import {RunExecutorSchema} from "../executors/run/schema";
import {
  ExecutorContext,
  logger,
  output,
  parseTargetString, readTargetOptions,
  runExecutor,
  stripIndents,
  Target,
  targetToTargetString
} from "@nx/devkit";
import {dirname, join, basename} from "path";
import {getExecutorInformation} from "nx/src/command-line/run/executor-utils";
import {existsSync, readdirSync, writeFileSync, unlinkSync} from "fs";
import * as detectPort from 'detect-port';
import { installedCypressVersion } from "./cypress-version";

const Cypress = require('cypress');

export default async function runCypressInternal(options: RunExecutorSchema, context: ExecutorContext): Promise<{
  success: boolean
}> {
  process.env.NX_CYPRESS_TARGET_CONFIGURATION = context.configurationName;
  let success: boolean;

  // for await (const devServerValues of startDevServer(options, context)) {
  //   try {
  //     success = await runCypress(devServerValues.baseUrl, {
  //       ...options,
  //       portLockFilePath: devServerValues.portLockFilePath
  //     });
  //     if (!options.watch) break;
  //   } catch (e) {
  //     logger.error(e.message);
  //     success = false;
  //     if (!options.watch) break;
  //   }
  // }
  success = await runCypress(options.baseUrl, options);

  return {
    success
  };
}

async function* startDevServer(opts: Omit<RunExecutorSchema, "cypressConfig">, context: ExecutorContext) {
  if (!opts.devServerTarget || opts.skipServe) {
    yield {baseUrl: opts.baseUrl};
    return;
  }

  const parsedDevServerTarget = parseTargetString(
    opts.devServerTarget,
    context
  );

  const [targetSupportsWatchOpt] = getValueFromSchema(context, parsedDevServerTarget, 'watch');

  const overrides: Record<string, any> = {
    ...(targetSupportsWatchOpt ? {watch: opts.watch} : {})
  };

  if (opts.port === 'cypress-auto') {
    overrides['port'] = await getPortForProject(context, parsedDevServerTarget);
  } else if (opts.port !== undefined) {
    overrides['port'] = opts.port;
    if (opts.port !== 0) {
      const didLock = attemptToLockPort(opts.port);
      if (!didLock) {
        console.warn(stripIndents`${opts.port} is potentially already in use by another cypress run.
        If the port is in use, try using a different port value of passing --port='cypress-auto' to find a free port`);
      }
    }
  }

  for await (const output of await runExecutor<{
    success: boolean;
    baseUrl?: string;
    port?: string;
    info?: { port: number; baseUrl?: string };
  }>(parsedDevServerTarget, overrides, context)) {
    if (!output.success && !opts.watch) {
      throw new Error('Could not compile application files');
    }
    if (
      !opts.baseUrl &&
      !output.baseUrl &&
      !output.info?.baseUrl &&
      (output.port || output.info?.port)) {
      output.baseUrl = `http://localhost:${output.port ?? output.info?.port}`
    }
    yield {
      baseUrl: opts.baseUrl || output.baseUrl || output.info?.baseUrl,
      portLockFilePath: overrides.port && join(__dirname, `${overrides.port}.txt`)
    };
  }
}

async function getPortForProject(
  context: ExecutorContext,
  target: Target,
  defaultPort = 4200
) {
  const fmtTarget = targetToTargetString(target);
  const [hasPortOpt, schemaPortValue] = getValueFromSchema(
    context,
    target,
    'port'
  );

  let freePort: number | undefined;

  if (hasPortOpt) {
    let normalizedPortValue: number;
    if (!schemaPortValue) {
      logger.info(
        `NX ${fmtTarget} did not have a defined port value, checking for free port with the default value of ${defaultPort}`
      );
      normalizedPortValue = defaultPort;
    } else {
      normalizedPortValue = Number(schemaPortValue);
    }

    if (isNaN(normalizedPortValue)) {
      output.warn({
        title: 'Port Not a Number',
        bodyLines: [
          `The port value found was not a number or can't be parsed to a number`,
          `When reading the devServerTarget (${fmtTarget}) schema, expected ${schemaPortValue} to be a number but got NaN.`,
          `Nx will use the default value of ${defaultPort} instead.`,
          `You can manually specify a port by setting the 'port' option`,
        ]
      });
      normalizedPortValue = defaultPort;
    }
    try {
      let attempts = 0;

      do {
        freePort = await detectPort(freePort || normalizedPortValue);
        if (attemptToLockPort(freePort)) {
          break;
        }
        attempts++;
        freePort++;
      } while (attempts < 20);

      logger.info(`NX using port ${freePort} for ${fmtTarget}`);
    } catch (err) {
      throw new Error(
        stripIndents`Unable to find a free port for the dev server, ${fmtTarget}.
You can disable auto port detection by specifying a port or not passing a value to --port`
      );
    }
  } else {
    output.warn({
      title: `No Port Option Found`,
      bodyLines: [
        `The 'port' option is set to 'cypress-auto', but the devServerTarget (${fmtTarget}) does not have a port option.`,
        `Because of this, Nx is unable to verify the port is free before starting the dev server.`,
        `This might cause issues if the devServerTarget is trying to use a port that is already in use.`,
      ],
    });
  }

  return freePort;
}

function getValueFromSchema(
  context: ExecutorContext,
  target: Target,
  property: string
): [hasPropertyOpt: boolean, value?: unknown] {
  let targetOpts: any;
  try {
    targetOpts = readTargetOptions(target, context);
  } catch (e) {
    throw new Error(`Unable to read the target options for  ${targetToTargetString(
      target
    )}.
Are you sure this is a valid target?
Was trying to read the target for the property: '${property}', but got the following error:
${e.message || e}`);
  }
  let targetHasOpt = Object.keys(targetOpts).includes(property);

  if (!targetHasOpt) {
    const projectConfig = context.projectsConfigurations?.projects?.[target.project];
    const targetConfig = projectConfig.targets[target.target];

    const [collection, executor] = targetConfig.executor.split(':');
    const { schema } = getExecutorInformation(
      collection,
      executor,
      context.root,
      context.projectsConfigurations.projects
    );

    targetHasOpt = Object.keys(schema.properties).includes(property);
  }
  return [targetHasOpt, targetOpts[property]];
}

function attemptToLockPort(port: number): boolean {
  const portLockFilePath = join(__dirname, `${port}.txt`);
  try {
    if (existsSync(portLockFilePath)) {
      return false;
    }

    writeFileSync(portLockFilePath, 'locked');
    return true;
  } catch {
    return false;
  }
}

async function runCypress(baseUrl: string, opts: RunExecutorSchema): Promise<boolean> {
  const cypressVersion = installedCypressVersion();
  const projectFolderPath = dirname(opts.cypressConfig);
  const options: any = {
    project: projectFolderPath,
    configFile: basename(opts.cypressConfig)
  };

  if (baseUrl) {
    options.config = { baseUrl }
  }

  if (opts.browser) {
    options.browser = opts.browser;
  }

  if (opts.env) {
    options.env = {
      ...options.env,
      ...opts.env
    };
  }

  if (opts.spec) {
    options.spec = opts.spec;
  }

  options.tag = opts.tag;
  options.exit = opts.exit;
  options.headed = opts.headed;
  options.runnerUi = opts.runnerUi;

  if (opts.headless) {
    options.headless = opts.headless;
  }

  options.record = opts.record;
  options.key = opts.key;
  options.parallel = opts.parallel;
  options.ciBuildId = opts.ciBuildId?.toString();
  options.group = opts.group;

  if (cypressVersion >= 10) {
    options.config ??= {};
    options.config[opts.testingType] = {
      excludeSpecPattern: opts.ignoreTestFiles
    };
  } else {
    options.ignoreTestFiles = opts.ignoreTestFiles;
  }

  if (opts.reporter) {
    options.reporter = opts.reporter;
  }

  if (opts.reporterOptions) {
    options.reporterOptions = opts.reporterOptions;
  }
  if (opts.quiet) {
    options.quiet = opts.quiet;
  }

  if (opts.autoCancelAfterFailures !== undefined) {
    options.autoCancelAfterFailures = opts.autoCancelAfterFailures;
  }

  options.testingType = opts.testingType;

  const result = await (
    opts.watch
    ? Cypress.open(options)
      : Cypress.run(options)
  );

  cleanupTmpFile(opts.ctTailwindPath);
  cleanupTmpFile(opts.portLockFilePath);

  if (process.env.NX_VERBOSE_LOGGING === 'true' && opts.portLockFilePath) {
    readdirSync(dirname(opts.portLockFilePath)).forEach((f) => {
      if (f.endsWith('.txt')) {
        logger.debug(`Lock file ${f} still present`);
      }
    });
  }

  return !result.totalFailed && !result.failures;
}

function cleanupTmpFile(path: string) {
  try {
    if (path && existsSync(path)) {
      unlinkSync(path);
    }
    return true;
  } catch {
    return false;
  }
}
