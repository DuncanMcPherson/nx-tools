import {
	createProjectGraphAsync,
	readProjectsConfigurationFromProjectGraph,
	installPackagesTask,
	globAsync,
	Tree,
	ProjectConfiguration,
	getWorkspaceLayout,
	addProjectConfiguration,
	formatFiles,
	joinPathFragments,
	offsetFromRoot, generateFiles, readJson, ProjectGraph, readNxJson,
	targetToTargetString
} from '@nx/devkit';
import { addPlugin as _addPlugin } from '@nx/devkit/src/utils/add-plugin';
import * as readLine from 'readline/promises';
import * as process from 'node:process';
import { getRelativePathToRootTsConfig } from '@nx/js';
import { createNodesV2 } from '../../target-generator';
import { join } from 'path';
import { installedCypressVersion } from '../../utils/cypress-version';
import { addDefaultE2eConfig } from '../../utils/config';

const firebaseJsonGlob = '**/firebase.json';

export interface InitGeneratorSchema {
	js?: boolean;
	jsx?: boolean;
	hasTsConfig?: boolean;
	offsetFromProjectRoot?: string;
	directory?: string;
	addPlugin?: boolean;
	bundler?: 'vite' | 'webpack';
	baseUrl?: string;
}

function normalizeOptions(options: InitGeneratorSchema, project: ProjectConfiguration, tree: Tree) {
	options ??= {};
	options.directory ??= 'src';
	options.js ??= false;
	options.jsx ??= false;

	const offsetFromProjectRoot = options.directory.split('/')
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		.map(_ => '..')
		.join('/');
	options.hasTsConfig = tree.exists(joinPathFragments(project.root, 'tsconfig.json'));
	options.bundler ??= 'webpack';
	options.baseUrl ??= 'http://localhost:4200';
	return {
		...options,
		offsetFromProjectRoot: `${offsetFromProjectRoot}/`,
		projectConfig: project
	};
}

export async function initGenerator(tree: Tree, options: InitGeneratorSchema) {
	// set plugin options
	const nxJson = readNxJson(tree);

	const addPlugins = options.addPlugin = process.env.NX_ADD_PLUGINS !== 'false' &&
		nxJson.useInferencePlugins !== false;
	const graph = await createProjectGraphAsync({ exitOnError: true });

	if (addPlugins) {
		await addPlugin(tree, graph, true)
	}
	// detect projects
	const applicationProjectNames: string[] = [];
	Object.keys(graph.nodes).forEach((p) => {
		if (graph.nodes[p].type === 'app') {
			applicationProjectNames.push(graph.nodes[p].name);
		}
	});
	console.log(`Found the following projects: ${applicationProjectNames.join(', ')}`);

	const projects = readProjectsConfigurationFromProjectGraph(graph);
	const applicationProjects = Object.keys(projects.projects).map((key) => applicationProjectNames.includes(key) && projects.projects[key]).filter(x => typeof x === 'object');
	// Loop
	for (const project of applicationProjects) {
		// determine if valid e2e project exists
		const e2eProject = Object.keys(projects.projects).map(key => projects.projects[key]).filter(x => x.implicitDependencies?.includes(project.name));

		const firebaseJson = await globAsync(tree, [joinPathFragments(project.root, firebaseJsonGlob)]);
		if ((!e2eProject || e2eProject.length === 0) && firebaseJson.length > 0) {
			console.log(`The following project was found to not be covered by an e2e project and contain a firebase configuration: ${project.name}`);
			// prompt to generate e2e project for un-covered projects
			const rl = readLine.createInterface({
				input: process.stdin,
				output: process.stdout
			});

			let answer: string;
			let js: string;
			while (!answer || answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'n') {
				answer = await rl.question(`Would you like to generate an e2e project for ${project.name}? [Y/n] `);
				if (!answer) {
					answer = 'y';
				}
				switch (answer.toLowerCase()) {
					case 'n':
						//Do nothing - The user does not want to create a project
						continue;
					case 'y':
						// TODO: flush out creating an e2e project
						while (js?.toLowerCase() !== 'y' && js?.toLowerCase() !== 'n') {
							js = await rl.question('Does this project use Typescript? [Y/n] ');
							if (js === '' || js.toLowerCase() === 'y') {
								options.js = false;
								js = 'y';
							} else if (js.toLowerCase() === 'n') {
								options.js = true;
							}
						}
						// generate new files
						await createE2EProject(project, tree, options);
						break;
				}
			}
		} else if (firebaseJson.length > 0) {
			// update existing files
			options = normalizeOptions(options, e2eProject[0], tree);
			await injectConfiguration(tree, project, addPlugins, e2eProject[0], options)
		}
	}
	// end loop
	await formatFiles(tree);
	return () => {
		installPackagesTask(tree);
	};
}

async function createE2EProject(baseProject: ProjectConfiguration, tree: Tree, options: InitGeneratorSchema) {
	const appsDir = getWorkspaceLayout(tree).appsDir;
	const newProjectName = `${baseProject.name}-e2e`;
	const newProjectDir = joinPathFragments(appsDir, newProjectName);
	const newProject: ProjectConfiguration = {
		name: newProjectName,
		projectType: 'application',
		root: newProjectDir,
		sourceRoot: joinPathFragments(newProjectDir, 'src'),
		implicitDependencies: [baseProject.name]
	};
	options = normalizeOptions(options, newProject, tree);
	addProjectConfiguration(tree, newProjectName, newProject);
	await createCypressConfig(tree, newProject, options);
	await injectConfiguration(tree, baseProject, options.addPlugin ?? true, newProject, options)
}

async function createCypressConfig(tree: Tree, projectConfig: ProjectConfiguration, options: InitGeneratorSchema) {
	if (
		tree.exists(joinPathFragments(projectConfig.root, 'cypress.config.ts')) ||
		tree.exists(joinPathFragments(projectConfig.root, 'cypress.config.js'))
	) {
		return;
	}

	const templateVars = {
		...options,
		jsx: !!options.jsx,
		offsetFromRoot: offsetFromRoot(projectConfig.root),
		offsetFromProjectRoot: options.hasTsConfig ? options.offsetFromProjectRoot : '',
		tsConfigPath: options.hasTsConfig ?
			`${options.offsetFromProjectRoot}tsconfig.json` :
			getRelativePathToRootTsConfig(tree, projectConfig.root),
		ext: ''
	};

	generateFiles(
		tree,
		join(__dirname, 'files/common'),
		projectConfig.root,
		templateVars
	);

	if (options.js) {
		if (isEsmProject(tree, projectConfig.root)) {
			generateFiles(
				tree,
				join(__dirname, 'files/config-js-esm'),
				projectConfig.root,
				templateVars
			);
		} else {
			generateFiles(
				tree,
				join(__dirname, 'files/config-js-cjs'),
				projectConfig.root,
				templateVars
			);
		}
	} else {
		generateFiles(
			tree,
			join(__dirname, 'files/config-ts'),
			projectConfig.root,
			templateVars
		);
	}
}

async function injectConfiguration(tree: Tree, projectConfig: ProjectConfiguration, _addPlugin: boolean, e2eProject: ProjectConfiguration, options: InitGeneratorSchema) {
	const projectServeTarget = projectConfig.targets?.['serve'];
	if (!projectServeTarget) {
		console.warn(`The current project: ${projectConfig.name} does not have a serve target. Skipping configuration for this project`)
	}
	const cyVersion = installedCypressVersion();
	const filesToUse = cyVersion && cyVersion < 10 ? 'v9' : 'v10';

	const hasTsConfig = tree.exists(
		joinPathFragments(e2eProject.root, 'tsconfig.json')
	);
	const offsetFromProjectRoot = options.directory
		.split('/')
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		.map(_ => '..')
		.join('/');

	const fileOpts = {
		...options,
		project: projectConfig.name,
		dir: options.directory ?? 'src',
		ext: options.js ? 'js' : 'ts',
		offsetFromRoot: offsetFromRoot(e2eProject.root),
		offsetFromProjectRoot,
		projectRoot: projectConfig.root,
		tsConfigPath: hasTsConfig
			? `${offsetFromProjectRoot}/tsconfig.json`
			: getRelativePathToRootTsConfig(tree, e2eProject.root),
		tmpl: ''
	};

	generateFiles(
		tree,
		join(__dirname, 'files', filesToUse),
		e2eProject.root,
		fileOpts
	);

	if (filesToUse === 'v10') {
		// TODO: consider auto-detecting javascript
		const cyFile = joinPathFragments(
			e2eProject.root,
			options.js ? 'cypress.config.js' : 'cypress.config.ts'
		);
		const webServerCommands: Record<string, string> = {};
		let ciWebServerCommand: string;
		const targetString = targetToTargetString({project: projectConfig.name, target: 'serve'});
		webServerCommands.default = `nx run ${targetString}`;
		if (projectServeTarget.configurations?.['production']) {
			webServerCommands.production = `nx run ${targetString}:production`;
		}

		if (projectConfig.targets?.['serve-static']) {
			ciWebServerCommand = `nx run ${projectConfig.name}: serve-static`;
		}

		const updatedCyConfig = await addDefaultE2eConfig(
			tree.read(cyFile, 'utf-8'),
			{
				cypressDir: options.directory,
				bundler: options.bundler === 'vite' ? 'vite' : undefined,
				webServerCommands,
				ciWebServerCommand: ciWebServerCommand,
			},
			options.baseUrl
		);

		tree.write(cyFile, updatedCyConfig)
	}
}

function addPlugin(tree: Tree, graph: ProjectGraph, updatePackageScripts: boolean) {
	return _addPlugin(
		tree,
		graph,
		'@nxextensions/firebase-cypress',
		createNodesV2,
		{
			targetName: ['e2e'],
			openTargetName: ['open-cypress'],
			componentTestingTargetName: ['component-test'],
			ciTargetName: ['e2e-ci']
		},
		updatePackageScripts
	)
}

function isEsmProject(tree: Tree, projectRoot: string) {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let packageJson: any;
	if (tree.exists(joinPathFragments(projectRoot, 'package.json'))) {
		packageJson = readJson(
			tree,
			joinPathFragments(projectRoot, 'package.json')
		);
	} else {
		packageJson = readJson(tree, 'package.json');
	}
	return packageJson.type === 'module';
}

// noinspection JSUnusedGlobalSymbols
export default initGenerator;
