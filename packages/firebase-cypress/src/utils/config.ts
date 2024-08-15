import type {
	ObjectLiteralExpression,
	PropertyAssignment,
} from 'typescript';
import type {
	NxCypressE2EPresetOptions,
} from '../cypress-preset';

export const CYPRESS_CONFIG_FILE_NAME_PATTERN = 'cypress.config.{js,ts,mjs,cjs}';
const TS_QUERY_COMMON_JS_EXPORT_SELECTOR = 'BinaryExpression:has(Identifier[name="module"]):has(Identifier[name="exports"])';
const TS_QUERY_EXPORT_CONFIG_PREFIX = `:matches(ExportAssignment, ${TS_QUERY_COMMON_JS_EXPORT_SELECTOR}) `;

export async function addDefaultE2eConfig(
	cyConfigContents: string,
	options: NxCypressE2EPresetOptions,
	baseUrl: string
) {
	if (!cyConfigContents) {
		throw new Error('The selected cypress config file is empty!');
	}
	const { tsquery } = await import('@phenomnomnominal/tsquery');

	const isCommonJS = tsquery.query(cyConfigContents, TS_QUERY_COMMON_JS_EXPORT_SELECTOR).length > 0;
	const testingTypeConfig = tsquery.query<PropertyAssignment>(
		cyConfigContents,
		`${TS_QUERY_EXPORT_CONFIG_PREFIX} PropertyAssignment:has(Identifier[name"e2e"])`,
	);

	let updatedConfigContents = cyConfigContents;

	if (testingTypeConfig.length === 0) {
		const configValue = `nxE2EPreset(__filename, ${JSON.stringify(options)})`;
		updatedConfigContents = tsquery.replace(
			cyConfigContents,
			`${TS_QUERY_EXPORT_CONFIG_PREFIX} ObjectLiteralExpression:first-child`,
			(node: ObjectLiteralExpression) => {
				const baseUrlContents = baseUrl ? `,\nbaseUrl: '${baseUrl}'` : '';
				if (node.properties.length > 0) {
					return `{
					${node.properties.map((p) => p.getText()).join(',\n')},
					e2e: { ...${configValue}${baseUrlContents} }
					}`;
				}
				return `{
				e2e: { ...${configValue}${baseUrlContents} }
				}`;
			}
		);

		return isCommonJS
			? `const { nxE2EPreset } = require('@nxextensions/firebase-cypress');

			${updatedConfigContents}`
			: `import { nxE2EPreset } from '@nxextensions/firebase-cypress';

			${updatedConfigContents}`;
	}
	return updatedConfigContents;
}
