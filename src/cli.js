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
  {name: 'packageFileDir', type: Boolean},
  {name: 'packageManager', type: String, alias: 'p'},
  {name: 'pre', type: Number},
  {name: 'registry', type: String, alias: 'r'},
  // Should really be `multiple`, but we'll stick with npm-check-updates
  {name: 'reject', type: String, alias: 'x'},
  {name: 'removeRange', type: Boolean},
  {name: 'semverLevel', type: Boolean},
  {name: 'silent', type: Boolean, alias: 's'},
  {name: 'timeout', type: Number},
  {name: 'upgrade', type: Boolean, alias: 'u'},
  // Not accessible programmatically?
  {name: 'version', type: Boolean, alias: 'v'},

  // Git
  {name: 'token', type: String, alias: 't'},

  // Repos
  {name: 'basePath', type: String, alias: 'b'}
]);

(async () => {
const basePath = os.homedir();
const branchName = 'master';

let excludeRepositories = [], repositoriesToRemotes = {};
try {
  // eslint-disable-next-line global-require, import/no-dynamic-require
  const updateConfig = require(`${basePath}/update-packages.json`);
  if (updateConfig) {
    ({excludeRepositories, repositoriesToRemotes} = updateConfig);
  }
} catch (err) {}

const repos = await findGitRepos({basePath});
const repositoryPaths = Object.keys(repos);

await Promise.all(
  repositoryPaths.map(async (repositoryPath) => {
    const repoFile = basename(repositoryPath);
    if (excludeRepositories.includes(repoFile)) {
      return;
    }

    const upgraded = await processUpdates({...options});
    console.log('dependencies to upgrade:', upgraded);

    await install({repositoryPath});

    await audit({args: ['fix']});

    await test();

    // Todo: https://isomorphic-git.org/docs/en/authentication.html
    const {token} = options;

    await switchBranch({repositoryPath, branchName});

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
