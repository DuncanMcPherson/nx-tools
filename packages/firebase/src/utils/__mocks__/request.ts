const requestsMade: Record<string, number> = {};
export default async function request(
	url: string,
	callback: () => void,
	error: () => void
) {
	return new Promise<void>((resolve) => {
		const requestNumber = requestsMade[url]
			? ++requestsMade[url]
			: (requestsMade[url] = 1);
		const { protocol } = new URL(url);
		if (protocol === 'http:' && requestNumber === 1) {
			error();
			resolve();
		} else {
			callback();
			resolve();
		}
	});
}
