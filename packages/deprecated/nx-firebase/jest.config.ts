/* eslint-disable */
export default {
	displayName: 'nx-firebase',
	preset: '../../../jest.preset.js',
	transform: {
		'^.+\\.[tj]s$': [
			'ts-jest',
			{ tsconfig: '<rootDir>/tsconfig.spec.json' },
		],
	},
	moduleFileExtensions: ['ts', 'js', 'html'],
	coverageDirectory: '../../../coverage/packages/deprecated/nx-firebase',
};
