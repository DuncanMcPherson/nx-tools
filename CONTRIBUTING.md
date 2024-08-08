# Contributing to NX Tools

We would love for you to contribute! Please read this document to make sure your
suggestions can be accepted.

## Found an issue?

If you find a bug in the source code or a mistake in the documentation, you can help us
by [submitting an issue](https://github.com/duncanmcpherson/nx-tools/blob/master/CONTRIBUTING.md#submit-issue)
to [our GitHub repository](https://github.com/duncanmcpherson/nx-tools). Even better, you
can [submit a Pull Request](https://github.com/duncanmcpherson/nx-tools/blob/master/CONTRIBUTING.md#submit-pr) with a fix!

## Project structure

-   `apps` - this folder is to contain test applications needed to view the changes.
-   `packages` - this folder is to contain individual plugins

## Building the project

> NX tools uses NX to build and test its packages

After cloning the project to your machine, install the dependencies by running:

```bash
npm i
```

To build the packages, run:

```bash
nx run-many -t build
```

## Unit tests

Before submitting a pull request, make sure that your changes didn't break unit tests, run:

```bash
nx affected -t test
```

## E2E tests

**Use Node 18+ and NPM 8+. E2E tests will not work with any version prior to those**

Before submitting a pull request, make sure that your changes didn't break any E2E tests, run:

```bash
nx run-many -t e2e
```

## Documentation Contributions

We would love assistance in ensuring that our documentation is complete and easy to understand.
Please feel welcome to submit fixes or enhancements to the existing documentation pages in this repo.

> Note: When committing documentation changes, please make sure to write the commit message
> in the following format: `docs: changes made`

## Submission guidelines

### <a name="submit-issue"></a> Submitting an Issue

Before submitting an issue, make sure someone else hasn't already submitted your issue.
If an issue for your problem already exists, discussions may have revealed a workaround.

If an issue already exists, feel free to comment on it to provide more information regarding
the problem.

Maintaining code quality and usability is our priority! If you find an issue, please
record your reproduction steps and create a repository that readily presents the issue.
This provides us with sufficient data to determine what the problem is and fix it in a
timely manner.

A minimal reproduction will be required for **all** bug reports to respect the time of our maintainers.

### <a name="submit-pr"></a> Submitting a PR

Please make sure the following guidelines are followed:

-   Make sure unit tests pass (`nx affected -t test`)
    -   Target a specific project with `nx run proj:test` (i.e. `nx run nx-firebase:test`)
-   Make sure E2E tests pass (`nx affected -t e2e`)
    -   Sometimes this can take a while, so you are welcome to let CI handle that
-   Make sure you run `nx format`
- Make sure appropriate documentation is created (for new plugins, make sure to update the 
README.md file that was created with the plugin)
- Ensure your commit messages follow the guidelines below

### Commit Message Guidelines

The commit message should follow the following format:

```plain
type(scope): subject
// optionally include the following
BLANK LINE
body
```

#### Type

The type must be one of the following:

- `feat` - New behavior being introduced (e.g. Updating dependencies to bring in new features, or adding new executors/generators)
- `fix` - Fixes to bugs
- `docs` - Updates to documentation (Please, when using this type, make sure that your commit does not include code files. Include "*.md" files only)
- `perf` - Updates to performance. This should be used when refactoring methods, or making improvements to methods
- `chore` - Changes that have absolutely no effect on users. Such as documentation comments or internal version updates
- `break` - **USE THIS ONE SPARINGLY!** This is reserved for changes that will break user experience (e.g. Removing an executor or a generator)

#### Scope

This is the name of the package that is changed.

- nx-firebase
- firebase-cypress
