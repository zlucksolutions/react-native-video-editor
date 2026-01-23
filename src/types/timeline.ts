// Timeline related types
export interface ThumbnailData {
  uri: string;
  width: number;
  status: 'success' | 'failed' | 'replaced';
  index?: number;
  originalStatus?: string;
}

export interface TimelineState {
  currentTime: number;
  videoDuration: number;
  originalDuration: number;
  isPlaying: boolean;
  isMuted: boolean;
  trimOffset: number;
}

export interface TimelineUIState {
  isTimelineVisible: boolean;
  isUserScrolling: boolean;
  isDraggingHandle: boolean;
  isTrimming: boolean;
}

export interface TrimHandles {
  trimStart: number; // in pixels
  trimEnd: number; // in pixels
  timelineWidth: number; // in pixels
}

export interface AudioTrimInfo {
  uri: string;
  name: string;
  startTime: number;
  duration: number;
  isLooped: boolean;
}
