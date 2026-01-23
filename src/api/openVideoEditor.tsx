// src/api/openVideoEditor.ts

import EventEmitter from 'eventemitter3';
import type { VideoEditorSDKProps } from '../types';

type OpenEditorPayload = {
  options: Omit<VideoEditorSDKProps, 'onCloseEditor'>;
  resolve: (result: {
    success: boolean;
    exportedUri?: string;
    error?: string;
  }) => void;
};

export const editorEventEmitter = new EventEmitter<{
  OPEN_VIDEO_EDITOR: [OpenEditorPayload];
}>();

export const OPEN_EDITOR_EVENT = 'OPEN_VIDEO_EDITOR';

export const openVideoEditor = (
  options: Omit<VideoEditorSDKProps, 'onCloseEditor'>
): Promise<{
  success: boolean;
  exportedUri?: string;
  error?: string;
}> => {
  return new Promise((resolve) => {
    editorEventEmitter.emit(OPEN_EDITOR_EVENT, {
      options,
      resolve,
    });
  });
};
