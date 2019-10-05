'use strict';

// Todo: Add `description` and `typeLabel` (e.g., '{underline argTypeName}')
const optionDefinitions = [
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
  {name: 'repository', type: String, alias: 'y', multiple: true},
  {name: 'basePath', type: String, alias: 'b'},
  {name: 'configFile', type: String, alias: 'c'},
  {name: 'dryRun', type: Boolean},
  {name: 'branchName', type: String},
  {name: 'stayOnChangedBranch', type: Boolean},

  // Git
  {name: 'token', type: String, alias: 'o'},

  // Defaults to checking local config and then global config
  {name: 'username', type: String},
  {name: 'password', type: String},

  {name: 'chunkSize', type: Number},
  {name: 'limit', type: Number},

  {name: 'help', type: Boolean}
];

const cliSections = [
  {
    header: 'update-packages',
    // Add italics: `{italic textToItalicize}`
    content: 'Update npm packages.'
  },
  {
    header: 'Options',
    optionList: optionDefinitions
  }
];

exports.definitions = optionDefinitions;
exports.sections = cliSections;
