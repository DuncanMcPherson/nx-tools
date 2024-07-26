import { CypressRunnerSchema } from '../../utils/cypress-runner.schema';

export interface RunExecutorSchema extends CypressRunnerSchema {
  webServerCommand?: string;
  cwd?: string;
  devServerTarget?: string;
  skipServe?: boolean;
  port?: number | 'cypress-auto';
}
