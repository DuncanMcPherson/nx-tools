import { GitCommit, RawGitCommit, Reference } from 'nx/src/command-line/release/utils/git';
import { execCommand } from 'nx/src/command-line/release/utils/exec-command';

async function getGitDiff(
	from?: string | undefined,
	to = "HEAD"
): Promise<RawGitCommit[]> {
	let range = ''
	if (!from || from === to) {
		range = to;
	} else {
		range = `${from}..${to}`
	}

	const r = await execCommand('git', [
		'--no-pager',
		'log',
		range,
		'--pretty="----%n%s|%h|%an|%ae%n%b"',
		'--name-status'
	]);

	return r
		.split('----\n')
		.splice(1)
		.map((line) => {
			const [firstLine, ..._body] = line.split('\n');
			const [message, shortHash, authorName, authorEmail] = firstLine.split('|');
			const r: RawGitCommit = {
				message,
				shortHash,
				author: {name: authorName, email: authorEmail},
				body: _body.join('\n')
			};
			return r;
		});
}

function parseGitCommit(commit: RawGitCommit): GitCommit | null {
	const parsedMessage = parseConventionalCommitsMessage(commit.message);
	if (!parsedMessage) {
		return null;
	}

	const scope = parsedMessage.scope;
	const isBreaking = parsedMessage.breaking || commit.body.includes("BREAKING CHANGE:");
	let description = parsedMessage.description;

	const references: Reference[] = [];
	// @ts-ignore
	for (const m of description.matchAll(/\([ a-z]*(#\d+)\s*\)/gm)) {
		references.push({type: 'pull-request', value: m[1]});
	}
	// @ts-ignore
	for (const m of description.matchAll(/(#\d+)/gm)) {
		if (!references.some((i) => i.value === m[1])) {
			references.push({type: 'issue', value: m[1]})
		}
	}
	references.push({type: 'hash', value: commit.shortHash})
}

function parseConventionalCommitsMessage(message: string): {
	type: string,
	scope: string,
	description: string,
	breaking: boolean
} | null {
	// @ts-ignore
	const match = message.match(/(?<type>[a-z]+)(\((?<scope>.+)\))?(?<breaking>!)?: (?<description>.+)/i)
	if (!match) {
		return null;
	}

	return {
		type: match.groups.type || '',
		scope: match.groups.scope || '',
		description: match.groups.description || '',
		breaking: Boolean(match.groups.breaking)
	};
}

async function getVersionChange() {
	const commits = await getGitDiff();
	const parsedCommits = commits.map(parseGitCommit).filter(Boolean);
}

void getVersionChange();
