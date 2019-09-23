'use strict';

const {basename} = require('path');
const os = require('os');

const commandLineArgs = require('command-line-args');

const {
  install, audit, test,
  findGitRepos, getGlobalGitAuthorInfo,
  processUpdates, getRemotes, switchBranch, getBranch,
  addUnstaged, commit, push
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

  // Repos
  {name: 'repository', type: String, alias: 'y'},
  {name: 'basePath', type: String, alias: 'b'},
  {name: 'configFile', type: String, alias: 'c'},
  {name: 'dryRun', type: Boolean},
  {name: 'branchName', type: String},
  {name: 'stayOnChangedBranch', type: Boolean},

  // Git
  {name: 'token', type: String, alias: 'o'},

  // Defaults to checking local config and then global config
  {name: 'username', type: String},
  {name: 'password', type: String}
]);

(async () => {
const {
  basePath = os.homedir(),
  configFile = basePath ? `${basePath}/update-packages.json` : null,
  branchName = 'master'
} = options;

let updateConfig = {};
let excludeRepositories = [], repositoriesToRemotes = {};

if (configFile) {
  try {
    // eslint-disable-next-line global-require, import/no-dynamic-require
    updateConfig = require(configFile);
    if (updateConfig) {
      ({
        excludeRepositories = [], repositoriesToRemotes = {}
      } = updateConfig);
    }
  } catch (err) {}
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

    let startingBranch;
    let switchedBack = false;
    const logAndSwitchBackBranch = async (...message) => {
      console.log(...message);
      if (switchedBack ||
        !upgrade ||
        startingBranch === branchName ||
        options.stayOnChangedBranch
      ) {
        return;
      }
      try {
        await switchBranch({repositoryPath, branchName: startingBranch});
        console.log(
          'Switched branch for', repositoryPath,
          'back to', startingBranch
        );
        // eslint-disable-next-line require-atomic-updates
        switchedBack = true;
      } catch (err) {
        console.log(
          'Could not switch back branch for', repositoryPath,
          'to', startingBranch,
          err
        );
      }
    };

    if (upgrade) {
      try {
        startingBranch = await getBranch({repositoryPath});
      } catch (err) {
        console.log(
          'Could not get starting branch for', repositoryPath, err
        );
        return;
      }
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
      await logAndSwitchBackBranch(
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

    // We install even if the upgrades were empty in case failed previously
    //  at this step
    try {
      await install({repositoryPath});
    } catch (err) {
      await logAndSwitchBackBranch('Error installing', repositoryPath, err);
      return;
    }

    try {
      await audit({repositoryPath, args: ['fix']});
    } catch (err) {
      await logAndSwitchBackBranch(
        'Error auditing/fixing', repositoryPath, err
      );
    }

    try {
      await test({repositoryPath});
    } catch (err) {
      await logAndSwitchBackBranch(
        'Error with test', repositoryPath, err
      );
      return;
    }

    try {
      // Though we could check the length to see if any files were added,
      //  and avoid committing again if so, we might have failed committing
      //  last time, so we do again
      await addUnstaged({repositoryPath});
    } catch (err) {
      await logAndSwitchBackBranch(
        'Error adding unstaged files', repositoryPath, err
      );
      return;
    }

    try {
      await commit({repositoryPath});
    } catch (err) {
      // This is necessary per https://github.com/isomorphic-git/isomorphic-git/issues/236
      //   and https://github.com/isomorphic-git/isomorphic-git/issues/690
      let globalGitAuthorName, globalGitAuthorEmail;
      try {
        const globalGitAuthorInfo = await getGlobalGitAuthorInfo();
        try {
          ({name: globalGitAuthorName, email: globalGitAuthorEmail} =
            globalGitAuthorInfo.user);
        } catch (error) {
          await logAndSwitchBackBranch(
            'No user info (for name and email) in global config and',
            'erred with local commit',
            err
          );
          return;
        }
        // console.log('globalGitAuthorInfo', globalGitAuthorInfo);
      } catch (error) {
        await logAndSwitchBackBranch(
          'Error getting global Git author info',
          error,
          'and erred with local commit',
          err
        );
        return;
      }
      if (!globalGitAuthorName || !globalGitAuthorEmail) {
        await logAndSwitchBackBranch(
          'Global Git author info empty; error with local commit',
          repositoryPath,
          err
        );
        return;
      }
      try {
        await commit({repositoryPath, author: {
          name: globalGitAuthorName,
          email: globalGitAuthorEmail
        }});
      } catch (error) {
        await logAndSwitchBackBranch(
          'Error committing with global credentials', repositoryPath, error,
          'as with local commit', err
        );
        return;
      }
    }

    let remotes;
    try {
      remotes = repositoriesToRemotes[repoFile] ||
        await getRemotes({repositoryPath});
    } catch (err) {
      await logAndSwitchBackBranch(
        'Error getting remotes', repositoryPath, err
      );
      return;
    }

    console.log('remotes', remotes);
    const {token, username, password} = {...updateConfig, ...options};

    // See https://isomorphic-git.org/docs/en/authentication.html

    // Todo: Only push to `origin` by default
    await Promise.all(
      remotes.map(async (remoteName) => {
        let pushed;
        try {
          pushed = await push({
            repositoryPath, remoteName, branchName,
            username, password, token
          });
        } catch (err) {
          await logAndSwitchBackBranch(
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
    await logAndSwitchBackBranch(
      'Finished processing', repositoryPath
    );
  })
);
console.log('Completed all items!');
})();
