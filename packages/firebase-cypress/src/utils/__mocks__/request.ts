export default async function request(url: string, callback: () => void, error: () => void) {
	return new Promise<void>((resolve) => {
		const { protocol } = new URL(url);
		if (protocol === 'http') {
			error();
			resolve();
		} else {
			callback();
			resolve();
		}
	});
}
