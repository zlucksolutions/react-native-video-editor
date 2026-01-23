const path = require('path');
const { getConfig } = require('react-native-builder-bob/babel-config');
const pkg = require('../package.json');

const root = path.resolve(__dirname, '..');

/** @type {import('react-native-worklets/plugin').PluginOptions} */
const workletsPluginOptions = {
  // Your custom options.
};

const config = getConfig(
  {
    presets: ['module:@react-native/babel-preset'],
  },
  { root, pkg }
);

// Ensure worklets plugin is last (required by Reanimated)
if (config.plugins) {
  // Remove worklets if it exists elsewhere
  config.plugins = config.plugins.filter(
    (plugin) =>
      !(Array.isArray(plugin) && plugin[0] === 'react-native-worklets/plugin')
  );
  // Add it at the end
  config.plugins.push(['react-native-worklets/plugin', workletsPluginOptions]);
} else {
  config.plugins = [['react-native-worklets/plugin', workletsPluginOptions]];
}

module.exports = config;
