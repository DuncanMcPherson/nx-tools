export default async function request(url: string, callback: () => void, error: () => void) {
	const { protocol } = new URL(url);
	if (protocol === 'http') {
		error();
	} else {
		callback();
	}
}
