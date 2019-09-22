'use strict';
const ncu = require('npm-check-updates');

module.exports = async function ({
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
  const upgraded = await ncu.run({
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

  console.log('dependencies to upgrade:', upgraded);
};
