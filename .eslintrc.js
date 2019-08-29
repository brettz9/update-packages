module.exports = {
  extends: ["ash-nazg/sauron-node", "plugin:node/recommended-script"],
  env: {
    node: true
  },
  settings: {
      polyfills: [
      ]
  },
  rules: {
    "no-console": 0
  }
};
