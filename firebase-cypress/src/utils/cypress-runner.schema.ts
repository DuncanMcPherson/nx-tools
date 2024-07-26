// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Json = { [k: string]: any};

export interface CypressRunnerSchema {
  baseUrl?: string;
  cypressConfig: string;
  browser?: string;
  env?: Record<string, string>;
  spec?: string;
  tag?: string;
  exit?: boolean;
  headed?: boolean;
  runnerUi?: boolean;
  headless?: boolean;
  record?: boolean;
  key?: string;
  parallel?: boolean;
  ciBuildId?: string | number;
  group?: string;
  testingType?: 'component' | 'e2e';
  ignoreTestFiles?: string | string[];
  reporter?: string;
  reporterOptions?: string | Json;
  quiet?: boolean;
  autoCancelAfterFailures?: boolean | number;
  watch?: boolean;
  ctTailwindPath?: string;
  portLockFilePath?: string;
}
