/** @type {import('react-native-worklets/plugin').PluginOptions} */
const workletsPluginOptions = {
  // Your custom options.
};

module.exports = {
  overrides: [
    {
      exclude: /\/node_modules\//,
      presets: ['module:react-native-builder-bob/babel-preset'],
      // plugins: [['react-native-worklets/plugin', workletsPluginOptions]],
    },
    {
      include: /\/node_modules\//,
      presets: ['module:@react-native/babel-preset'],
    },
  ],
};
