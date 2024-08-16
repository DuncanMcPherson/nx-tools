export function createInterface() {
	return {
		question: () => {
			return Promise.resolve('y');
		}
	}
}
