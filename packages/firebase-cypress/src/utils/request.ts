import { request as httpRequest } from 'http';
import { request as httpsRequest } from 'https';

export default function request(
	url: string,
	callback: () => void,
	error: () => void
): Promise<void> {
	return new Promise((res) => {
		const { protocol } = new URL(url);

		const makeRequest = protocol === 'https:' ? httpsRequest : httpRequest;

		const request = makeRequest(url, () => {
			callback();
			res();
		});

		request.on('error', () => {
			error();
			res();
		});

		request.end();
	});
}
