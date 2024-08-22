import request from './request';

export function isServerUp(baseUrl: string): Promise<boolean> {
	if (!isNaN(+baseUrl)) {
		baseUrl = `http://localhost:${baseUrl}`
	}

	return new Promise<boolean>((res) => {
		void request(baseUrl, () => {
			res(true);
		}, () => res(false));
	})
}

export function waitForServer(baseUrl: string): Promise<void> {
	if (!isNaN(+baseUrl)) {
		baseUrl = `http://localhost:${baseUrl}`
	}
	return new Promise<void>((res, rej) => {
		let pollTimeout: NodeJS.Timeout | null
		const timeoutDuration = 120_000;
		const timeout = setTimeout(() => {
			clearTimeout(pollTimeout);
			rej(new Error(`Server failed to start within ${timeoutDuration / 1000}s. Aborting operation`));
		}, timeoutDuration);

		function pollForServer() {
			void request(baseUrl, () => {
				clearTimeout(timeout);
				res();
			}, () => {
				pollTimeout = setTimeout(pollForServer, 100)
			});
		}

		pollForServer();
	})
}
