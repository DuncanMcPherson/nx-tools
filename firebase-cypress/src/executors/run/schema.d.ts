export type Json = { [k: string]: any};
export interface RunExecutorSchema extends Json {
  webServerCommand?: string;
  watch?: boolean;
  cwd?: string;
  cypressConfig: string;
  devServerTarget?: string;
  headed?: boolean;
  exit?: boolean;
  key?: string;
  record?: boolean;
  parallel?: boolean;
  baseUrl?: string;
  browser?: string;
  env?: Record<string, string>;
  spec?: string;
  ciBuildId?: string | number;
  group?: string;
  ignoreTestFiles?: string | string[];
  reporter?: string;
  reporterOptions?: string | Json;
  skipServe?: boolean;
  testingType?: 'component' | 'e2e';
  tag?: string;
  port?: number | 'cypress-auto';
  quiet?: boolean;
  runnerUi?: boolean;
  autoCancelAfterFailures?: boolean | number;
}
