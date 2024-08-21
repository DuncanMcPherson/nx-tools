#!usr/bin/env node

"use strict";
const devkit = require('@nx/devkit');
const fs = require('fs');

function processExecutorAndGenerators() {
	console.log('Processing executors and generators...')
	if (fs.existsSync('./executors.json')) {
		const executorsJson = devkit.readJsonFile('./executors.json');
		Object.keys(executorsJson.executors).forEach((key) => {
			const index = 1;
			const implementationPathParts = executorsJson.executors[key].implementation.split("/");
			const newArray = [
				...implementationPathParts.slice(0, index),
				'dist',
				...implementationPathParts.slice(index)
			];
			executorsJson.executors[key].implementation = newArray.join('/');
			console.log(`Implementation path for executor ${key} was updated to: ${newArray.join('/')}`)
			const schemaParts = executorsJson.executors[key].schema.split('/');
			const newSchemaPath = [
				...schemaParts.slice(0, index),
				'dist',
				...schemaParts.slice(index)
			];
			executorsJson.executors[key].schema = newSchemaPath.join('/');
			console.log(`Schema path for executor ${key} was updated to: ${newArray.join('/')}`)
		});
		devkit.writeJsonFile('./executors.json', executorsJson);
	}

	if (fs.existsSync('./generators.json')) {
		const generatorsJson = devkit.readJsonFile('./generators.json');
		Object.keys(generatorsJson.generators).forEach((key) => {
			const index = 1;
			const factoryPathParts = generatorsJson.generators[key].factory.split("/");
			const newArray = [
				...factoryPathParts.slice(0, index),
				'dist',
				...factoryPathParts.slice(index)
			];
			const newFactoryPath = newArray.join('/');
			generatorsJson.generators[key].factory = newFactoryPath;
			console.log(`Factory path for generator ${key} was updated to: ${newFactoryPath}`)
			const schemaParts = generatorsJson.generators[key].schema.split('/');
			const newSchemaPath = [
				...schemaParts.slice(0, index),
				'dist',
				...schemaParts.slice(index)
			];
			generatorsJson.generators[key].schema = newSchemaPath.join('/');
			console.log(`Schema path for generator ${key} was updated to: ${newArray.join('/')}`)
		});
		devkit.writeJsonFile('./generators.json', generatorsJson);
	}
}

processExecutorAndGenerators();
