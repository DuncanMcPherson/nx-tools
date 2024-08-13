import {
	createProjectGraphAsync,
	readProjectsConfigurationFromProjectGraph,
	installPackagesTask,
	globAsync,
	Tree
} from '@nx/devkit';
import * as readLine from 'readline/promises';
import { join } from 'path';
import * as process from 'node:process';

const cypressConfigGlob = '**/cypress.*';
const firebaseJsonGlob = '**/firebase.json';

export async function initGenerator(tree: Tree) {
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
						break;

				}
			}
			// generate new files
		} else {
			// update existing files
		}
	}
	// end loop
	return () => {
		installPackagesTask(tree);
	};
}

export default initGenerator;
