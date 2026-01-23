// src/native/VideoEditorNative.ts

import { NativeModules, Platform } from 'react-native';

interface VideoEditorSdkModule {
  applyEdits: (config: any) => Promise<string>;
  cleanupTempFiles?: () => void;
  exportVideoFromTemp?: (
    videoPath: string,
    fileName: string
  ) => Promise<string>;
}

// Android uses "VideoEditor" as the module name, iOS uses "VideoEditorSdk"
const moduleName = Platform.OS === 'android' ? 'VideoEditor' : 'VideoEditorSdk';
const VideoEditorModule = NativeModules[moduleName];

if (!VideoEditorModule) {
  throw new Error(
    `${moduleName} native module is not linked. Please run pod install (iOS) or rebuild the app (Android).`
  );
}

export const VideoEditorNative = VideoEditorModule as VideoEditorSdkModule;
