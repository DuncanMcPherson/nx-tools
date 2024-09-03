export interface ServeExecutorSchema {
	baseServeTarget?: string;
	only?: string[],
	includeHosting?: boolean;
	saveDataDir?: string;
}
