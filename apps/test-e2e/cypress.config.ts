import { nxE2EPreset } from '@nxextensions/firebase-cypress';

import { defineConfig } from 'cypress';

export default defineConfig({
	e2e: {
		...nxE2EPreset(__filename, {
			cypressDir: 'src',
			webServerCommands: {
				default: 'nx run test:serve',
				production: 'nx run test:serve:production',
			},
		}),
		baseUrl: 'http://localhost:4200',
	},
});
