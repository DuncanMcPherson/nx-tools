import { CypressRunnerSchema } from '../../utils/cypress-runner.schema';

export interface E2eCiExecutorSchema extends CypressRunnerSchema {
  webServerCommand?: string;
  cwd?: string;
  devServerTarget?: string;
  skipServe?: boolean;
  port?: number | 'cypress-auto';
} // eslint-disable-line
