import { nxE2EPreset } from '@firebase-tools/firebase-cypress';

import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    ...nxE2EPreset(__filename, {
      cypressDir: 'src',
      webServerCommands: {
        default: 'nx run test-angular:serve:development',
        production: 'nx run test-angular:serve:production',
      },
      ciWebServerCommand: 'nx run test-angular:serve-static',
    }),
    baseUrl: 'http://localhost:4200',
  },
});
