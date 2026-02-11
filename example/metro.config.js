const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const root = path.resolve(__dirname, '..');
const pak = require('../package.json');

// Get all dependencies that should come from example's node_modules
const modules = [
  'react',
  'react-native',
  ...Object.keys({
    ...pak.peerDependencies,
  }),
];

const config = {
  projectRoot: __dirname,
  watchFolders: [root],

  resolver: {
    // Map the library to parent directory AND redirect React/RN to example's node_modules
    extraNodeModules: modules.reduce(
      (acc, name) => {
        if (name === 'react-native-video-editor') {
          // Map your library to the parent directory
          acc[name] = root;
        } else {
          // Map everything else (especially react and react-native) to example's node_modules
          acc[name] = path.join(__dirname, 'node_modules', name);
        }
        return acc;
      },
      {
        // Explicitly add the library mapping
        'react-native-video-editor': root,
      }
    ),

    // Ensure we always use example's node_modules for dependencies
    nodeModulesPaths: [path.resolve(__dirname, 'node_modules')],
  },

  transformer: {
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: true,
      },
    }),
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
