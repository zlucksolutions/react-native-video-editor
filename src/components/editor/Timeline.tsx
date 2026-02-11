import React, { useEffect, useRef, useCallback, useMemo } from 'react';
// @ts-ignore - Peer dependency
import {
  View,
  Pressable,
  ScrollView,
  Text,
  Platform,
  Image,
} from 'react-native';
// @ts-ignore - Peer dependency
import Animated, {
  useAnimatedScrollHandler,
  useSharedValue,
  runOnJS,
  useAnimatedStyle,
  useAnimatedReaction,
  // @ts-ignore - Peer dependency
} from 'react-native-reanimated';
// @ts-ignore - Peer dependency
import { moderateScale } from 'react-native-size-matters';
// @ts-ignore - Peer dependency
import FastImage from 'react-native-fast-image';
// @ts-ignore - Peer dependency
import {
  ScrollView as GHScrollView,
  Gesture,
  GestureDetector,
  Pressable as GHPressable,
  // @ts-ignore - Peer dependency
} from 'react-native-gesture-handler';
import { useEditorState } from '../../context/EditorStateContext';
import { useEditorContext } from '../../context/EditorContext';
// @ts-ignore - Peer dependency
import { pick, keepLocalCopy, types } from '@react-native-documents/picker';
import { useThumbnails } from '../../hooks/useThumbnails';
import { useTrimming } from '../../hooks/useTrimming';
import {
  getTimelineWidth,
  pixelsToTime,
  getSegmentPosition,
} from '../../utils/timelineUtils';
import {
  TIMELINE_MARGIN_HORIZONTAL,
  SCREEN_WIDTH,
  HANDLE_WIDTH,
  MIN_DURATION_PIXELS,
  MIN_WIDTH_FOR_LOOP_NUMBER,
  MIN_WIDTH_FOR_LOOP_NAME,
} from '../../constants/dimensions';
import { deviceUtils } from '../../utils/deviceUtils';
import { TimelineHeader } from '../timeline/TimelineHeader';
import { createTimelineStyles } from './TimelineStyles';
// @ts-ignore - Peer dependency
import { MuteIcon, UnMuteIcon, TrashIcon } from '../../assets/icons/index.js';

const RNScrollView = Animated.ScrollView;
const ScrollWrapper = deviceUtils.isIOS
  ? (ScrollView as any)
  : (GHScrollView as any);
const PressableWrapper = Platform.OS === 'ios' ? Pressable : GHPressable;

type TimelineProps = {
  videoSource?: string;
  onSegmentPress?: () => void;
  onCloseTimeline?: () => void;
};

export const Timeline: React.FC<TimelineProps> = ({
  videoSource,
  onSegmentPress,
  onCloseTimeline,
}) => {
  const {
    getPlaybackState,
    isPlaying,
    setIsPlaying,
    setCurrentTime,
    setTrim,
    setDuration,
    getTrim,
    isTrimming,
    setIsTrimming,
    setIsDraggingHandle,
    audioSegments,
    textSegments,
    setActiveSegment,
    removeAudioSegment,
    removeTextSegment,
    activeSegment,
    videoRef,
    setAudioUri,
    setIsTextEditorVisible,
    setEditingTextElement,
    isMuted,
    setIsMuted,
    updateTextSegmentStart,
    updateTextSegmentEnd,
    voiceoverSegments,
    removeVoiceoverSegment,
    setTextSegments,
    setAudioSegments,
    setVoiceoverSegments,
  } = useEditorState();
  const { activeTool, setActiveTool } = useEditorContext();

  const { currentTime, duration } = getPlaybackState();
  const scrollViewRef = useRef<any>(null);
  const isUserScrolling = useRef(false);
  const didScrollRef = useRef(false);
  const isTrimmingRef = useRef(false);
  const trimHandlesInitializedRef = useRef(false);
  const wasPlayingBeforeScrub = useRef(false);

  useEffect(() => {
    isTrimmingRef.current = isTrimming;
  }, [isTrimming]);

  // Trimming hook
  const trimming = useTrimming();
  const {
    trimStart,
    trimEnd,
    startX,
    timelineWidth: trimTimelineWidth,
    initializeTrimHandles,
    getTrimTimes,
  } = trimming;

  const styles = createTimelineStyles();

  // Generate thumbnails - source should already be resolved to URI string by VideoEditorSDK
  const validVideoSource =
    videoSource && typeof videoSource === 'string' && videoSource.trim() !== ''
      ? videoSource.trim()
      : '';

  const {
    thumbnails,
    isGenerating,
    generateThumbnails: initThumbnails,
    resetThumbnails,
    regenerateForTrim,
  } = useThumbnails(validVideoSource);

  // Cleanup thumbnails and FastImage cache on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      resetThumbnails();
      // Clear FastImage cache for thumbnails
      try {
        FastImage.clearMemoryCache();
      } catch (e) {
        console.warn('Failed to clear FastImage cache:', e);
      }
    };
  }, [resetThumbnails]);

  // Reset trim handles initialization flag when video source changes
  useEffect(() => {
    if (validVideoSource) {
      trimHandlesInitializedRef.current = false;
    }
  }, [validVideoSource]);

  useEffect(() => {
    if (duration > 0 && validVideoSource) {
      if (thumbnails.length === 0 && !isGenerating) {
        initThumbnails(duration);
      } else if (thumbnails.length > 0) {
      } else if (isGenerating) {
      }

      // Initialize trim handles only once when duration is first available
      if (duration > 0 && !trimHandlesInitializedRef.current) {
        initializeTrimHandles(duration);
        trimHandlesInitializedRef.current = true;
      }
    } else {
      if (!validVideoSource) {
      }
      if (duration <= 0) {
      }
    }
  }, [
    duration,
    validVideoSource,
    thumbnails.length,
    isGenerating,
    initThumbnails,
    initializeTrimHandles,
  ]);

  const timelineWidth = getTimelineWidth(duration);
  const scrollX = useSharedValue(0);
  const isUserScrollingShared = useSharedValue(false);

  // Memoized styles for timeline width
  const timelineWidthStyle = useMemo(
    () => ({ width: timelineWidth }),
    [timelineWidth]
  );

  // Text trim shared values
  const activeTextTrimStart = useSharedValue(0);
  const activeTextTrimEnd = useSharedValue(0);
  const textStartX = useSharedValue(0);
  const textEndX = useSharedValue(0);

  // Gesture context for text trimming
  const gestureContext = useSharedValue<{
    videoDuration: number;
    activeSegment: { type: string; id?: string } | null;
    updateTextSegmentStart: (segmentId: string, start: number) => void;
    updateTextSegmentEnd: (segmentId: string, end: number) => void;
  }>({
    videoDuration: 0,
    activeSegment: null,
    updateTextSegmentStart: (_segmentId: string, _start: number) => {},
    updateTextSegmentEnd: (_segmentId: string, _end: number) => {},
  });

  // Update gesture context
  useEffect(() => {
    gestureContext.value = {
      videoDuration: duration,
      activeSegment,
      updateTextSegmentStart,
      updateTextSegmentEnd,
    };
  }, [
    duration,
    activeSegment,
    updateTextSegmentStart,
    updateTextSegmentEnd,
    gestureContext,
  ]);

  // Sync trim timeline width with actual timeline width
  useEffect(() => {
    if (duration > 0) {
      trimTimelineWidth.value = timelineWidth;
    }
  }, [timelineWidth, duration, trimTimelineWidth]);

  // Update active text segment trim positions when segment changes
  useEffect(() => {
    if (
      activeSegment &&
      activeSegment.type === 'text' &&
      duration > 0 &&
      timelineWidth > 0
    ) {
      const freshSegment = textSegments.find(
        (seg) => seg.id === activeSegment.id
      );

      if (freshSegment) {
        const startPos = (freshSegment.start / duration) * timelineWidth;
        const endPos = (freshSegment.end / duration) * timelineWidth;

        activeTextTrimStart.value = startPos;
        activeTextTrimEnd.value = endPos;
      }
    }
  }, [
    activeSegment,
    textSegments,
    duration,
    timelineWidth,
    activeTextTrimStart,
    activeTextTrimEnd,
  ]);

  // Auto-scroll timeline to follow playhead - always sync with video position
  useEffect(() => {
    if (
      isPlaying &&
      !isUserScrolling.current &&
      scrollViewRef.current &&
      duration > 0 &&
      timelineWidth > 0
    ) {
      const playheadPosition = (currentTime / duration) * timelineWidth;
      const visibleWidth = SCREEN_WIDTH - TIMELINE_MARGIN_HORIZONTAL * 2;
      const centerOffset = visibleWidth / 2;
      // Account for the padding applied to the content (which centers the initial view)
      const contentPadding = centerOffset;
      // Calculate scroll position to center the playhead at the fixed vertical line
      // The playhead position in the content needs to align with the center of visible area
      const scrollPosition = playheadPosition - centerOffset + contentPadding;

      // Clamp scroll position to valid range
      const maxScroll = Math.max(
        0,
        timelineWidth + contentPadding * 2 - visibleWidth
      );
      const clampedScrollPosition = Math.max(
        0,
        Math.min(scrollPosition, maxScroll)
      );

      scrollViewRef.current.scrollTo({
        x: clampedScrollPosition,
        animated: false,
      });
    }
  }, [currentTime, duration, timelineWidth, isPlaying]);

  const handleScrollBeginDrag = useCallback(() => {
    didScrollRef.current = true;
    isUserScrolling.current = true;
    isUserScrollingShared.value = true;
    wasPlayingBeforeScrub.current = isPlaying;
    if (isPlaying) setIsPlaying(false);
  }, [isPlaying, setIsPlaying, isUserScrollingShared]);

  const handleTouchStart = useCallback(() => {
    didScrollRef.current = false;
    isUserScrolling.current = true;
    isUserScrollingShared.value = true;
    if (isPlaying) setIsPlaying(false);
  }, [isPlaying, setIsPlaying, isUserScrollingShared]);

  const handleTouchEnd = useCallback(() => {
    if (!didScrollRef.current) {
      isUserScrolling.current = false;
      isUserScrollingShared.value = false;
    }
  }, [isUserScrollingShared]);

  const handleScrollEndDrag = useCallback(
    (event: any) => {
      const { velocity, contentOffset, contentSize, layoutMeasurement } =
        event.nativeEvent;
      const isAtStart = contentOffset.x <= 0;
      const isAtEnd =
        contentOffset.x >= contentSize.width - layoutMeasurement.width;

      if (Math.abs(velocity?.x || 0) < 0.2 || isAtStart || isAtEnd) {
        isUserScrolling.current = false;
        isUserScrollingShared.value = false;

        // Resume playback if it was playing before scrubbing (no momentum)
        if (wasPlayingBeforeScrub.current) {
          setTimeout(() => {
            setIsPlaying(true);
            wasPlayingBeforeScrub.current = false;
          }, 50);
        }
      }
    },
    [setIsPlaying, isUserScrollingShared]
  );

  const handleMomentumScrollEnd = useCallback(() => {
    isUserScrolling.current = false;
    isUserScrollingShared.value = false;

    // Resume playback if it was playing before scrubbing
    if (wasPlayingBeforeScrub.current) {
      setTimeout(() => {
        setIsPlaying(true);
        wasPlayingBeforeScrub.current = false;
      }, 50);
    }
  }, [setIsPlaying, isUserScrollingShared]);

  // Seek video function - defined early for use in animations
  const seekVideo = useCallback(
    (time: number) => {
      setCurrentTime(time);
      if (videoRef?.current) {
        const { start } = getTrim();
        videoRef.current.seek(start + time);
      }
    },
    [setCurrentTime, videoRef, getTrim]
  );

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event: any) => {
      scrollX.value = event.contentOffset.x;
    },
    onBeginDrag: () => {
      runOnJS(handleScrollBeginDrag)();
    },
  });

  // Sync Video Preview when user scrolls the timeline (scrubbing)
  useAnimatedReaction(
    () => ({
      scroll: scrollX.value,
      isScrolling: isUserScrollingShared.value,
    }),
    (
      current: { scroll: number; isScrolling: boolean },
      previous: { scroll: number; isScrolling: boolean } | null
    ) => {
      'worklet';
      if (
        current.isScrolling &&
        current.scroll !== previous?.scroll &&
        timelineWidth > 0 &&
        duration > 0
      ) {
        // Calculate time based on scroll position
        // The timeline has padding that centers the playhead, so scrollX directly
        // represents the timeline position the playhead is pointing to
        const playheadPosition = current.scroll;
        const clampedPosition = Math.max(
          0,
          Math.min(playheadPosition, timelineWidth)
        );
        const time = (clampedPosition / timelineWidth) * duration;
        const clampedTime = Math.max(0, Math.min(time, duration));
        runOnJS(seekVideo)(clampedTime);
      }
    },
    [timelineWidth, duration, seekVideo]
  );

  const handleTogglePlayback = () => {
    setIsPlaying(!isPlaying);
  };

  const handleCloseTimeline = () => {
    onCloseTimeline?.();
  };

  const handleTrimTrackPress = () => {
    if (activeTool === 'trim') {
      setActiveTool(null);
      setIsTrimming(false);
    } else {
      setActiveTool('trim');
      setIsTrimming(true);
    }
  };

  // Handle tap on timeline track to seek
  const handleTimelineTrackTap = (x: number) => {
    // Only seek if not in trim mode and not actively trimming
    if (!isTrimming && !activeTool && duration > 0) {
      const centerOffset = (SCREEN_WIDTH - TIMELINE_MARGIN_HORIZONTAL * 2) / 2;

      // Calculate absolute position on timeline using scroll position
      const scrollXValue = scrollX.value || 0;
      const absolutePosition = x + scrollXValue - centerOffset;
      const clampedPosition = Math.max(
        0,
        Math.min(absolutePosition, timelineWidth)
      );
      const time = pixelsToTime(clampedPosition, timelineWidth, duration);

      seekVideo(time);
      scrollToTime(time, true);
    }
  };

  // Tap gesture for seeking on timeline track
  const timelineTapGesture = Gesture.Tap().onEnd((event: any) => {
    runOnJS(handleTimelineTrackTap)(event.x);
  });

  const handleConfirmTrim = () => {
    if (duration > 0) {
      const {
        startTime: relativeStart,
        endTime: relativeEnd,
        duration: newDuration,
      } = getTrimTimes(duration);
      const { start: currentOffset } = getTrim();

      const absoluteStart = currentOffset + relativeStart;
      const absoluteEnd = currentOffset + relativeEnd;

      // 1. Update trim state in context
      setTrim(absoluteStart, absoluteEnd);

      // 2. Update duration in state - ONLY on confirmation to avoid jitter
      setDuration(newDuration);

      // 3. Shift and filter segments relative to the new zero-point
      const shift = relativeStart;
      if (shift !== 0) {
        const updatedTextSegments = textSegments
          .map((seg) => ({
            ...seg,
            start: Math.max(0, seg.start - shift),
            end: Math.min(newDuration, seg.end - shift),
          }))
          .filter((seg) => seg.end > seg.start);
        setTextSegments(updatedTextSegments);

        const updatedAudioSegments = audioSegments
          .map((seg) => ({
            ...seg,
            start: Math.max(0, seg.start - shift),
            end: Math.min(newDuration, seg.end - shift),
          }))
          .filter((seg) => seg.end > seg.start);
        setAudioSegments(updatedAudioSegments);

        const updatedVoiceoverSegments = voiceoverSegments
          .map((seg) => ({
            ...seg,
            start: Math.max(0, seg.start - shift),
            end: Math.min(newDuration, seg.end - shift),
          }))
          .filter((seg) => seg.end > seg.start);
        setVoiceoverSegments(updatedVoiceoverSegments);
      }

      // 3. Regenerate thumbnails for the trimmed region
      regenerateForTrim(absoluteStart, newDuration);

      // 4. Reset playback to start of trimmed region
      setCurrentTime(0);
      videoRef?.current?.seek(absoluteStart);

      // 5. Reset the trim handles for the new shorter timeline
      initializeTrimHandles(newDuration);

      // 6. Cleanup UI state
      setIsTrimming(false);
      setActiveTool(null);
    }
  };

  const handleCancelTrim = () => {
    if (duration > 0) {
      // Reset handles to full width of current duration
      initializeTrimHandles(duration);
      setIsTrimming(false);
      setActiveTool(null);
    }
  };

  const handleSegmentPress = (segmentInfo: { type: string; id?: string }) => {
    const isAlreadyActive =
      activeSegment?.type === segmentInfo.type &&
      activeSegment?.id === segmentInfo.id;

    if (isAlreadyActive) {
      setActiveSegment(null);
    } else {
      setActiveSegment(segmentInfo);
    }
  };

  const handleDeleteSegment = (segmentType: string, segmentId: string) => {
    if (segmentType === 'audio') {
      // Clear active segment first to prevent desync
      setActiveSegment(null);
      removeAudioSegment(segmentId);
    } else if (segmentType === 'text') {
      // Clear active segment first to prevent desync
      setActiveSegment(null);
      // Remove the text segment
      removeTextSegment(segmentId);
    } else if (segmentType === 'voiceover') {
      setActiveSegment(null);
      removeVoiceoverSegment(segmentId);
    }
  };

  const handleSelectMusic = async () => {
    try {
      // Pick the audio file first
      const [pickResult] = await pick({
        type: [types.audio],
        allowMultiSelection: false,
      });

      if (pickResult) {
        try {
          // Create a local copy for better file handling
          const [localCopy] = await keepLocalCopy({
            files: [
              {
                uri: pickResult.uri,
                fileName: pickResult.name ?? 'audio',
              },
            ],
            destination: 'cachesDirectory',
          });

          // Use localUri if available, otherwise fall back to uri
          const audioUriToUse =
            localCopy?.localUri || localCopy?.uri || pickResult.uri;

          if (audioUriToUse) {
            setAudioUri(audioUriToUse);
            // Set active tool after successfully picking audio
            setActiveTool('bgm');
          }
        } catch (copyErr: any) {
          console.warn('Failed to create local copy:', copyErr);
          // Fallback to original URI if local copy fails
          if (pickResult.uri) {
            setAudioUri(pickResult.uri);
            setActiveTool('bgm');
          }
        }
      }
    } catch (err: any) {
      console.error('Error picking audio:', err);
      // Don't set active tool if user cancelled or error occurred
      if (err?.code !== 'DOCUMENT_PICKER_CANCELED') {
        console.error('Audio picker error details:', err);
      }
    }
  };

  const handleAddText = () => {
    // Open text editor for new text
    setEditingTextElement(null);
    setIsTextEditorVisible(true);
    if (isPlaying) setIsPlaying(false);
    setActiveTool('text');
  };

  const handleAddVoiceover = () => {
    setActiveTool('voiceover');
    if (isPlaying) setIsPlaying(false);
  };

  const scrollToTime = (time: number, animated: boolean = false) => {
    if (scrollViewRef.current && duration > 0 && timelineWidth > 0) {
      const playheadPosition = (time / duration) * timelineWidth;
      const visibleWidth = SCREEN_WIDTH - TIMELINE_MARGIN_HORIZONTAL * 2;
      const centerOffset = visibleWidth / 2;
      const contentPadding = centerOffset;

      // Calculate scroll position
      // The timeline has padding that centers the playhead, so we adjust accordingly
      let scrollPosition = playheadPosition - centerOffset + contentPadding;

      // Clamp scroll position to valid range
      const maxScroll = Math.max(
        0,
        timelineWidth + contentPadding * 2 - visibleWidth
      );
      scrollPosition = Math.max(0, Math.min(scrollPosition, maxScroll));

      scrollViewRef.current.scrollTo({
        x: scrollPosition,
        animated,
      });
    }
  };

  // Gesture handlers for trim handles
  const leftHandleGesture = Gesture.Pan()
    .activeOffsetX([-5, 5])
    .failOffsetY([-15, 15])
    .hitSlop({ horizontal: 30, vertical: 30 })
    .onStart(() => {
      startX.value = trimStart.value;
      runOnJS(setIsPlaying)(false);
      runOnJS(setIsDraggingHandle)(true);
    })
    .onUpdate((e: any) => {
      'worklet';
      const newStart = startX.value + e.translationX;
      trimStart.value = Math.max(
        0,
        Math.min(newStart, trimEnd.value - MIN_DURATION_PIXELS)
      );
      const newTime = pixelsToTime(
        trimStart.value,
        trimTimelineWidth.value,
        duration
      );
      runOnJS(seekVideo)(newTime);

      if (!isTrimmingRef.current) {
        runOnJS(setIsTrimming)(true);
      }
    })
    .onEnd(() => {
      'worklet';
      runOnJS(setIsDraggingHandle)(false);
      const finalTime = pixelsToTime(
        trimStart.value,
        trimTimelineWidth.value,
        duration
      );
      runOnJS(scrollToTime)(finalTime, true);
    });

  const rightHandleGesture = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .failOffsetY([-10, 10])
    .hitSlop({ horizontal: 20, vertical: 20 })
    .onStart(() => {
      startX.value = trimEnd.value;
      runOnJS(setIsPlaying)(false);
      runOnJS(setIsDraggingHandle)(true);
    })
    // @ts-ignore - Gesture event type
    .onUpdate((e: any) => {
      'worklet';
      const newEnd = startX.value + e.translationX;
      trimEnd.value = Math.min(
        trimTimelineWidth.value,
        Math.max(newEnd, trimStart.value + MIN_DURATION_PIXELS)
      );
      const newTime = pixelsToTime(
        trimEnd.value,
        trimTimelineWidth.value,
        duration
      );
      runOnJS(seekVideo)(newTime);

      if (!isTrimmingRef.current) {
        runOnJS(setIsTrimming)(true);
      }
    })
    .onEnd(() => {
      'worklet';
      runOnJS(setIsDraggingHandle)(false);
      const finalTime = pixelsToTime(
        trimEnd.value,
        trimTimelineWidth.value,
        duration
      );
      runOnJS(scrollToTime)(finalTime, true);
    });

  // Animated styles for trim handles
  const animatedTrimBorderStyle = useAnimatedStyle(() => ({
    left: trimStart.value,
    width: trimEnd.value - trimStart.value,
  }));

  const TRIM_HANDLE_WIDTH = moderateScale(30);

  const animatedLeftHandleStyle = useAnimatedStyle(() => {
    const handleLeft = trimStart.value - TRIM_HANDLE_WIDTH / 2;
    // Allow handle to extend beyond 0 for proper centering, parent containers now allow overflow
    return {
      left: handleLeft,
    };
  });

  const animatedRightHandleStyle = useAnimatedStyle(() => ({
    left: trimEnd.value - TRIM_HANDLE_WIDTH / 2,
  }));

  const animatedTrackClipStyle = useAnimatedStyle(() => ({
    width: trimEnd.value - trimStart.value,
    transform: [{ translateX: trimStart.value }],
  }));

  const animatedContentMoverStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -trimStart.value }],
  }));

  // Text segment hooks - moved to component level
  const isTextActive = activeSegment?.type === 'text';
  const activeTextSegment = isTextActive
    ? textSegments.find((seg) => seg.id === activeSegment.id)
    : null;

  // Animated styles for text trimming - moved to component level
  const animatedTextTrimStyle = useAnimatedStyle(() => {
    if (!isTextActive) return { opacity: 0, position: 'absolute' as const };
    const width = activeTextTrimEnd.value - activeTextTrimStart.value;
    return {
      position: 'absolute' as const,
      left: activeTextTrimStart.value,
      width: Math.max(MIN_DURATION_PIXELS, width),
      height: '100%',
      borderWidth: 2,
      borderColor: '#FFCC00',
      borderRadius: 4,
      opacity: 1,
    };
  });

  const animatedTextLeftHandleStyle = useAnimatedStyle(() => {
    if (!isTextActive) return { left: -1000 };
    return {
      position: 'absolute' as const,
      left: activeTextTrimStart.value - HANDLE_WIDTH / 2,
      top: 0,
      width: HANDLE_WIDTH,
      height: '100%',
    };
  });

  const animatedTextRightHandleStyle = useAnimatedStyle(() => {
    if (!isTextActive) return { left: -1000 };
    return {
      position: 'absolute' as const,
      left: activeTextTrimEnd.value - HANDLE_WIDTH / 2,
      top: 0,
      width: HANDLE_WIDTH,
      height: '100%',
    };
  });

  // Memoized styles for text segments - moved to component level
  const textSegmentNonActiveStyle = useMemo(
    () => [styles.textSegmentNonActive, { opacity: isTextActive ? 0.3 : 0.8 }],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isTextActive]
  );

  const textSegmentActiveContainerStyle = useMemo(
    () => [styles.textSegmentActiveContainer, { width: timelineWidth }],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [timelineWidth]
  );

  // Timeline width height style for trim track
  const timelineWidthHeightStyle = useMemo(
    () => ({ width: timelineWidth, height: '100%' }),
    [timelineWidth]
  );

  const getThumbnailImageStyle = (thumbWidth: number) => ({
    width: thumbWidth,
  });

  const renderAudioSegments = () => {
    const hasAudioSegments = audioSegments.length > 0;

    // Ensure timelineWidth is valid for segment positioning
    if (duration <= 0 || timelineWidth <= 0) {
      return (
        <View style={styles.addButtonContainer}>
          <PressableWrapper
            style={styles.addButton}
            onPress={() => {
              onSegmentPress?.();
              handleSelectMusic();
            }}
          >
            <Text style={styles.addButtonIcon}>+</Text>
            <Text style={styles.addButtonText}>Add audio</Text>
          </PressableWrapper>
        </View>
      );
    }

    return !hasAudioSegments ? (
      <View style={styles.addButtonContainer}>
        <PressableWrapper
          style={styles.addButton}
          onPress={() => {
            onSegmentPress?.();
            handleSelectMusic();
          }}
        >
          <Text style={styles.addButtonIcon}>+</Text>
          <Text style={styles.addButtonText}>Add audio</Text>
        </PressableWrapper>
      </View>
    ) : (
      <View style={[styles.audioSegmentContainer, timelineWidthStyle]}>
        {audioSegments.map((segment) => {
          const isSegmentActive =
            activeSegment?.type === 'audio' && activeSegment?.id === segment.id;

          if (segment.isLooped && segment.clipDuration > 0) {
            // For looped segments, calculate positions using same formula for consistency
            const timelineTotalWidth = timelineWidth;
            const clipWidth =
              (segment.clipDuration / duration) * timelineTotalWidth;
            const repeatCount = Math.floor(duration / segment.clipDuration);
            const remainderDuration = duration % segment.clipDuration;
            const remainderWidth =
              (remainderDuration / duration) * timelineTotalWidth;

            return (
              <PressableWrapper
                key={segment.id}
                onPress={() =>
                  handleSegmentPress({ type: 'audio', id: segment.id })
                }
                style={[
                  styles.audioSegmentContainer,
                  { width: timelineTotalWidth },
                ]}
              >
                {Array.from({ length: repeatCount }).map((_, i) => (
                  <View
                    key={`loop-${i}`}
                    style={[
                      styles.audioSegment,
                      styles.audioLoopSegment,
                      {
                        left: i * clipWidth,
                        width: clipWidth,
                        backgroundColor: segment.color + '40',
                        borderColor: segment.color,
                      },
                    ]}
                  >
                    {i === 0 ? (
                      <Text
                        style={[styles.segmentLabel, { color: segment.color }]}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {segment.name}
                      </Text>
                    ) : (
                      <View style={styles.loopIndicatorContainer}>
                        <Text
                          style={[
                            styles.loopFileNameText,
                            { color: segment.color },
                          ]}
                          numberOfLines={1}
                          ellipsizeMode="tail"
                        >
                          {segment.name}
                        </Text>
                        <Text
                          style={[styles.loopIcon, { color: segment.color }]}
                        >
                          🔄
                        </Text>
                        <Text
                          style={[
                            styles.loopIndicatorText,
                            { color: segment.color },
                          ]}
                        >
                          {i}
                        </Text>
                      </View>
                    )}
                  </View>
                ))}
                {remainderWidth > 0 && (
                  <View
                    style={[
                      styles.audioSegment,
                      styles.audioLoopSegment,
                      {
                        left: repeatCount * clipWidth,
                        width: remainderWidth,
                        backgroundColor: segment.color + '40',
                        borderColor: segment.color,
                      },
                    ]}
                  >
                    <View style={styles.loopIndicatorContainer}>
                      {remainderWidth >= MIN_WIDTH_FOR_LOOP_NAME ? (
                        // Show everything if there's enough space
                        <>
                          <Text
                            style={[
                              styles.loopFileNameText,
                              { color: segment.color },
                            ]}
                            numberOfLines={1}
                            ellipsizeMode="tail"
                          >
                            {segment.name}
                          </Text>
                          <Text
                            style={[styles.loopIcon, { color: segment.color }]}
                          >
                            🔄
                          </Text>
                          <Text
                            style={[
                              styles.loopIndicatorText,
                              { color: segment.color },
                            ]}
                          >
                            {repeatCount}
                          </Text>
                        </>
                      ) : remainderWidth >= MIN_WIDTH_FOR_LOOP_NUMBER ? (
                        // Show only icon and number if space is limited
                        <>
                          <Text
                            style={[styles.loopIcon, { color: segment.color }]}
                          >
                            🔄
                          </Text>
                          <Text
                            style={[
                              styles.loopIndicatorText,
                              { color: segment.color },
                            ]}
                          >
                            {repeatCount}
                          </Text>
                        </>
                      ) : (
                        // Show only the icon if space is very tight
                        <Text
                          style={[styles.loopIcon, { color: segment.color }]}
                        >
                          🔄
                        </Text>
                      )}
                    </View>
                  </View>
                )}
                {/* Render the separators */}
                {Array.from({ length: repeatCount - 1 }).map((_, i) => (
                  <View
                    key={`sep-${i}`}
                    style={[
                      styles.audioLoopSeparator,
                      { left: (i + 1) * clipWidth - 1 },
                    ]}
                  />
                ))}

                {isSegmentActive && (
                  <PressableWrapper
                    style={styles.deleteButton}
                    onPress={() => handleDeleteSegment('audio', segment.id)}
                  >
                    <Image
                      style={styles.deleteIcon}
                      source={TrashIcon}
                      tintColor={'#fff'}
                    />
                  </PressableWrapper>
                )}
              </PressableWrapper>
            );
          } else {
            const segmentStyle = getSegmentPosition(
              segment.start,
              segment.end - segment.start,
              duration,
              timelineWidth
            );
            return (
              <PressableWrapper
                key={segment.id}
                onPress={() =>
                  handleSegmentPress({ type: 'audio', id: segment.id })
                }
                style={[
                  styles.audioSegment,
                  segmentStyle,
                  {
                    backgroundColor: segment.color + '40',
                    borderColor: segment.color,
                  },
                ]}
              >
                <Text
                  style={[styles.segmentLabel, { color: segment.color }]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {segment.name || segment.type}
                </Text>
                {isSegmentActive && (
                  <PressableWrapper
                    style={styles.deleteButton}
                    onPress={() => handleDeleteSegment('audio', segment.id)}
                  >
                    <Image
                      style={styles.deleteIcon}
                      source={TrashIcon}
                      tintColor={'#fff'}
                    />
                  </PressableWrapper>
                )}
              </PressableWrapper>
            );
          }
        })}
      </View>
    );
  };

  const renderTextSegments = () => {
    const hasTextSegments = textSegments.length > 0;

    const textLeftHandleGestureHandler = Gesture.Pan()
      .enabled(isTextActive && !!activeTextSegment)
      .onStart(() => {
        'worklet';
        textStartX.value = activeTextTrimStart.value;
        runOnJS(setIsDraggingHandle)(true);
        if (isPlaying) runOnJS(setIsPlaying)(false);
      })
      .onUpdate((event: any) => {
        'worklet';
        const newStart = Math.max(
          0,
          Math.min(
            activeTextTrimEnd.value - MIN_DURATION_PIXELS,
            textStartX.value + event.translationX
          )
        );
        activeTextTrimStart.value = newStart;

        const timelineW = gestureContext.value.videoDuration
          ? trimTimelineWidth.value
          : 1;
        const newTime =
          (newStart / timelineW) * gestureContext.value.videoDuration;

        if (gestureContext.value.activeSegment?.id) {
          runOnJS(gestureContext.value.updateTextSegmentStart)(
            gestureContext.value.activeSegment.id,
            newTime
          );
        }
      })
      .onEnd(() => {
        'worklet';
        runOnJS(setIsDraggingHandle)(false);
      });

    const textRightHandleGestureHandler = Gesture.Pan()
      .enabled(isTextActive && !!activeTextSegment)
      .onStart(() => {
        'worklet';
        textEndX.value = activeTextTrimEnd.value;
        runOnJS(setIsDraggingHandle)(true);
        if (isPlaying) runOnJS(setIsPlaying)(false);
      })
      .onUpdate((event: any) => {
        'worklet';
        const newEnd = Math.min(
          trimTimelineWidth.value,
          Math.max(
            activeTextTrimStart.value + MIN_DURATION_PIXELS,
            textEndX.value + event.translationX
          )
        );
        activeTextTrimEnd.value = newEnd;

        const timelineW = gestureContext.value.videoDuration
          ? trimTimelineWidth.value
          : 1;
        const newTime =
          (newEnd / timelineW) * gestureContext.value.videoDuration;

        if (gestureContext.value.activeSegment?.id) {
          runOnJS(gestureContext.value.updateTextSegmentEnd)(
            gestureContext.value.activeSegment.id,
            newTime
          );
        }
      })
      .onEnd(() => {
        'worklet';
        runOnJS(setIsDraggingHandle)(false);
      });

    // Show "Add text" button if no segments exist
    if (!hasTextSegments) {
      return (
        <View style={styles.addButtonContainer}>
          <PressableWrapper
            style={styles.addButton}
            onPress={() => {
              handleAddText();
              onSegmentPress?.();
            }}
          >
            <Text style={styles.addButtonIcon}>+</Text>
            <Text style={styles.addButtonText}>Add text</Text>
          </PressableWrapper>
        </View>
      );
    }

    // Render text segments
    return (
      <View style={[styles.textSegmentsContainer, timelineWidthStyle]}>
        {textSegments.map((segment) => {
          const isActive = isTextActive && segment.id === activeSegment.id;
          const segStyle = getSegmentPosition(
            segment.start,
            segment.end - segment.start,
            duration,
            timelineWidth
          );

          // Non-active segments
          if (!isActive) {
            return (
              <PressableWrapper
                key={segment.id}
                onPress={() =>
                  handleSegmentPress({ type: 'text', id: segment.id })
                }
                style={[
                  styles.textSegment,
                  segStyle,
                  textSegmentNonActiveStyle,
                ]}
              >
                <Text
                  style={[styles.segmentLabel, styles.textSegmentLabel]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  💬 {segment.text.substring(0, 20)}
                  {segment.text.length > 20 ? '...' : ''}
                </Text>
              </PressableWrapper>
            );
          }

          // Active segment with trim handles
          return (
            <View
              key={segment.id}
              style={[styles.textSegment, textSegmentActiveContainerStyle]}
            >
              {/* Main segment container */}
              <Animated.View style={animatedTextTrimStyle}>
                <PressableWrapper
                  style={styles.textSegmentPressable}
                  onPress={() =>
                    handleSegmentPress({ type: 'text', id: segment.id })
                  }
                >
                  <Text
                    style={[styles.segmentLabel, styles.textSegmentLabel]}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {segment.text.substring(0, 20)}
                    {segment.text.length > 20 ? '...' : ''}
                  </Text>
                </PressableWrapper>

                {/* Delete button */}
                <PressableWrapper
                  style={styles.deleteButton}
                  onPress={() => handleDeleteSegment('text', segment.id)}
                >
                  <Image
                    style={styles.deleteIcon}
                    source={TrashIcon}
                    tintColor={'#fff'}
                  />
                </PressableWrapper>
              </Animated.View>

              {/* Left Handle */}
              <GestureDetector gesture={textLeftHandleGestureHandler}>
                <Animated.View
                  style={[
                    styles.trimHandleInteractive,
                    animatedTextLeftHandleStyle,
                  ]}
                  hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                >
                  <View
                    style={[
                      styles.textTrimHandleVisual,
                      styles.textTrimHandleYellow,
                    ]}
                  >
                    {/* <View style={styles.trimHandleGrip} /> */}
                    <View style={styles.trimHandleGrip} />
                  </View>
                </Animated.View>
              </GestureDetector>

              {/* Right Handle */}
              <GestureDetector gesture={textRightHandleGestureHandler}>
                <Animated.View
                  style={[
                    styles.trimHandleInteractive,
                    animatedTextRightHandleStyle,
                  ]}
                  hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                >
                  <View
                    style={[
                      styles.textTrimHandleVisual,
                      styles.textTrimHandleYellow,
                    ]}
                  >
                    <View style={styles.trimHandleGrip} />
                  </View>
                </Animated.View>
              </GestureDetector>
            </View>
          );
        })}
      </View>
    );
  };

  const renderVoiceoverSegments = () => {
    const hasVoiceoverSegments = voiceoverSegments.length > 0;

    if (duration <= 0 || timelineWidth <= 0) {
      return (
        <View style={styles.addButtonContainer}>
          <PressableWrapper
            style={styles.addButton}
            onPress={() => {
              handleAddVoiceover();
              onSegmentPress?.();
            }}
          >
            <Text style={styles.addButtonIcon}>+</Text>
            <Text style={styles.addButtonText}>Add voiceover</Text>
          </PressableWrapper>
        </View>
      );
    }

    if (!hasVoiceoverSegments) {
      return (
        <View style={styles.addButtonContainer}>
          <PressableWrapper
            style={styles.addButton}
            onPress={() => {
              handleAddVoiceover();
              onSegmentPress?.();
            }}
          >
            <Text style={styles.addButtonIcon}>+</Text>
            <Text style={styles.addButtonText}>Add voiceover</Text>
          </PressableWrapper>
        </View>
      );
    }

    return (
      <View style={[styles.voiceoverSegmentsContainer, timelineWidthStyle]}>
        {voiceoverSegments.map((segment) => {
          const isSegmentActive =
            activeSegment?.type === 'voiceover' &&
            activeSegment?.id === segment.id;

          const segmentStyle = getSegmentPosition(
            segment.start,
            segment.end - segment.start,
            duration,
            timelineWidth
          );

          return (
            <PressableWrapper
              key={segment.id}
              onPress={() =>
                handleSegmentPress({ type: 'voiceover', id: segment.id })
              }
              style={[
                styles.voiceoverSegment,
                segmentStyle,
                styles.voiceoverSegmentStyle,
              ]}
            >
              <Text
                style={[styles.segmentLabel, styles.voiceoverSegmentLabel]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                🎤 Voiceover
              </Text>

              {isSegmentActive && (
                <PressableWrapper
                  style={styles.deleteButton}
                  onPress={() => handleDeleteSegment('voiceover', segment.id)}
                >
                  <Image
                    style={styles.deleteIcon}
                    source={TrashIcon}
                    tintColor={'#fff'}
                  />
                </PressableWrapper>
              )}
            </PressableWrapper>
          );
        })}
      </View>
    );
  };

  const renderTrimTrack = () => {
    const isTrimActive = isTrimming || activeTool === 'trim';

    return (
      <View style={styles.trimTrackContainer}>
        {/* Mute/Unmute Button - Left side absolute position */}
        <Pressable
          style={styles.muteButton}
          onPress={() => setIsMuted(!isMuted)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <View style={styles.muteButtonContainer}>
            <Image
              style={styles.muteIcon}
              source={isMuted ? MuteIcon : UnMuteIcon}
            />
          </View>
        </Pressable>

        <GestureDetector gesture={timelineTapGesture}>
          <Pressable
            onPress={handleTrimTrackPress}
            style={styles.trimTrackContent}
          >
            <View style={timelineWidthHeightStyle}>
              <View style={styles.timelineTrack}>
                {isTrimActive ? (
                  <Animated.View
                    style={[styles.clippingView, animatedTrackClipStyle]}
                  >
                    <Animated.View style={animatedContentMoverStyle}>
                      <View style={[styles.thumbnailStrip, timelineWidthStyle]}>
                        {thumbnails.length > 0 ? (
                          thumbnails.map((thumb, i) => (
                            <FastImage
                              key={`thumb-${i}-${thumb.uri}`}
                              source={{ uri: thumb.uri, priority: 'normal' }}
                              resizeMode={FastImage.resizeMode.cover}
                              style={[
                                styles.thumbnailImage,
                                styles.thumbnailImageBg,
                                getThumbnailImageStyle(thumb.width),
                              ]}
                            />
                          ))
                        ) : (
                          <View
                            style={[styles.placeholder, timelineWidthStyle]}
                          />
                        )}
                      </View>
                    </Animated.View>
                  </Animated.View>
                ) : (
                  <View style={[styles.thumbnailStrip, timelineWidthStyle]}>
                    {thumbnails.length > 0 ? (
                      thumbnails.map((thumb, i) => (
                        <FastImage
                          key={`thumb-${i}-${thumb.uri}`}
                          source={{ uri: thumb.uri, priority: 'normal' }}
                          resizeMode={FastImage.resizeMode.cover}
                          style={[
                            styles.thumbnailImage,
                            styles.thumbnailImageBg,
                            getThumbnailImageStyle(thumb.width),
                          ]}
                        />
                      ))
                    ) : (
                      <View
                        style={[styles.placeholder, { width: timelineWidth }]}
                      />
                    )}
                  </View>
                )}

                {isTrimActive && (
                  <>
                    {/* The yellow top/bottom border bars */}
                    <Animated.View
                      style={[
                        styles.trimHandlesContainer,
                        animatedTrimBorderStyle,
                      ]}
                    />

                    {/* Left Handle */}
                    <GestureDetector gesture={leftHandleGesture}>
                      <Animated.View
                        style={[
                          styles.trimHandleInteractive,
                          animatedLeftHandleStyle,
                        ]}
                        hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                      >
                        <View style={styles.trimHandleVisual}>
                          <View style={styles.trimHandleGrip} />
                          <View style={styles.trimHandleGrip} />
                        </View>
                      </Animated.View>
                    </GestureDetector>

                    {/* Right Handle */}
                    <GestureDetector gesture={rightHandleGesture}>
                      <Animated.View
                        style={[
                          styles.trimHandleInteractive,
                          animatedRightHandleStyle,
                        ]}
                        hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                      >
                        <View style={styles.trimHandleVisual}>
                          <View style={styles.trimHandleGrip} />
                          <View style={styles.trimHandleGrip} />
                        </View>
                      </Animated.View>
                    </GestureDetector>
                  </>
                )}
              </View>
            </View>
          </Pressable>
        </GestureDetector>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <TimelineHeader
        currentTime={currentTime}
        videoDuration={duration}
        isPlaying={isPlaying}
        isTrimming={isTrimming}
        onTogglePlayback={handleTogglePlayback}
        onConfirmTrim={handleConfirmTrim}
        onCancelTrim={handleCancelTrim}
        onCloseTimeline={handleCloseTimeline}
      />

      <View style={styles.timelineContainer}>
        <View style={styles.fixedPlayhead}>
          <View style={styles.fixedPlayheadLine} />
          <View style={styles.fixedPlayheadHandle} />
        </View>
        <RNScrollView
          ref={scrollViewRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tracksScrollView}
          onScroll={scrollHandler}
          onScrollBeginDrag={() => {
            didScrollRef.current = true;
            isUserScrolling.current = true;
            isUserScrollingShared.value = true;
            wasPlayingBeforeScrub.current = isPlaying;
            if (isPlaying) setIsPlaying(false);
          }}
          onTouchStart={() => {
            didScrollRef.current = false;
            isUserScrolling.current = true;
            isUserScrollingShared.value = true;
            wasPlayingBeforeScrub.current = isPlaying;
            if (isPlaying) setIsPlaying(false);
          }}
          onTouchEnd={() => {
            if (!didScrollRef.current) {
              // Just a tap, not a scroll
              isUserScrolling.current = false;
              isUserScrollingShared.value = false;
            }
          }}
          onScrollEndDrag={(event: any) => {
            const { velocity, contentOffset, contentSize, layoutMeasurement } =
              event.nativeEvent;
            const isAtStart = contentOffset.x <= 0;
            const isAtEnd =
              contentOffset.x >= contentSize.width - layoutMeasurement.width;

            if (Math.abs(velocity?.x || 0) < 0.2 || isAtStart || isAtEnd) {
              isUserScrolling.current = false;
              isUserScrollingShared.value = false;

              // Resume playback if it was playing before scrubbing (no momentum)
              if (wasPlayingBeforeScrub.current) {
                setTimeout(() => {
                  setIsPlaying(true);
                  wasPlayingBeforeScrub.current = false;
                }, 50);
              }
            }
          }}
          onMomentumScrollEnd={() => {
            isUserScrolling.current = false;
            isUserScrollingShared.value = false;

            // Resume playback if it was playing before scrubbing
            if (wasPlayingBeforeScrub.current) {
              setTimeout(() => {
                setIsPlaying(true);
                wasPlayingBeforeScrub.current = false;
              }, 50);
            }
          }}
          scrollEventThrottle={16}
          bounces={false}
        >
          <View
            style={useMemo(
              () => ({
                paddingHorizontal:
                  (SCREEN_WIDTH - TIMELINE_MARGIN_HORIZONTAL * 2) / 2,
              }),
              []
            )}
          >
            <ScrollWrapper
              style={styles.scrollWrapperVisible}
              showsVerticalScrollIndicator={false}
              onScrollBeginDrag={handleScrollBeginDrag}
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
              onScrollEndDrag={handleScrollEndDrag}
              onMomentumScrollEnd={handleMomentumScrollEnd}
            >
              {renderTrimTrack()}
              {renderAudioSegments()}
              {renderTextSegments()}
              {renderVoiceoverSegments()}
            </ScrollWrapper>
          </View>
        </RNScrollView>
      </View>
    </View>
  );
};
