'use strict';

const {basename} = require('path');
const os = require('os');

const commandLineArgs = require('command-line-args');

const {
  install, audit, test,
  findGitRepos,
  processUpdates, getRemotes, switchBranch, addUnstaged, commit, push
} = require('./index.js');

// Todo: Some should probably not be command line as vary per repo
// Todo: Regex options (`filter`, `reject`) not possible?
const options = commandLineArgs([
  // multiple: true, defaultOption: true

  {name: 'args', type: String, multiple: true},
  {name: 'configFilePath', type: String},
  {name: 'configFileName', type: String},
  // Should really be `multiple`, but we'll stick with npm-check-updates
  {name: 'dep', type: String},
  {name: 'errorLevel', type: Number, alias: 'e'},
  {name: 'filter', type: String, alias: 'f'},
  {name: 'global', type: Boolean, alias: 'g'},
  {name: 'greatest', type: Boolean, alias: 't'},
  {name: 'interactive', type: Boolean, alias: 'i'},
  {name: 'jsonAll', type: Boolean, alias: 'j'},
  {name: 'jsonUpgraded', type: Boolean},
  {name: 'loglevel', type: String, alias: 'l'},
  {name: 'minimal', type: Boolean, alias: 'm'},
  {name: 'newest', type: Boolean, alias: 'n'},
  {name: 'packageData', type: Boolean},
  {name: 'packageFile', type: String},
  // {name: 'packageFileDir', type: Boolean},
  {name: 'packageManager', type: String, alias: 'p'},
  {name: 'pre', type: Number},
  {name: 'registry', type: String, alias: 'r'},
  // Should really be `multiple`, but we'll stick with npm-check-updates
  {name: 'reject', type: String, alias: 'x'},
  {name: 'removeRange', type: Boolean},
  {name: 'semverLevel', type: Boolean},
  {name: 'silent', type: Boolean, alias: 's'},
  {name: 'timeout', type: Number},
  // {name: 'upgrade', type: Boolean, alias: 'u'}, // We will upgrade

  // Not accessible programmatically?
  {name: 'version', type: Boolean, alias: 'v'},

  // Git
  {name: 'token', type: String, alias: 'o'},

  // Repos
  {name: 'repository', type: String, alias: 'y'},
  {name: 'basePath', type: String, alias: 'b'},
  {name: 'configFile', type: String, alias: 'c'},
  {name: 'dryRun', type: Boolean},
  {name: 'branchName', type: String}
]);

(async () => {
const basePath = options.basePath || os.homedir();
const branchName = options.branchName || 'master';

let excludeRepositories = [], repositoriesToRemotes = {};

if (basePath) {
  const configFile = options.configFile || options.repository
    ? null
    : `${basePath}/update-packages.json`;

  if (configFile) {
    try {
      // eslint-disable-next-line global-require, import/no-dynamic-require
      const updateConfig = require(configFile);
      if (updateConfig) {
        ({excludeRepositories, repositoriesToRemotes} = updateConfig);
      }
    } catch (err) {}
  }
}

const repositoryPaths = options.repository
  ? [options.repository]
  : (await findGitRepos({basePath}));

// console.log('repositoryPaths', repositoryPaths);

await Promise.all(
  repositoryPaths.map(async (repositoryPath) => {
    const repoFile = basename(repositoryPath);

    // console.log('repoFile', repositoryPath, repoFile);
    if (excludeRepositories.includes(repoFile)) {
      return;
    }

    // We want `upgrade` disableable, so we use a new option
    const upgrade = !options.dryRun;
    console.log('upgrade', upgrade);
    if (upgrade) {
      await switchBranch({repositoryPath, branchName});
    }
    const upgraded = await processUpdates({
      ...options,
      packageFile: `${repositoryPath}/package.json`,
      upgrade
    });

    console.log('dependencies to upgrade:', upgraded);
    if (!upgrade) {
      return;
    }

    await install({repositoryPath});
    return;

    await audit({args: ['fix']});

    await test();

    // Todo: https://isomorphic-git.org/docs/en/authentication.html
    const {token} = options;

    await addUnstaged({repositoryPath});
    await commit({repositoryPath});

    const remotes = repositoriesToRemotes[repoFile] ||
      await getRemotes({repositoryPath});

    console.log('remotes', remotes);

    await Promise.all(
      remotes.map((remoteName) => {
        return push({repositoryPath, remoteName, branchName, token});
      })
    );
  })
);
})();
