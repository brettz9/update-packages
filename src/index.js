'use strict';
const Git = require('nodegit');
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
  packageFileDir, // = false
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
    packageFileDir,
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
  const repository = await Git.Repository.open(repositoryPath);
  return Git.Remote.list(repository);
};

exports.switchBranch = async ({repositoryPath, branchName}) => {
  const repository = await Git.Repository.open(repositoryPath);
  const reference = await repository.getBranch(
    'refs/remotes/origin/' + branchName
  );
  return repository.checkoutRef(reference);
};

exports.commit = async ({repositoryPath}) => {
  const repository = await Git.Repository.open(repositoryPath);
  // Todo: Finish
  Git.Commit.create(repository);
};
