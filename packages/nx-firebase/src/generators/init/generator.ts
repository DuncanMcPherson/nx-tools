import {
	Tree,
	globAsync, createProjectGraphAsync, readNxJson, ProjectGraph
} from '@nx/devkit';
import { addPlugin as _addPlugin } from '@nx/devkit/src/utils/add-plugin';
import { createNodesV2 } from '../../target-generator/index';

export async function initGenerator(tree: Tree) {
	await validateWorkspaceHasFirebaseJson(tree);
	const nxJson = readNxJson(tree);
	const addPlugins = process.env.NX_ADD_PLUGINS !== 'false' && nxJson.useInferencePlugins !== false;
	const graph = await createProjectGraphAsync();
	if (addPlugins) {
		await addPlugin(tree, graph, true);
	}
}

function addPlugin(tree: Tree, graph: ProjectGraph, updatePackageScripts: boolean) {
	return _addPlugin(
		tree,
		graph,
		'@nxextensions/nx-firebase',
		createNodesV2,
		{
			firebaseEmulatorsTargetName: ['firebase-emulators']
		},
		updatePackageScripts
	)
}

async function validateWorkspaceHasFirebaseJson(tree: Tree) {
	const firebaseJsonFiles = await globAsync(tree, ['**/firebase.json']);
	if (firebaseJsonFiles.length === 0) {
		throw new Error(`firebase.json was not found amongst workspace and project files`);
	}
}

export default initGenerator;
