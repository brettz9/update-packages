'use strict';

const {basename} = require('path');
const os = require('os');

const commandLineArgs = require('command-line-args');

const {
  install, audit, test,
  findGitRepos, getGlobalGitAuthorInfo,
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

let repositoryPaths;
try {
  repositoryPaths = options.repository
    ? [options.repository]
    : (await findGitRepos({basePath}));
} catch (err) {
  console.log('Error retrieving git repositories from basePath', basePath, err);
  return;
}

// console.log('repositoryPaths', repositoryPaths);

await Promise.all(
  repositoryPaths.map(async (repositoryPath) => {
    const repoFile = basename(repositoryPath);

    // console.log('repoFile', repositoryPath, repoFile);
    if (excludeRepositories.includes(repoFile)) {
      console.log('Skipping repository', repoFile);
      return;
    }

    // We want `upgrade` disableable, so we use a new option
    const upgrade = !options.dryRun;
    console.log('upgrade', upgrade);
    if (upgrade) {
      try {
        await switchBranch({repositoryPath, branchName});
      } catch (err) {
        console.log(
          'Erring switching to branch of repository', repositoryPath,
          'on branch', branchName, err
        );
        return;
      }
    }

    let upgraded;
    try {
      upgraded = await processUpdates({
        ...options,
        packageFile: `${repositoryPath}/package.json`,
        upgrade
      });
    } catch (err) {
      console.log(
        `Error processing npm-check-updates (with upgrade ${upgrade})`,
        err
      );
      return;
    }

    console.log('dependencies to upgrade:', upgraded);
    if (!upgrade) {
      console.log('Finished processing (without update)', repositoryPath);
      return;
    }

    try {
      await install({repositoryPath});
    } catch (err) {
      console.log('Error installing', repositoryPath, err);
      return;
    }

    try {
      await audit({repositoryPath, args: ['fix']});
    } catch (err) {
      console.log('Error auditing/fixing', repositoryPath, err);
    }

    try {
      await test({repositoryPath});
    } catch (err) {
      console.log('Error with test', repositoryPath, err);
      return;
    }

    try {
      await addUnstaged({repositoryPath});
    } catch (err) {
      console.log('Error adding unstaged files', repositoryPath, err);
      return;
    }

    // This is necessary per https://github.com/isomorphic-git/isomorphic-git/issues/236
    //   and https://github.com/isomorphic-git/isomorphic-git/issues/690
    let globalGitAuthorName, globalGitAuthorEmail;
    try {
      const globalGitAuthorInfo = await getGlobalGitAuthorInfo();
      try {
        ({name: globalGitAuthorName, email: globalGitAuthorEmail} =
          globalGitAuthorInfo.user);
      } catch (err) {
        throw new Error('No user info (for name and email) in global config');
      }
      // console.log('globalGitAuthorInfo', globalGitAuthorInfo);
    } catch (err) {
      console.log(
        'Error getting global Git author info; trying Git repo...',
        err
      );
    }

    try {
      await commit({repositoryPath});
    } catch (err) {
      if (!globalGitAuthorName || !globalGitAuthorEmail) {
        console.log('Error committing', repositoryPath, err);
        return;
      }
      try {
        await commit({repositoryPath, author: {
          name: globalGitAuthorName,
          email: globalGitAuthorEmail
        }});
      } catch (error) {
        console.log(
          'Error committing with global credentials', repositoryPath, error
        );
        return;
      }
    }

    let remotes;
    try {
      remotes = repositoriesToRemotes[repoFile] ||
        await getRemotes({repositoryPath});
    } catch (err) {
      console.log('Error getting remotes', repositoryPath, err);
      return;
    }

    console.log('remotes', remotes);

    // Todo: https://isomorphic-git.org/docs/en/authentication.html
    const {token} = options;

    // Todo: Only push to `origin` by default
    await Promise.all(
      remotes.map(async (remoteName) => {
        let pushed;
        try {
          pushed = await push({repositoryPath, remoteName, branchName, token});
        } catch (err) {
          console.log(
            'Error pushing to repository', repositoryPath,
            'with remote', remoteName,
            'to branch', branchName,
            'with token', token,
            err
          );
          return undefined;
        }
        return pushed;
      })
    );
    console.log('Finished processing', repositoryPath);
  })
);
console.log('Completed all items!');
})();
