'use strict';

/**
 * Log summarized data to console.
 * @param {PlainObject} cfg
 * @param {string} cfg.message
 * @param {string[]|PlainObject[]} cfg.data
 * @returns {void}
 */
function report ({message, data}) {
  if (!data.length) {
    return;
  }
  // Todo: i18nize
  if (typeof data[0] === 'string') {
    console.log(message, data.join(', '));
  } else {
    console.log(
      message + ' ' + data.reduce((s, {
        repositoryPath, branchName: branch, remoteName, startingBranch
      }) => {
        s += ', ';
        if (startingBranch) {
          s += `Repo "${repositoryPath}"; from branch "${startingBranch}"` +
                ` to "${branch}"`;
        } else if (repositoryPath) {
          s += `Repo "${repositoryPath}"`;
          if (branch) {
            s += `#${branch}`;
          }
          if (remoteName) {
            s += ` (${remoteName})`;
          }
        }
        return s;
      }, '').slice(2)
    );
  }
}

module.exports = report;
