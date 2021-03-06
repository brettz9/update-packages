#!/usr/bin/env node
/* eslint-disable no-return-await */
'use strict';

const fs = require('fs');
const util = require('util');
const {basename} = require('path');
const os = require('os');

const {chunkPromises} = require('chunk-promises');
const {cliBasics} = require('command-line-basics');

const report = require('../src/report.js');

// Todo: could i18nize
const _ = require('../src/messages/en/messages.json');

const {
  install, audit, test,
  findGitRepos, getGlobalGitAuthorInfo, getRemoteURL,
  processUpdates, switchBranch, getBranch, getRemotes,
  addUnstaged, getStaged, commit, push
} = require('../src/index.js');

const writeFile = util.promisify(fs.writeFile);

const substitute = (str, data) => {
  return Object.entries(data).reduce((s, [ky, val]) => {
    // Todo: This only allows one replacement
    return s.replace('${' + ky + '}', val);
  }, str) || str;
};

const log = (key, data = {}, ...other) => {
  console.log(substitute(_[key], data), ...other);
  return key;
};

const options = cliBasics({
  optionsPath: '../src/optionDefinitions.js',
  cwd: __dirname
});
if (!options) {
  return;
}

(async () => {
// Todo: Some should probably not be command line as vary per repo
// Todo: Could convert slash-delimited strings into regexes for relevant
//   options (`filter`, `reject`); could build on top of `command-line-args`
//   and `command-line-usage` for standard conventional handlings of various
//   additional types like this
const {
  basePath = os.homedir(),
  configFile = basePath ? `${basePath}/update-packages.json` : null,
  authFile = basePath ? `${basePath}/.update-packages-auth.json` : null,
  reportFile = basePath ? `${basePath}/.update-packages-report.json` : null,
  branchName = 'master',
  duration = 1000 * 60 * 60 * 24,
  defaultAllowedRemotes = ['origin'],
  commitMessage = 'Updated deps or devDeps'
} = options;

let updateConfig = {};
let excludeRepositories = [], repositoriesToRemotes = {};

let authFileToken;
if (authFile) {
  try {
    // eslint-disable-next-line global-require, import/no-dynamic-require
    ({token: authFileToken} = require(authFile));
  } catch (err) {
    console.log(_.error, err);
    throw new Error(`Error retrieving token file "${authFile}" \`token\`.`);
  }
}
if (configFile) {
  try {
    // eslint-disable-next-line global-require, import/no-dynamic-require
    updateConfig = require(configFile);
    ({
      excludeRepositories = [], repositoriesToRemotes = {}
    } = updateConfig);
  } catch (err) {
    console.log(_.error, err);
    throw new Error(`Error retrieving config file "${configFile}" JSON.`);
  }
}

const getReportFileObject = function () {
  let reportFileObject = reportFile ? {repositories: {}} : null;
  if (reportFile) {
    try {
      // eslint-disable-next-line global-require, import/no-dynamic-require
      reportFileObject = require(reportFile);
    } catch (err) {
      log('noReportFileFound', {reportFile});
      // console.log(_.error, err);
      // throw new Error(`Error retrieving report file "${reportFile}" JSON.`);
    }
  }
  return reportFileObject;
};
let reportFileObject = getReportFileObject();

let repositoryPaths;
try {
  ({
    repository: repositoryPaths = await findGitRepos({basePath})
  } = options);
} catch (err) {
  console.log(_.errorRetrievingGitRepos, basePath, err);
  throw err;
}

// console.log('repositoryPaths', repositoryPaths);

const statuses = {
  skippedRepositories: [],
  startingBranchErrors: [],
  switchingBranchErrors: [],
  switchingBranchBackErrors: [],
  miscErrors: {},
  noMatchingRemotes: [],
  pushingErrors: [],
  completed: []
};

const getLastCheckedTimestamp = () => {
  return {
    lastChecked: new Date().getTime()
  };
};

const addErrors = (key, data) => {
  const errors = Array.isArray(key)
    ? statuses[key[0]][key[1]]
    : statuses[key];
  errors.push({...data, ...getLastCheckedTimestamp()});
  return key;
};

let reportErrorString;

const tasks = repositoryPaths.slice(
  0, options.limit || repositoryPaths.length
).map((repositoryPath) => {
  return () => (async () => {
    const repoFile = basename(repositoryPath);

    if (reportFileObject && reportFileObject.repositories) {
      const repoInfo = reportFileObject.repositories[repositoryPath];
      if (repoInfo) {
        // Todo: `type` (see `statuses` just above) and any necessary
        //  data specific to each
        if (repoInfo.type === 'completed') {
          if (repoInfo.lastChecked + duration > new Date().getTime()) {
            log('skipRecentlyChecked', {repositoryPath});
            return 'skipped';
          }
        } else if (options.skipErring) {
          log('skipErringRepository', {repositoryPath});
          return 'skipped';
        }
      }
    }

    // console.log('repoFile', repositoryPath, repoFile);
    if (excludeRepositories.includes(repoFile)) {
      console.log(_.skippingRepository, repoFile);
      return addErrors('skippedRepositories', {repositoryPath});
    }

    // We want `upgrade` disableable, so we use a new option
    const upgrade = !options.dryRun;
    console.log(_.upgrade, upgrade);

    let startingBranch;
    let switchedBack = false;
    const logAndSwitchBackBranch = async (
      key, {errors = []} = {}, data = {}
    ) => {
      const message = substitute(_[key], data);
      if (errors.length) {
        console.log(message, repositoryPath, ...errors);
        if (!statuses.miscErrors[key]) {
          statuses.miscErrors[key] = [];
        }
        addErrors(['miscErrors', key], {repositoryPath, errors});
      } else {
        console.log(message, repositoryPath);
      }
      if (switchedBack ||
        !upgrade ||
        startingBranch === branchName ||
        options.stayOnChangedBranch
      ) {
        return ['miscErrors', key];
      }
      try {
        await switchBranch({repositoryPath, branchName: startingBranch});
        log(
          'switchedBranchBack', {repositoryPath, startingBranch}
        );
        // eslint-disable-next-line require-atomic-updates
        switchedBack = true;
      } catch (err) {
        log(
          'couldNotSwitchBackBranch',
          {repositoryPath, startingBranch},
          err
        );
        addErrors('switchingBranchBackErrors', {
          repositoryPath, branchName, startingBranch
        });
      }
      return ['miscErrors', key];
    };

    if (upgrade) {
      try {
        startingBranch = await getBranch({repositoryPath});
      } catch (err) {
        log(
          'couldNotGetStartingBranch', {repositoryPath}, err
        );
        return addErrors('startingBranchErrors', {repositoryPath});
      }
      try {
        await switchBranch({repositoryPath, branchName});
      } catch (err) {
        log(
          'errorSwitchingToBranch',
          {repositoryPath, branchName}, err
        );
        return addErrors('switchingBranchErrors', {repositoryPath});
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
      return await logAndSwitchBackBranch(
        'npmCheckUpdatesError',
        {errors: [error]},
        {upgrade}
      );
    }

    log('dependenciesToUpgrade', {
      repositoryPath, upgraded: JSON.stringify(upgraded)
    });
    if (!upgrade) {
      console.log(_.finishedProcessingNoUpdate, repositoryPath);
      return undefined;
    }

    // We install even if the upgrades were empty in case failed previously
    //  at this step
    try {
      await install({repositoryPath});
    } catch (error) {
      return await logAndSwitchBackBranch(
        'installError', {errors: [error]}
      );
    }

    try {
      await audit({repositoryPath, args: ['fix']});
    } catch (error) {
      return await logAndSwitchBackBranch(
        'auditingOrFixError', {errors: [error]}
      );
    }

    try {
      await test({repositoryPath});
    } catch (error) {
      return await logAndSwitchBackBranch(
        'testError', {errors: [error]}
      );
    }

    try {
      await addUnstaged({repositoryPath});
    } catch (error) {
      return await logAndSwitchBackBranch(
        'addUnstagedError', {errors: [error]}
      );
    }

    // To avoid an empty commit, we must count the staged items since
    //  even if we added no items above, this may have been because they
    //  were added previously and committing had not succeeded or otherwise
    //  occurred.
    let filesStaged = 0;
    try {
      filesStaged = (await getStaged({repositoryPath})).length;
    } catch (error) {
      return await logAndSwitchBackBranch(
        'getStagedItemsLengthError',
        {errors: [error]}
      );
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
            return await logAndSwitchBackBranch(
              'userNameEmailCommitError',
              {errors: [err, error]}
            );
          }
          // console.log('globalGitAuthorInfo', globalGitAuthorInfo);
        } catch (error) {
          return await logAndSwitchBackBranch(
            'getGlobalGitAuthorInfoError',
            {errors: [error, err]}
          );
        }
        if (!globalGitAuthorName || !globalGitAuthorEmail) {
          return await logAndSwitchBackBranch(
            'emptyGitAuthorInfoError',
            {errors: [err]}
          );
        }
        try {
          // Todo: Add updating `newVersion` and `oldVersion` for
          //  substitution here, as well as devDep vs. dep.
          const message = substitute(commitMessage, {});
          await commit({repositoryPath, message, author: {
            name: globalGitAuthorName,
            email: globalGitAuthorEmail
          }});
        } catch (error) {
          return await logAndSwitchBackBranch(
            'globalCredentialsCommitError',
            {errors: [err, error]}
          );
        }
      }
    }

    console.log('repositoriesToRemotes', repositoriesToRemotes);

    let remotes, foundRemotes = '';
    try {
      remotes = repositoriesToRemotes[repoFile];
      if (!remotes || !remotes.length) {
        foundRemotes = await getRemotes({repositoryPath});
        remotes = foundRemotes.filter((remote) => {
          return defaultAllowedRemotes.includes(remote);
        });
      }
    } catch (error) {
      return await logAndSwitchBackBranch(
        'getRemoteError', {errors: [error]}
      );
    }

    if (!remotes.length) {
      return await logAndSwitchBackBranch('noMatchingRemotes', {
        errors: []
      }, {
        repositoryPath,
        foundRemotes: foundRemotes.join(_.listJoiner)
      });
    }

    console.log(_.remotes, remotes);
    const {
      token, username, password
    } = {...updateConfig, token: authFileToken, ...options};

    // See https://isomorphic-git.org/docs/en/authentication.html

    // Todo: We could store the result of each remote
    try {
      await Promise.all(
        remotes.map(async (remoteName) => {
          const url = await getRemoteURL({repositoryPath, remoteName});
          console.log(_.pushingURL, url);

          let pushed;
          try {
            pushed = await push({
              repositoryPath, remoteName, branchName,
              username, password, token, url
            });
          } catch (err) {
            // No need to switch back branch here as will do below
            log(
              'errorPushing',
              {repositoryPath, remoteName, branchName, token},
              err
            );
            const data = {
              repositoryPath, branchName, remoteName
            };
            addErrors('pushingErrors', data);
            const error = new Error();
            error.data = data;
            error.type = 'pushingErrors';
            throw error;
          }
          addErrors('completed', {repositoryPath, remoteName});
          return pushed;
        })
      );
    } catch (error) {
      return error.type;
    }
    await logAndSwitchBackBranch(
      'processFinished'
    );
    return 'completed';
  // eslint-disable-next-line promise/prefer-await-to-then
  })().then(async (statusKey) => {
    if ((!statusKey && options.dryRun) || statusKey === 'skipped') {
      // Wasn't able to retrieve before, so we won't try again
      return undefined;
    }
    reportFileObject = getReportFileObject();
    try {
      const resultsToReportJSON = (ky) => {
        const data = (Array.isArray(ky)
          ? statuses[ky[0]][ky[1]]
          : statuses[ky]).slice(-1)[0];

        if (!reportFileObject.repositories) {
          reportFileObject.repositories = {};
        }
        reportFileObject.repositories[repositoryPath] = {
          type: ky,
          ...data
        };
      };
      resultsToReportJSON(statusKey);
      await writeFile(
        reportFile,
        JSON.stringify(reportFileObject, null, 2) + '\n'
      );
    } catch (err) {
      console.log(_.errorWritingReportFile, err);
      ({reportErrorString} = _);
    }
    return undefined;
  });
});

const chunkSize = options.chunkSize === 0
  ? tasks.length
  : options.chunkSize || 4;

await chunkPromises(tasks, chunkSize);

const results = [
  'completed',
  'skippedRepositories',
  'startingBranchErrors',
  'switchingBranchErrors',
  'noMatchingRemotes',
  'pushingErrors',
  'switchingBranchBackErrors'
];

console.log(_.completedSummary);

results.forEach((key) => {
  // Inject before pushing
  if (key === 'pushingErrors') {
    // `miscErrors` also contains `errors`, but we don't output them here
    Object.entries(statuses.miscErrors).forEach(([ky, data]) => {
      report({message: _[ky], data});
    });
  }
  report({message: _[key], data: statuses[key]});
});
if (reportErrorString) {
  console.log(reportErrorString);
}
})();
