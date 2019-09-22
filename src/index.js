'use strict';
const fs = require('fs');
const {basename} = require('path');

const npm = require('npm');
const git = require('isomorphic-git');

git.plugins.set('fs', fs);

const ncu = require('npm-check-updates');

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
  // packageFileDir, // = false
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
  return ncu.run({
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
    // packageFileDir,
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

const getUnstaged = exports.getUnstaged = async ({repositoryPath}) => {
  const FILE = 0, WORKDIR = 2, STAGE = 3;

  const fileNames = (await git.statusMatrix({dir: repositoryPath}))
    .filter((row) => row[WORKDIR] !== row[STAGE])
    .map((row) => row[FILE]);
  return fileNames;
};

exports.addUnstaged = async ({repositoryPath}) => {
  const fileNames = await getUnstaged({repositoryPath});
  return Promise.all(fileNames.map((fileName) => {
    return git.add({dir: repositoryPath, filepath: fileName});
  }));
};

exports.commit = ({repositoryPath}) => {
  return git.commit({
    dir: repositoryPath,
    message: 'Updated deps or devDeps'
  });
};

exports.push = ({repositoryPath, remoteName, branchName, token}) => {
  return git.push({
    dir: repositoryPath,
    remote: remoteName,
    ref: branchName,
    token
  });
};

exports.install = ({repositoryPath, args = []}) => {
  // eslint-disable-next-line promise/avoid-new
  return new Promise(function (resolve, reject) {
    npm.load({
      // What "cli" config would go here?
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
exports.audit = ({args} = {}) => {
  // eslint-disable-next-line promise/avoid-new
  return new Promise(function (resolve, reject) {
    npm.audit(args, (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
};

exports.test = ({args} = {}) => {
  // eslint-disable-next-line promise/avoid-new
  return new Promise(function (resolve, reject) {
    npm.test(args, (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
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
