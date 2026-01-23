import { PIXELS_PER_SECOND, SCREEN_WIDTH } from '../constants/dimensions';

/**
 * Calculate timeline width based on video duration
 */
export const getTimelineWidth = (videoDuration: number): number => {
  return Math.max(SCREEN_WIDTH - 80, videoDuration * PIXELS_PER_SECOND);
};

/**
 * Format time in MM:SS format
 */
export const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

/**
 * Calculate segment position and width on timeline
 */
export const getSegmentPosition = (
  start: number,
  duration: number,
  videoDuration: number,
  timelineWidth: number
): { left: number; width: number } => {
  if (videoDuration <= 0 || timelineWidth <= 0) {
    return { left: 0, width: 0 };
  }
  return {
    left: (start / videoDuration) * timelineWidth,
    width: (duration / videoDuration) * timelineWidth,
  };
};

export const pixelsToTime = (
  pixels: number,
  timelineWidth: number,
  videoDuration: number
): number => {
  'worklet';
  return (pixels / timelineWidth) * videoDuration;
};

/**
 * Convert time to pixels
 */
export const timeToPixels = (
  time: number,
  timelineWidth: number,
  videoDuration: number
): number => {
  return (time / videoDuration) * timelineWidth;
};

/**
 * Clamp value between min and max
 */
export const clamp = (value: number, min: number, max: number): number => {
  return Math.max(min, Math.min(max, value));
};

/**
 * Check if video is from vision camera
 */
export const isVisionCameraVideo = (videoUri: string): boolean => {
  return !videoUri.includes('react-native-image-crop-picker');
};
