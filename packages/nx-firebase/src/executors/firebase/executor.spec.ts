import { ExecutorContext } from '@nx/devkit';

import { FirebaseExecutorSchema } from './schema';
import executor from './executor';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import * as EventEmitter from "node:events";
import * as stream from 'node:stream'


jest.mock('node:child_process', () => ({
	exec: jest.fn(() => {
		const cp = new EventEmitter();
		cp["stdout"] = new stream.Readable({
			read () {
				this.push("It is now safe to connect");
				this.push(null);
			}
		});
		cp["stderr"] = new stream.Readable();
		return cp;
	})
}))

const tree = createTreeWithEmptyWorkspace();

const options: FirebaseExecutorSchema = {
	cwd: tree.root,

};
const context: ExecutorContext = {
	root: '',
	cwd: process.cwd(),
	isVerbose: false,
};

describe('Firebase Executor', () => {
	it('can run', async () => {
		const output = await executor(options, context);
		expect(output.success).toBe(true);
	});
});
