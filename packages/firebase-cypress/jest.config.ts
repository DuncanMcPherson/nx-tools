/* eslint-disable */
export default {
  displayName: 'firebase-cypress',
  preset: '../../jest.preset.js',
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  transformIgnorePatterns: ['node_modules/(?!.*\\.mjs$|@nx)'],
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/packages/firebase-cypress',
  reporters: [
    'default',
    [
      'jest-junit',
      {
        outputDirectory: '<rootDir>/../../test-results',
        outputName: 'firebase-cypress.xml',
      },
    ],
  ],
};
