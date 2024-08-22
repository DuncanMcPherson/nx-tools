import {
	ExecutorContext,
	joinPathFragments,
	ProjectConfiguration,
	readProjectsConfigurationFromProjectGraph
} from '@nx/devkit';
import { readdirSync } from 'fs';

export function getE2EProjectDependency(context: ExecutorContext): ProjectConfiguration | undefined {
	const projectName = context.projectName;
	const projects = readProjectsConfigurationFromProjectGraph(
		context.projectGraph
	);
	const dependencyName = projects.projects[projectName]?.implicitDependencies?.[0];
	if (!dependencyName) {
		return;
	}

	return projects.projects[dependencyName];
}

export function validateFirebaseProject(project: ProjectConfiguration, context: ExecutorContext): boolean {
	const siblingFiles = readdirSync(joinPathFragments(context.root, project.root));
	return siblingFiles.includes('firebase.json');
}
