// src/components/VideoEditorHost.tsx

import React, { useEffect, useRef, useState } from 'react';
// @ts-ignore - Peer dependency
import { Modal } from 'react-native';

import { VideoEditorSDK } from './VideoEditorSDK';
import { editorEventEmitter, OPEN_EDITOR_EVENT } from '../api/openVideoEditor';
import type { VideoEditorSDKProps } from '../types';

type EditorRequest = {
  options: Omit<VideoEditorSDKProps, 'onCloseEditor'>;
  resolve: (result: any) => void;
};

export const VideoEditorHost: React.FC = () => {
  const [visible, setVisible] = useState(false);
  const [editorOptions, setEditorOptions] = useState<Omit<
    VideoEditorSDKProps,
    'onCloseEditor'
  > | null>(null);

  const resolveRef = useRef<((result: any) => void) | null>(null);

  useEffect(() => {
    const handler = ({ options, resolve }: EditorRequest) => {
      resolveRef.current = resolve;
      setEditorOptions(options);
      setVisible(true);
    };

    editorEventEmitter.on(OPEN_EDITOR_EVENT, handler);
    return () => {
      editorEventEmitter.off(OPEN_EDITOR_EVENT, handler);
    };
  }, []);

  const handleClose = (result: any) => {
    setVisible(false);
    resolveRef.current?.(result);
    resolveRef.current = null;
    setEditorOptions(null);
  };

  if (!editorOptions) return null;

  return (
    <Modal visible={visible} animationType="slide">
      <VideoEditorSDK {...editorOptions} onCloseEditor={handleClose} />
    </Modal>
  );
};
