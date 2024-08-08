import {
	updateNxJson,
	Tree, readJsonFile, NxJsonConfiguration,
	globAsync
} from '@nx/devkit';
import { join } from 'path';

export async function initGenerator(tree: Tree) {
	await validateWorkspaceHasFirebaseJson(tree);
	const nxJson: NxJsonConfiguration = readJsonFile(join(tree.root, 'nx.json'));
	nxJson.plugins = nxJson.plugins || [];
	const pluginConfig = {
		plugin: '@nxextensions/nx-firebase',
		options: {
			firebaseEmulatorsTargetName: 'firebase-emulators'
		}
	}
	nxJson.plugins.push(pluginConfig);
	updateNxJson(tree, nxJson)
}

async function validateWorkspaceHasFirebaseJson(tree: Tree) {
	const firebaseJsonFiles = await globAsync(tree, ["**/firebase.json"])
	if (firebaseJsonFiles.length === 0) {
		throw new Error(`firebase.json was not found amongst workspace and project files`)
	}
}

export default initGenerator;
