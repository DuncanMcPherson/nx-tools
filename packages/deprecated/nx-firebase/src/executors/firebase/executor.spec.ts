import { ExecutorContext } from '@nx/devkit';

import { FirebaseExecutorSchema } from './schema';
import executor from './executor';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import * as EventEmitter from 'node:events';
import * as stream from 'node:stream';
import { exec } from 'node:child_process';

jest.mock('node:child_process', () => ({
	exec: jest.fn(() => {
		const cp = new EventEmitter({});
		cp['stdout'] = new stream.Readable({
			read() {
				this.push('It is now safe to connect');
				this.push(null);
			},
		});
		cp['stderr'] = new stream.Readable({
			read() {
				this.push(null);
			},
		});
		return cp;
	}),
}));

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
	const localExec = exec;
	beforeEach(() => {
		if (isMockSpy(localExec)) {
			localExec.mockReset();
		}
	});

	it('can run', async () => {
		if (isMockSpy(localExec)) {
			localExec.mockImplementation(() => {
				const cp = new EventEmitter({});
				cp['stdout'] = new stream.Readable({
					read() {
						this.push('It is now safe to connect');
						this.push(null);
					},
				});
				cp['stderr'] = new stream.Readable({
					read() {
						this.push(null);
					},
				});
				return cp;
			});
		}
		const output = await executor(options, context);
		expect(output.success).toBe(true);
	});

	it('should throw error when parallel is false and readyWhen is passed', async () => {
		const opts: FirebaseExecutorSchema = {
			cwd: tree.root,
			readyWhen: 'Test',
			parallel: false,
		};
		try {
			const output = await executor(opts, context);
			fail(
				`An error should have been thrown but received success: ${output.success}`
			);
		} catch (e) {
			expect(e).toBeInstanceOf(Error);
			expect(e.message).toEqual(
				'The "--parallel" flag must be set to true in order to use "--readyWhen"'
			);
		}
	});

	it('should not call exec with only options when --disableOnly is passed', async () => {
		const opts: FirebaseExecutorSchema = {
			cwd: tree.root,
			only: ['database'],
			disableOnly: true,
		};
		if (isMockSpy(localExec)) {
			localExec.mockImplementation(() => {
				const cp = new EventEmitter({});
				cp['stdout'] = new stream.Readable({
					read() {
						this.push('It is now safe to connect');
						this.push(null);
					},
				});
				cp['stderr'] = new stream.Readable({
					read() {
						this.push(null);
					},
				});
				return cp;
			});
		}
		const output = await executor(opts, context);
		expect(output.success).toBe(true);
		if (isMockSpy(localExec)) {
			expect(localExec.mock.calls[0][0].includes('--only')).toBe(false);
		} else {
			fail("expected method 'exec' to be a spy");
		}
	});

	it('should call exec with --only when only option is passed without --disableOnly', async () => {
		const opts: FirebaseExecutorSchema = {
			cwd: tree.root,
			only: ['database'],
		};
		if (isMockSpy(localExec)) {
			localExec.mockImplementation(() => {
				const cp = new EventEmitter({});
				cp['stdout'] = new stream.Readable({
					read() {
						this.push('It is now safe to connect');
						this.push(null);
					},
				});
				cp['stderr'] = new stream.Readable({
					read() {
						this.push(null);
					},
				});
				return cp;
			});
		}
		const output = await executor(opts, context);
		expect(output.success).toBe(true);
		if (isMockSpy(localExec)) {
			expect(localExec.mock.calls.length).toEqual(1);
			expect(localExec.mock.calls[0].length).toEqual(2);
			expect(localExec.mock.calls[0][0].includes('--only')).toEqual(true);
		}
	});

	it('should resolve result with failure when error written with no match', async () => {
		if (isMockSpy(localExec)) {
			localExec.mockImplementation(() => {
				const cp = new EventEmitter({});
				cp['stdout'] = new stream.Readable({
					read() {
						this.push(null);
					},
				});
				cp['stderr'] = new stream.Readable({
					read() {
						this.push('I am a little error test');
						this.push(null);
					},
				});
				setTimeout(() => {
					cp.emit('exit');
				}, 150);
				return cp;
			});
		}
		const output = await executor(options, context);
		expect(output.success).toEqual(false);
	});

	it('should resolve with true when error is expected', async () => {
		if (isMockSpy(localExec)) {
			localExec.mockImplementation(() => {
				const cp = new EventEmitter({});
				cp['stdout'] = new stream.Readable({
					read() {
						this.push(null);
					},
				});
				cp['stderr'] = new stream.Readable({
					read() {
						this.push('It is now safe to connect');
						this.push(null);
					},
				});
				return cp;
			});
		}
		const result = await executor(options, context);
		expect(result.success).toBe(true);
	});

	it('should resolve with false when process throws an error', async () => {
		if (isMockSpy(localExec)) {
			localExec.mockImplementation(() => {
				const cp = new EventEmitter({});
				cp['stdout'] = new stream.Readable({
					read() {
						this.push(null);
					},
				});
				cp['stderr'] = new stream.Readable({
					read() {
						this.push(null);
					},
				});
				setTimeout(() => {
					cp.emit('error', new Error('testErr'));
				}, 150);
				return cp;
			});
		}
		const output = await executor(options, context);
		expect(output.success).toBe(false);
	});

	[
		{
			code: 0,
			result: true,
		},
		{
			code: 1,
			result: false,
		},
	].forEach(({ code, result }) => {
		it(`should return ${result} when status code is ${code}`, async () => {
			if (isMockSpy(localExec)) {
				localExec.mockImplementation(() => {
					const cp = new EventEmitter({});
					cp['stdout'] = new stream.Readable({
						read() {
							this.push(null);
						},
					});
					cp['stderr'] = new stream.Readable({
						read() {
							this.push(null);
						},
					});
					setTimeout(() => {
						cp.emit('exit', code);
					}, 150);
					return cp;
				});
			}
			const opts: FirebaseExecutorSchema = {
				readyWhen: undefined,
				parallel: false,
			};
			const output = await executor(opts, context);
			expect(output.success).toBe(result);
		});
	});

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	function isMockSpy(fn: any): fn is jest.Mock {
		return jest.isMockFunction(fn);
	}
});
