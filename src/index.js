'use strict';
const fs = require('fs');
const {basename} = require('path');

const npm = require('npm');
const git = require('isomorphic-git');
const parseGitConfig = require('parse-git-config');
const parseGithubURL = require('parse-github-url');
const getGitConfigPath = require('git-config-path');

const ncu = require('npm-check-updates');
const rcLoader = require('rc-config-loader');

git.plugins.set('fs', fs);

exports.processUpdates = function ({
  configFilePath, // = './',
  configFileName, // = '.ncurc.{json,yml,js}',
  dep, // prod|dev|peer|optional|bundle (comma-delimited)
  errorLevel, // 1|2
  filter, // comma-or-space-delimited list, or /regex/
  // eslint-disable-next-line no-shadow
  global, // = false
  greatest, // = false
  interactive, // = false
  jsonAll, // = false
  jsonUpgraded, // = true (defaults to false in CLI)
  // = 'silent',
  // silent|error|warn|info|verbose|silly (defaults to "warn" in CLI)
  loglevel,
  minimal, // = false
  newest, // = false
  packageData, // = false
  packageFile, // = './package.json'
  packageManager, // = 'npm', // npm|bower
  pre, // 0|1
  registry, // (third party registry)
  reject, // string, comma-delimited list, or regex
  removeRange, // = false
  semverLevel, // = false
  silent, // --loglevel=silent
  timeout, // = 0 // (ms)
  upgrade, // = false
  version
} = {}) {
  // This API is only within the ncu binary, so we repeat the logic here,
  //   minus the formatting as CLI arguments; see
  //   https://github.com/tjunnone/npm-check-updates/blob/master/bin/ncu#L58-L67

  // Todo: Get `configFilePath` based on `packageFile` by default
  const rcFile = rcLoader('ncurc', {
    configFileName: configFileName || '.ncurc',
    defaultExtension: ['.json', '.yml', '.js'],
    cwd: configFilePath || undefined
  });
  const rcArguments = rcFile && rcFile.config
    ? Object.entries(rcFile.config).reduce((o, [name, value]) => {
      o[name] = value;
      return o;
    }, {})
    : [];

  return ncu.run({
    // Config file only as default as CLI may override
    ...rcArguments,

    // Any command-line option can be specified here.

    // Pass in user config
    configFilePath,
    configFileName,
    dep,
    errorLevel,
    filter,
    global,
    greatest,
    interactive,
    jsonAll,
    jsonUpgraded,
    loglevel,
    minimal,
    newest,
    packageData,
    packageFile,
    packageManager,
    pre,
    registry,
    reject,
    removeRange,
    semverLevel,
    silent,
    timeout,
    upgrade,
    version
  });
};

exports.getRemotes = async ({repositoryPath}) => {
  const remoteObjs = await git.listRemotes({dir: repositoryPath});
  return remoteObjs.map(({remote: remoteName}) => remoteName);
};

exports.switchBranch = ({repositoryPath, branchName}) => {
  return git.checkout({dir: repositoryPath, ref: branchName});
};

exports.getBranch = ({repositoryPath}) => {
  return git.currentBranch({dir: repositoryPath});
};

const getUnstaged = exports.getUnstaged = async ({repositoryPath}) => {
  const FILE = 0, WORKDIR = 2, STAGE = 3;

  const fileNames = (await git.statusMatrix({dir: repositoryPath}))
    .filter((row) => row[WORKDIR] !== row[STAGE])
    .map((row) => row[FILE]);
  return fileNames;
};

exports.getStaged = async ({repositoryPath}) => {
  const FILE = 0, WORKDIR = 2, STAGE = 3;

  const fileNames = (await git.statusMatrix({dir: repositoryPath}))
    .filter((row) => row[WORKDIR] === row[STAGE])
    .map((row) => row[FILE]);
  return fileNames;
};

exports.addUnstaged = async ({repositoryPath}) => {
  const fileNames = await getUnstaged({repositoryPath});
  return Promise.all(fileNames.map((fileName) => {
    return git.add({dir: repositoryPath, filepath: fileName});
  }));
};

exports.commit = ({repositoryPath, author}) => {
  return git.commit({
    dir: repositoryPath,
    message: 'Updated deps or devDeps',
    author
  });
};

exports.getRemoteURL = async ({repositoryPath, remoteName}) => {
  // Can use npm package `gitconfig` if problem here not getting home
  const gitStyleURL = await git.config({
    dir: repositoryPath,
    path: `remote.${remoteName}.url`
  });
  const {
    host,
    repo,
    protocol
  } = parseGithubURL(gitStyleURL);
  return `${protocol || 'https://'}${host}/${repo}`;
};

exports.push = ({
  repositoryPath, remoteName, branchName, token, username, password,
  url
}) => {
  console.log(
    'repositoryPath, remoteName, branchName',
    repositoryPath, remoteName, branchName
  );

  return git.push({
    dir: repositoryPath,
    remote: remoteName,
    ref: branchName,
    token,
    username, password,
    url
  });
};

exports.install = ({repositoryPath, args = []}) => {
  // eslint-disable-next-line promise/avoid-new
  return new Promise(function (resolve, reject) {
    npm.load({
      loaded: false,
      progress: false,
      prefix: repositoryPath
    // eslint-disable-next-line promise/prefer-await-to-callbacks
    }, (err) => {
      if (err) {
        reject(err);
        return;
      }
      npm.commands.install(repositoryPath, args, (error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  });
};

// fix; if problematic, use https://github.com/Vispercept/run-npm-audit ?
// check user/global npm audit config
exports.audit = ({repositoryPath, args} = {}) => {
  // eslint-disable-next-line promise/avoid-new
  return new Promise(function (resolve, reject) {
    npm.load({
      loaded: false,
      progress: false,
      prefix: repositoryPath
    // eslint-disable-next-line promise/prefer-await-to-callbacks
    }, (err) => {
      if (err) {
        reject(err);
        return;
      }
      npm.commands.audit(args, (error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  });
};

exports.test = ({repositoryPath, args = []} = {}) => {
  // eslint-disable-next-line promise/avoid-new
  return new Promise(function (resolve, reject) {
    npm.load({
      loaded: false,
      progress: false,
      prefix: repositoryPath
    // eslint-disable-next-line promise/prefer-await-to-callbacks
    }, (err) => {
      if (err) {
        reject(err);
        return;
      }
      npm.commands.test(args, (error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  });
};

exports.findGitRepos = ({basePath}) => {
  // eslint-disable-next-line promise/avoid-new
  return new Promise(function (resolve, reject) {
    // eslint-disable-next-line node/prefer-promises/fs
    fs.readdir(basePath, (error, files) => {
      if (error) {
        reject(error);
        return;
      }
      const repoFiles = files.map((file) => {
        return basePath + '/' + file;
      }).filter((file) => {
        return !basename(file).startsWith('.') &&
          // eslint-disable-next-line no-sync
          fs.existsSync(file + '/.git') &&
          // eslint-disable-next-line no-sync
          fs.existsSync(file + '/package.json');
      });
      resolve(repoFiles);
    });
  });
};

exports.getGlobalGitAuthorInfo = async () => {
  const globalGitConfigPath = getGitConfigPath('global');
  const parsedConfig = await parseGitConfig({
    path: globalGitConfigPath
  });
  return parsedConfig;
};
