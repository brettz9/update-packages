'use strict';

const {basename} = require('path');
const os = require('os');

const commandLineArgs = require('command-line-args');
const commandLineUsage = require('command-line-usage');

const {chunkPromises} = require('chunk-promises');
const updateNotifier = require('update-notifier');

const report = require('./report.js');

const pkg = require('../package.json');

const {
  install, audit, test,
  findGitRepos, getGlobalGitAuthorInfo, getRemoteURL,
  processUpdates, switchBranch, getBranch, // getRemotes,
  addUnstaged, getStaged, commit, push
} = require('./index.js');

const {optionDefinitions, cliSections} = require('./optionDefinitions.js');

(async () => {
// check if a new version of ncu is available and print an update notification
const notifier = updateNotifier({pkg});
if (notifier.update && notifier.update.latest !== pkg.version) {
  notifier.notify({defer: false});
  return;
}

// Todo: Some should probably not be command line as vary per repo
// Todo: Could convert slash-delimited strings into regexes for relevant
//   options (`filter`, `reject`); could build on top of `command-line-args`
//   and `command-line-usage` for standard conventional handlings of various
//   additional types like this
const options = commandLineArgs(optionDefinitions);
const {
  basePath = os.homedir(),
  configFile = basePath ? `${basePath}/update-packages.json` : null,
  authFile = basePath ? `${basePath}/.update-packages-auth.json` : null,
  branchName = 'master',
  help = false
} = options;

if (help) {
  const usage = commandLineUsage(cliSections);
  console.log(usage);
  return;
}

let updateConfig = {};
let excludeRepositories = [], repositoriesToRemotes = {};

let authFileToken;
if (authFile) {
  try {
    // eslint-disable-next-line global-require, import/no-dynamic-require
    ({token: authFileToken} = require(authFile));
  } catch (err) {
  }
}
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
  repositoryPaths = options.repository || (await findGitRepos({basePath}));
} catch (err) {
  console.log('Error retrieving git repositories from basePath', basePath, err);
  return;
}

// console.log('repositoryPaths', repositoryPaths);

const skippedRepositories = [];
const startingBranchErrors = [];
const switchingBranchErrors = [];
const switchingBranchBackErrors = [];
// Todo: Other errors via calls to `logAndSwitchBackBranch`
const pushingErrors = [];

const tasks = repositoryPaths.slice(
  0, options.limit || repositoryPaths.length
).map((repositoryPath) => {
  return async () => {
    const repoFile = basename(repositoryPath);

    // console.log('repoFile', repositoryPath, repoFile);
    if (excludeRepositories.includes(repoFile)) {
      console.log('Skipping repository', repoFile);
      skippedRepositories.push({repositoryPath});
      return;
    }

    // We want `upgrade` disableable, so we use a new option
    const upgrade = !options.dryRun;
    console.log('upgrade', upgrade);

    let startingBranch;
    let switchedBack = false;
    const logAndSwitchBackBranch = async (
      message, {errors} = {}
    ) => {
      if (errors) {
        console.log(message, repositoryPath, ...errors);
      } else {
        console.log(message, repositoryPath);
      }
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
        switchingBranchBackErrors.push({
          repositoryPath, branchName, startingBranch
        });
      }
    };

    if (upgrade) {
      try {
        startingBranch = await getBranch({repositoryPath});
      } catch (err) {
        console.log(
          'Could not get starting branch for', repositoryPath, err
        );
        startingBranchErrors.push({repositoryPath});
        return;
      }
      try {
        await switchBranch({repositoryPath, branchName});
      } catch (err) {
        console.log(
          'Erring switching to branch of repository', repositoryPath,
          'on branch', branchName, err
        );
        switchingBranchErrors.push({repositoryPath, branchName});
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
    } catch (error) {
      await logAndSwitchBackBranch(
        `Error processing npm-check-updates (with upgrade ${upgrade})`,
        {errors: [error]}
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
    } catch (error) {
      await logAndSwitchBackBranch('Error installing', {errors: [error]});
      return;
    }

    try {
      await audit({repositoryPath, args: ['fix']});
    } catch (error) {
      await logAndSwitchBackBranch(
        'Error auditing/fixing', {errors: [error]}
      );
      return;
    }

    try {
      await test({repositoryPath});
    } catch (error) {
      await logAndSwitchBackBranch(
        'Error with test', {errors: [error]}
      );
      return;
    }

    try {
      await addUnstaged({repositoryPath});
    } catch (error) {
      await logAndSwitchBackBranch(
        'Error adding unstaged files', {errors: [error]}
      );
      return;
    }

    // To avoid an empty commit, we must count the staged items since
    //  even if we added no items above, this may have been because they
    //  were added previously and committing had not succeeded or otherwise
    //  occurred.
    let filesStaged = 0;
    try {
      filesStaged = (await getStaged({repositoryPath})).length;
    } catch (error) {
      await logAndSwitchBackBranch(
        'Warning: Error getting staged items length', {errors: [error]}
      );
      return;
    }

    // Since we might have failed committing last time, we do so again
    //  by default
    if (filesStaged) {
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
              'No user info (for name and email) in global config and ' +
                'erred with local commit',
              {errors: [err, error]}
            );
            return;
          }
          // console.log('globalGitAuthorInfo', globalGitAuthorInfo);
        } catch (error) {
          await logAndSwitchBackBranch(
            'Error getting global Git author info ' +
              'and erred with local commit',
            {errors: [error, err]}
          );
          return;
        }
        if (!globalGitAuthorName || !globalGitAuthorEmail) {
          await logAndSwitchBackBranch(
            'Global Git author info empty; error with local commit',
            {errors: [err]}
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
            'Error committing with global credentials ' +
              'as with local commit',
            {errors: [err, error]}
          );
          return;
        }
      }
    }

    console.log('repositoriesToRemotes', repositoriesToRemotes);

    // Todo: Allow multiple remote retrieval as below but filter
    //   after getting list based on user's preferences (e.g., to push
    //   to `upstream` if present, or to take into account
    //   exclusions/inclusions by repo)
    const remotes = ['origin'];
    /*
    let remotes;
    try {
      remotes = repositoriesToRemotes[repoFile] ||
        await getRemotes({repositoryPath});
    } catch (error) {
      await logAndSwitchBackBranch(
        'Error getting remotes', {errors: [error]}
      );
      return;
    }
    */

    console.log('remotes', remotes);
    const {
      token, username, password
    } = {...updateConfig, token: authFileToken, ...options};

    // See https://isomorphic-git.org/docs/en/authentication.html

    await Promise.all(
      remotes.map(async (remoteName) => {
        const url = await getRemoteURL({repositoryPath, remoteName});
        console.log('Attempting to push URL', url);

        let pushed;
        try {
          pushed = await push({
            repositoryPath, remoteName, branchName,
            username, password, token, url
          });
        } catch (err) {
          // No need to switch back branch here as will do below
          console.log(
            'Error pushing to repository', repositoryPath,
            `with remote "${remoteName}"`,
            `to branch "${branchName}"`,
            // 'with token', token,
            err
          );
          pushingErrors.push({repositoryPath, branchName, remoteName});
          return undefined;
        }
        return pushed;
      })
    );
    await logAndSwitchBackBranch(
      'Finished processing'
    );
  };
});

console.log('Completed all items!\n\nSUMMARY:');

const chunkSize = options.chunkSize === 0
  ? tasks.length
  : options.chunkSize || 4;

await chunkPromises(tasks, chunkSize);

[
  {message: 'Skipped repositories:', data: skippedRepositories},
  {message: 'Erring in getting starting branch', data: startingBranchErrors},
  {message: 'Erring in switching', data: switchingBranchErrors},
  {message: 'Erring in pushing', data: pushingErrors},
  {message: 'Erring in switching branch back', data: switchingBranchBackErrors}
].forEach((info) => {
  report(info);
});
})();
