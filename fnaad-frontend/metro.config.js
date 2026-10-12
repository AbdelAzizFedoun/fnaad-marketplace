const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;

const config = getDefaultConfig(projectRoot);

config.resolver = config.resolver || {};
config.resolver.blockList = config.resolver.blockList || [];
config.resolver.blockList.push(/.*\/node_modules\/.*\/node_modules\/react-native\/.*/);

config.transformer = {
  ...(config.transformer || {}),
  minifierPath: require.resolve("metro-minify-terser"),
  minifierConfig: {
    keep_classnames: true,
    keep_fnames: true,
    mangle: {
      keep_classnames: true,
      keep_fnames: true,
    },
  },
};

module.exports = config;
