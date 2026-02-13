#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step, message) {
  log(`\n${step} ${message}`, 'cyan');
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

// Peer dependencies that need to be installed
const peerDependencies = [
  '@gorhom/bottom-sheet',
  'react-native-audio-recorder-player',
  '@react-native-documents/picker',
  'react-native-create-thumbnail',
  'react-native-fast-image',
  'react-native-fs',
  'react-native-gesture-handler',
  'react-native-linear-gradient',
  'react-native-nitro-modules',
  'react-native-nitro-sound',
  'react-native-permissions',
  'react-native-reanimated',
  'react-native-safe-area-context',
  'react-native-size-matters',
  'react-native-video',
  'react-native-worklets',
];

// Detect which package manager the user is using
function detectPackageManager() {
  const cwd = process.cwd();

  // Check for lock files
  if (fs.existsSync(path.join(cwd, 'yarn.lock'))) {
    return 'yarn';
  }
  if (fs.existsSync(path.join(cwd, 'pnpm-lock.yaml'))) {
    return 'pnpm';
  }
  if (fs.existsSync(path.join(cwd, 'package-lock.json'))) {
    return 'npm';
  }

  // Default to npm
  return 'npm';
}

// Check if a package is already installed
function isPackageInstalled(packageName) {
  try {
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
      return false;
    }

    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const allDeps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };

    return packageName in allDeps;
  } catch {
    return false;
  }
}

// Check if this is being run in the package's own development workspace
function isDevelopmentWorkspace() {
  try {
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
      return false;
    }

    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    return packageJson.name === '@zlucksolutions/react-native-video-editor';
  } catch {
    return false;
  }
}

// Install peer dependencies
function installPeerDependencies(packageManager) {
  logStep('📦', 'Installing peer dependencies...');

  // Filter out already installed packages
  const packagesToInstall = peerDependencies.filter((pkg) => {
    const installed = isPackageInstalled(pkg);
    if (installed) {
      log(`   ⏭️  ${pkg} (already installed)`, 'blue');
    }
    return !installed;
  });

  if (packagesToInstall.length === 0) {
    logSuccess('All peer dependencies are already installed!');
    return;
  }

  log(`\n   Installing ${packagesToInstall.length} packages...`, 'cyan');

  const installCmd =
    packageManager === 'yarn'
      ? `yarn add ${packagesToInstall.join(' ')}`
      : packageManager === 'pnpm'
      ? `pnpm add ${packagesToInstall.join(' ')}`
      : `npm install ${packagesToInstall.join(' ')}`;

  try {
    execSync(installCmd, { stdio: 'inherit', cwd: process.cwd() });
    logSuccess('Peer dependencies installed successfully!');
  } catch (error) {
    logError('Failed to install peer dependencies');
    logError(error.message);
    process.exit(1);
  }
}

// Copy patches from package to user's project
function copyPatches() {
  logStep('🔧', 'Setting up patches for peer dependencies...');

  try {
    // Find the package's patches directory
    const packagePatchesDir = path.join(__dirname, '..', 'patches');

    // Check if patches directory exists in the package
    if (!fs.existsSync(packagePatchesDir)) {
      log('   No patches found in package', 'blue');
      return;
    }

    // Create patches directory in user's project if it doesn't exist
    const userPatchesDir = path.join(process.cwd(), 'patches');
    if (!fs.existsSync(userPatchesDir)) {
      fs.mkdirSync(userPatchesDir, { recursive: true });
      log('   Created patches directory', 'green');
    }

    // Copy all patch files
    const patchFiles = fs.readdirSync(packagePatchesDir);
    let copiedCount = 0;

    patchFiles.forEach((file) => {
      if (file.endsWith('.patch')) {
        const sourcePath = path.join(packagePatchesDir, file);
        const destPath = path.join(userPatchesDir, file);
        fs.copyFileSync(sourcePath, destPath);
        log(`   ✓ Copied ${file}`, 'green');
        copiedCount++;
      }
    });

    if (copiedCount > 0) {
      logSuccess(`Copied ${copiedCount} patch file(s)`);
    } else {
      log('   No patch files to copy', 'blue');
    }
  } catch (error) {
    logWarning('Failed to copy patch files');
    logError(error.message);
  }
}

// Apply patches for peer dependencies
function applyPatches() {
  logStep('🔧', 'Applying patches to peer dependencies...');

  try {
    // Check if patch-package is available
    execSync('npx patch-package --version', { stdio: 'pipe' });

    // Apply patches
    execSync('npx patch-package', { stdio: 'inherit', cwd: process.cwd() });
    logSuccess('Patches applied successfully!');
  } catch {
    logWarning('patch-package not found or patches failed to apply');
    log('   You may need to install patch-package:', 'yellow');
    log('   npm install patch-package --save-dev', 'yellow');
  }
}

// Check if iOS directory exists
function hasIosDirectory() {
  return fs.existsSync(path.join(process.cwd(), 'ios'));
}

// Run pod install for iOS
function runPodInstall() {
  if (!hasIosDirectory()) {
    logWarning('iOS directory not found, skipping pod install');
    return;
  }

  logStep('🍎', 'Installing iOS dependencies...');

  try {
    execSync('cd ios && pod install', { stdio: 'inherit', cwd: process.cwd() });
    logSuccess('iOS dependencies installed successfully!');
  } catch {
    logWarning('Failed to run pod install. You may need to run it manually:');
    log('   cd ios && pod install', 'yellow');
  }
}

// Display setup instructions
function displaySetupInstructions() {
  log('\n' + '='.repeat(60), 'green');
  log('🎉 Installation Complete!', 'bright');
  log('='.repeat(60), 'green');

  log('\n📋 Next Steps:\n', 'cyan');

  log('1️⃣  Update your babel.config.js:', 'yellow');
  log(
    `
   /** @type {import('react-native-worklets/plugin').PluginOptions} */
   const workletsPluginOptions = {};

   module.exports = {
     overrides: [
       {
         exclude: /\\/node_modules\\//,
         presets: ['module:react-native-builder-bob/babel-preset'],
         plugins: [['react-native-worklets/plugin', workletsPluginOptions]],
       },
       {
         include: /\\/node_modules\\//,
         presets: ['module:@react-native/babel-preset'],
       },
     ],
   };
`,
    'blue'
  );

  log('2️⃣  Wrap your app with GestureHandlerRootView:', 'yellow');
  log(
    `
   import { GestureHandlerRootView } from 'react-native-gesture-handler';

   export default function App() {
     return (
       <GestureHandlerRootView style={{ flex: 1 }}>
         {/* Your app root */}
       </GestureHandlerRootView>
     );
   }
`,
    'blue'
  );

  log('3️⃣  Add VideoEditorHost to your app:', 'yellow');
  log(
    `
   import { VideoEditorHost } from '@zlucksolutions/react-native-video-editor';

   export default function App() {
     return (
       <View>
         {/* Your app content */}
         <VideoEditorHost />
       </View>
     );
   }
`,
    'blue'
  );

  log('4️⃣  Restart Metro bundler:', 'yellow');
  log('   npx react-native start --reset-cache\n', 'blue');

  log('📚 For full documentation, visit:', 'cyan');
  log(
    '   https://github.com/zlucksolutions/react-native-video-editor\n',
    'blue'
  );

  log('='.repeat(60) + '\n', 'green');
}

// Main installation process
function main() {
  log(
    '\n╔════════════════════════════════════════════════════════════╗',
    'bright'
  );
  log(
    '║  React Native Video Editor - Installation Setup           ║',
    'bright'
  );
  log(
    '╚════════════════════════════════════════════════════════════╝\n',
    'bright'
  );

  // Check if running in development workspace
  if (isDevelopmentWorkspace()) {
    logWarning('⚠️  Running in development workspace - skipping installation');
    log(
      '\nThis script is meant to be run in user projects, not in the package development workspace.',
      'yellow'
    );
    log(
      'To test the installation, create a fresh React Native project and install this package there.\n',
      'yellow'
    );
    return;
  }

  // Detect package manager
  const packageManager = detectPackageManager();
  log(`📦 Detected package manager: ${packageManager}`, 'cyan');

  // Install peer dependencies
  installPeerDependencies(packageManager);

  // Copy patches to user's project
  copyPatches();

  // Apply patches
  applyPatches();

  // Run pod install for iOS
  runPodInstall();

  // Display setup instructions
  displaySetupInstructions();
}

// Run the installation
main();
