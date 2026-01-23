// src/types/index.ts

export type VideoEditorSDKProps = {
  source: string;

  editTrim?: boolean;
  editCrop?: boolean;
  editBGM?: boolean;
  editTextOverlay?: boolean;
  editVoiceOver?: boolean;

  onCloseEditor: (result: {
    success: boolean;
    exportedUri?: string;
    error?: string;
  }) => void;
};

// Export all types
export * from './segments';
export * from './timeline';
export * from './editor';
