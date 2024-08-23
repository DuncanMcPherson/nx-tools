import * as sh from 'shell-exec';
export function killPort(port: number | string, method: 'tcp' | 'udp' = 'tcp'): Promise<void> {
	port = Number.parseInt(String(port));
	if (!port) {
		return Promise.reject(new Error('Invalid port number received'));
	}

	if (process.platform === 'win32') {
		return sh('netstat -ano')
			.then((res: {stdout: string}) => {
				const { stdout } = res;
				if (!stdout) return res;

				const lines = stdout.split('\n');
				const lineWithLocalPortRegex = new RegExp(`^ *${method.toLocaleUpperCase()} *[^ ]*:${port}`, 'gm');
				const linesWithLocalPort = lines.filter(line => line.match(lineWithLocalPortRegex));

				const pids = linesWithLocalPort.reduce((acc: string[], line) => {
					const match = line.match(/(\d*)\w*(\n|$)/gm);
					return match && match[0] && !acc.includes(match[0]) ? acc.concat(match[0]) : acc
				}, []);

				return sh(`TaskKill /F /PID ${pids.join(' /PID ')}`);
			});
	}

	return sh('lsof -i -P')
		.then((res: {stdout: string}) => {
			const { stdout } = res;
			if (!stdout) return res;
			const lines = stdout.split('\n');
			const existProcess = lines.filter((line) => line.match(new RegExp(`:*${port}`))).length > 0;
			if (!existProcess) return Promise.reject(new Error('No process running on port'));

			return sh(
				`lsof -i ${method === 'udp' ? 'udp' : 'tcp'}:${port} | grep ${method === 'udp' ? 'UDP' : 'LISTEN'} | awk '{print $2}' | xargs kill -9`
			);
		})
}
