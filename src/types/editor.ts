// Editor configuration and state types
import type { Segment } from './segments';

export interface VideoNaturalSize {
  width: number;
  height: number;
}

export type AspectRatioType = 'original' | '9:16' | '1:1' | '16:9';

export interface AspectRatioOption {
  label: string;
  value: AspectRatioType;
}

export interface EditorToolConfig {
  id: string;
  label: string;
  icon: string;
  enabled: boolean;
}

export type ToolType = 'music' | 'text' | 'crop' | 'trim' | 'voice';

export interface ExportVideoElement {
  type:
    | 'videoUri'
    | 'crop'
    | 'trim'
    | 'addBGM'
    | 'addTextOverlay'
    | 'addVoiceOver';
  [key: string]: any;
}

export interface ExportConfig {
  videoElements: ExportVideoElement[];
  isVisionCameraVideo: boolean;
}

export interface EditorState {
  segments: {
    audio: Segment[];
    text: Segment[];
    voiceover: Segment[];
  };
  selectedAspectRatio: AspectRatioType;
  isMuted: boolean;
  isProcessing: boolean;
}
