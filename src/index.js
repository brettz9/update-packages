'use strict';
const ncu = require('npm-check-updates');

(async () => {
const upgraded = await ncu.run({
  // Any command-line option can be specified here.
  // These are set by default:
  jsonUpgraded: true,
  packageManager: 'npm',
  silent: true,
  packageFile: ''
});

console.log('dependencies to upgrade:', upgraded);
})();
