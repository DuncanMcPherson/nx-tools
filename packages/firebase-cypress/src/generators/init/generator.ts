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
	offsetFromRoot, generateFiles
} from '@nx/devkit';
import * as readLine from 'readline/promises';
import { join } from 'path';
import * as process from 'node:process';
import { getRelativePathToRootTsConfig } from '@nx/js';

const firebaseJsonGlob = '**/firebase.json';

export interface InitGeneratorSchema {
	js?: boolean;
	jsx?: boolean;
	hasTsConfig?: boolean;
	offsetFromProjectRoot?: string;
	directory?: string;
}

function normalizeOptions(options: InitGeneratorSchema, project: ProjectConfiguration, tree: Tree) {
	options ??= {};
	options.directory ??= 'src'
	options.js ??= false;
	options.jsx ??= false;

	const offsetFromProjectRoot = options.directory.split('/')
		.map(_ => '..')
		.join('/')
	options.hasTsConfig = tree.exists(joinPathFragments(project.root, 'tsconfig.json'));
	return {
		...options,
		offsetFromProjectRoot: `${offsetFromProjectRoot}/`,
		projectConfig: project
	};
}

export async function initGenerator(tree: Tree, options: InitGeneratorSchema) {
	// detect projects
	const graph = await createProjectGraphAsync({ exitOnError: true });
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
		console.log(e2eProject);
		const firebaseJson = await globAsync(tree, [join(project.root, firebaseJsonGlob)]);
		if ((!e2eProject || e2eProject.length === 0) && firebaseJson.length > 0) {
			console.log(`The following project was found to not be covered by an e2e project and contain a firebase configuration: ${project.name}`);
			// prompt to generate e2e project for un-covered projects
			const rl = readLine.createInterface({
				input: process.stdin,
				output: process.stdout
			});
			let answer: string;
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
						await createE2EProject(project, tree, options)
						break;

				}
			}
			// generate new files
		} else {
			// update existing files
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
	const newProjectDir = join(appsDir, newProjectName);
	const newProject: ProjectConfiguration = {
		name: newProjectName,
		projectType: 'application',
		root: newProjectDir,
		sourceRoot: join(newProjectDir, 'src'),
		implicitDependencies: [baseProject.name]
	}
	options = normalizeOptions(options, newProject, tree);
	addProjectConfiguration(tree, newProjectName, newProject);
	await createCypressConfig(tree, newProject, options);
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
	}

	generateFiles(
		tree,
		join(__dirname, 'files/common'),
		projectConfig.root,
		templateVars
	);
}

export default initGenerator;
