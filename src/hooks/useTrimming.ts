import { useState, useCallback, useRef } from 'react';
// @ts-ignore - Peer dependency
import { useSharedValue } from 'react-native-reanimated';
import type { ActiveSegmentInfo } from '../types/segments';
import { getTimelineWidth, pixelsToTime } from '../utils/timelineUtils';

export const useTrimming = () => {
  const [isTrimming, setIsTrimming] = useState(false);
  const [isDraggingHandle, setIsDraggingHandle] = useState(false);
  const [activeSegment, setActiveSegment] = useState<ActiveSegmentInfo | null>(
    null
  );

  // Shared values for trim handles
  const timelineWidth = useSharedValue(0);
  const trimStart = useSharedValue(0);
  const trimEnd = useSharedValue(0);
  const startX = useSharedValue(0);

  // Ref to store trim offset (absolute time in original video)
  const trimOffsetRef = useRef(0);

  const initializeTrimHandles = useCallback(
    (videoDuration: number) => {
      const fullWidth = getTimelineWidth(videoDuration);
      timelineWidth.value = fullWidth;
      trimStart.value = 0;
      trimEnd.value = fullWidth;
    },
    [timelineWidth, trimStart, trimEnd]
  );

  const activateTrimTool = useCallback(() => {
    setIsTrimming(true);
    setActiveSegment({ type: 'trim' });
  }, []);

  const deactivateTrimTool = useCallback(() => {
    setIsTrimming(false);
    setActiveSegment(null);
  }, []);

  const getTrimTimes = useCallback(
    (videoDuration: number) => {
      const startTime = pixelsToTime(
        trimStart.value,
        timelineWidth.value,
        videoDuration
      );
      const endTime = pixelsToTime(
        trimEnd.value,
        timelineWidth.value,
        videoDuration
      );
      return { startTime, endTime, duration: endTime - startTime };
    },
    [trimStart, trimEnd, timelineWidth]
  );

  const resetTrimHandles = useCallback(
    (videoDuration: number) => {
      const newWidth = getTimelineWidth(videoDuration);
      timelineWidth.value = newWidth;
      trimStart.value = 0;
      trimEnd.value = newWidth;
    },
    [timelineWidth, trimStart, trimEnd]
  );

  return {
    // State
    isTrimming,
    isDraggingHandle,
    activeSegment,
    trimOffsetRef,

    // Shared values
    timelineWidth,
    trimStart,
    trimEnd,
    startX,

    // Actions
    setIsTrimming,
    setIsDraggingHandle,
    setActiveSegment,
    initializeTrimHandles,
    activateTrimTool,
    deactivateTrimTool,
    getTrimTimes,
    resetTrimHandles,
  };
};
