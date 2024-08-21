"use strict";
const devkit = require('@nx/devkit');
const fs = require('fs');

function revertExecutorsAndGenerators() {
	if (fs.existsSync('./executors.json')) {
		const executorsJson = devkit.readJsonFile('./executors.json');
		Object.keys(executorsJson.executors).forEach((key) => {
			executorsJson.executors[key].implementation = executorsJson.executors[key].implementation.split('/').filter(x => x !== 'dist').join('/');
			executorsJson.executors[key].schema = executorsJson.executors[key].schema.split('/').filter(x => x !== 'dist').join('/');
		});
		devkit.writeJsonFile('./executors.json', executorsJson);
	}

	if (fs.existsSync('./generators.json')) {
		const generatorsJson = devkit.readJsonFile('./generators.json');
		Object.keys(generatorsJson.generators).forEach((key) => {
			generatorsJson.generators[key].factory = generatorsJson.generators[key].factory.split('/').filter(x => x !== 'dist').join('/');
			generatorsJson.generators[key].schema = generatorsJson.generators[key].schema.split('/').filter(x => x !== 'dist').join('/');
		});
		devkit.writeJsonFile('./generators.json', generatorsJson);
	}
}

revertExecutorsAndGenerators();
