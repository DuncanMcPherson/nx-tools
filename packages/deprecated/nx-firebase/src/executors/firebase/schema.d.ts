export interface FirebaseExecutorSchema {
	cwd?: string;
	command?: string;
	readyWhen?: string;
	parallel?: boolean;
	only?: string[];
	disableOnly?: boolean;
} // eslint-disable-line
