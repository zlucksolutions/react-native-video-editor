import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import {
  View,
  Text,
  Dimensions,
  Pressable,
  Platform,
  Image,
  // @ts-ignore - Peer dependency
} from 'react-native';
// @ts-ignore - Peer dependency
import Video from 'react-native-video';
// @ts-ignore - Peer dependency
import LinearGradient from 'react-native-linear-gradient';
// @ts-ignore - Peer dependency
import Animated, {
  useAnimatedScrollHandler,
  runOnJS,
  // @ts-ignore - Peer dependency
} from 'react-native-reanimated';
// @ts-ignore - Peer dependency
import {
  Pressable as GHPressable,
  ScrollView as GHScrollView,
  // @ts-ignore - Peer dependency
} from 'react-native-gesture-handler';
import { useEditorState } from '../../context/EditorStateContext';
import { createAudioTrimmerStyles } from './AudioTrimmerBottomSheetStyles';
import { deviceUtils } from '../../utils/deviceUtils';
// @ts-ignore - Peer dependency
import { LoopCycleIcon } from '../../assets/icons/index.js';

const SCREEN_WIDTH = Dimensions.get('window').width;
const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));
const SELECT_WIDTH = 200;
const FLING_VELOCITY_THRESHOLD = 0.1;

type AudioInfo = {
  uri: string;
  name: string;
};

type Props = {
  audioInfo?: AudioInfo | null;
  maxDuration?: number;
  onConfirm?: (data: any) => void;
  onClose?: () => void;
  style?: any;
  onSelectionChangeEnd?: () => void;
  onAudioReady?: () => void;
};

export const AudioTrimmerBottomSheet: React.FC<Props> = ({
  audioInfo: propAudioInfo,
  maxDuration: propMaxDuration,
  onConfirm,
  onClose,
  style,
  onSelectionChangeEnd,
  onAudioReady,
}) => {
  const {
    audioUri,
    getPlaybackState,
    isPlaying: isVideoPlaying,
    setIsPlaying,
    setAudioUri,
    setCurrentTime,
    videoRef,
  } = useEditorState();
  const { currentTime: videoCurrentTime, duration: mainVideoDuration } =
    getPlaybackState();

  const maxDuration = propMaxDuration ?? mainVideoDuration;

  const normalizeAudioUri = useCallback((uri: string): string => {
    if (!uri) return '';

    // Remove file:// prefix if present (iOS issue with react-native-video)
    if (uri.startsWith('file://')) {
      return uri.replace('file://', '');
    }

    return uri;
  }, []);

  const info = useMemo(() => {
    if (propAudioInfo) {
      return {
        ...propAudioInfo,
        uri: normalizeAudioUri(propAudioInfo.uri),
      };
    }
    if (audioUri) {
      return {
        uri: normalizeAudioUri(audioUri),
        name: 'Selected Audio',
      };
    }
    return null;
  }, [propAudioInfo, audioUri, normalizeAudioUri]);

  const styles = useMemo(() => createAudioTrimmerStyles(), []);

  const PIXELS_PER_SECOND = 18;
  const BAR_WIDTH = 3;
  const BAR_GAP = 3;
  const SCROLL_PADDING = (SCREEN_WIDTH - SELECT_WIDTH) / 2;

  const [audioDuration, setAudioDuration] = useState(0);
  const [selectDuration, setSelectDuration] = useState(maxDuration);
  const [offsetSec, setOffsetSec] = useState(0);
  const [isLooped, setIsLooped] = useState(false);
  const [isAudioPaused, setIsAudioPaused] = useState(true);

  const audioPlayerRef = useRef<any>(null);
  const isUserScrolling = useRef(false);
  const lastVideoTimeRef = useRef(0);
  const lastSyncTimeRef = useRef(0);
  const seekTimeout = useRef<any>(null);

  const isAudioPausedRef = useRef(isAudioPaused);
  useEffect(() => {
    isAudioPausedRef.current = isAudioPaused;
  }, [isAudioPaused]);

  const showLoopOption = audioDuration > 0 && audioDuration < maxDuration;
  const isShortAudio = audioDuration < maxDuration;
  const RNPressable = deviceUtils.isIOS ? Pressable : GHPressable;

  // Use platform-specific ScrollView for proper gesture handling on Android
  const AnimatedGHScrollView = React.useMemo(
    () => Animated.createAnimatedComponent(GHScrollView),
    []
  );
  const RNScrollView =
    Platform.OS === 'ios' ? Animated.ScrollView : AnimatedGHScrollView;

  useEffect(() => {
    if (info) {
      setAudioDuration(0);
      setSelectDuration(maxDuration);
      setOffsetSec(0);
      setIsLooped(false);
      setIsAudioPaused(true);
      lastVideoTimeRef.current = 0;
      lastSyncTimeRef.current = 0;

      // When audio trimmer opens with audio, seek video to start and play
      setCurrentTime(0);
      if (videoRef?.current) {
        videoRef.current.seek(0);
      }
      setIsPlaying(true);
    }
  }, [info, maxDuration, setCurrentTime, setIsPlaying, videoRef]);

  const handleAudioLoad = (data: any) => {
    const duration = data.duration;
    setAudioDuration(duration);
    setSelectDuration(Math.min(duration, maxDuration));
    // Sync audio to start (0) when audio loads
    syncPlayer(0);
    // Ensure video is at start and playing
    setCurrentTime(0);
    if (videoRef?.current) {
      videoRef.current.seek(0);
    }
    setIsPlaying(true);
    onAudioReady?.();
  };

  const SYNC_THRESHOLD = 0.5; // Only sync if time difference is more than 0.5 seconds

  const syncPlayer = useCallback(
    (timeToSyncWith: number) => {
      if (!audioPlayerRef.current) return;
      if (isUserScrolling.current) return;

      // Only sync if time difference is significant to avoid glitches
      const timeDiff = Math.abs(timeToSyncWith - lastSyncTimeRef.current);
      if (timeDiff < SYNC_THRESHOLD && lastSyncTimeRef.current > 0) {
        return;
      }

      const targetTime = isLooped
        ? timeToSyncWith % selectDuration
        : timeToSyncWith;
      const seekPosition = offsetSec + targetTime;

      if (seekPosition > audioDuration) return;

      // Only seek if the position is significantly different
      audioPlayerRef.current.seek(seekPosition);
      lastSyncTimeRef.current = timeToSyncWith;
    },
    [audioDuration, isLooped, offsetSec, selectDuration]
  );

  useEffect(() => {
    if (isUserScrolling.current) {
      return;
    }

    // Reset audio when video loops back to start
    if (isShortAudio && lastVideoTimeRef.current > 1 && videoCurrentTime < 1) {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.seek(offsetSec);
        lastSyncTimeRef.current = 0;
      }
    }

    // Determine if audio should be playing based on video state and audio duration
    let shouldBePlaying = isVideoPlaying;
    if (isShortAudio && isLooped) {
      shouldBePlaying = isVideoPlaying && videoCurrentTime < mainVideoDuration;
    } else if (isShortAudio && !isLooped) {
      shouldBePlaying = isVideoPlaying && videoCurrentTime < audioDuration;
    } else if (!isLooped && videoCurrentTime >= selectDuration) {
      shouldBePlaying = false;
    }

    // Sync audio play/pause state with video
    if (shouldBePlaying && isAudioPausedRef.current) {
      setIsAudioPaused(false);
      // Sync audio position when starting to play (only once)
      if (Math.abs(videoCurrentTime - lastSyncTimeRef.current) > 0.1) {
        syncPlayer(videoCurrentTime);
      }
    } else if (!shouldBePlaying && !isAudioPausedRef.current) {
      setIsAudioPaused(true);
    }

    // For short audio, we want to let the audio player handle its own repeat
    // but we use videoCurrentTime as the master sync source for the UI progress
    if (isShortAudio) {
      if (shouldBePlaying && !isAudioPausedRef.current) {
        // Sync audio position when starting to play or if video loops
        if (
          Math.abs(videoCurrentTime - lastVideoTimeRef.current) > 0.5 ||
          lastSyncTimeRef.current === 0
        ) {
          syncPlayer(videoCurrentTime);
        }
      }
    } else if (shouldBePlaying && !isAudioPausedRef.current) {
      const timeDiff = Math.abs(videoCurrentTime - lastVideoTimeRef.current);
      // Only sync if there's a significant jump (user seeked) or it's the first sync
      if (timeDiff > 1.0 || lastSyncTimeRef.current === 0) {
        syncPlayer(videoCurrentTime);
      }
    }

    lastVideoTimeRef.current = videoCurrentTime;
  }, [
    videoCurrentTime,
    isVideoPlaying,
    isLooped,
    selectDuration,
    syncPlayer,
    audioDuration,
    offsetSec,
    isShortAudio,
    mainVideoDuration,
  ]);

  const handleInternalProgress = (data: any) => {
    if (isUserScrolling.current || isAudioPausedRef.current) {
      return;
    }
    const relativeTime = data.currentTime - offsetSec;
    if (!isLooped && relativeTime >= selectDuration) {
      setIsAudioPaused(true);

      audioPlayerRef.current?.seek(offsetSec);
      return;
    }

    if (!isAudioPausedRef.current) {
      // Logic removed as progress tracks video
    }
  };

  const handleConfirm = () => {
    if (!info) return;
    const trimmedAudio = {
      uri: info.uri,
      name: info.name,
      startTime: offsetSec,
      duration: selectDuration,
      isLooped: isLooped,
    };
    onConfirm?.(trimmedAudio);
  };

  const handleCancel = () => {
    // Clear audio-related state
    setAudioUri(null);
    setCurrentTime(0);
    onClose?.();
  };

  const toggleLoop = () => {
    setIsLooped((prev) => !prev);
  };

  const handleScrollBegin = () => {
    isUserScrolling.current = true;
    // Pause video when user starts trimming
    if (isVideoPlaying) {
      setIsPlaying(false);
    }
    // Pause audio player
    if (!isAudioPausedRef.current) {
      setIsAudioPaused(true);
    }
  };

  const handleScrollEnd = (finalScrollX: number) => {
    clearTimeout(seekTimeout.current);

    seekTimeout.current = setTimeout(() => {
      isUserScrolling.current = false;

      const finalOffset = clamp(
        finalScrollX / 8.2,
        0,
        audioDuration - selectDuration
      );
      setOffsetSec(finalOffset);
      audioPlayerRef.current?.seek(finalOffset);

      // After trimming ends, seek video to 0 and start playing
      setCurrentTime(0);
      if (videoRef?.current) {
        videoRef.current.seek(0);
      }
      setIsPlaying(true);

      onSelectionChangeEnd?.();
    }, 100);
  };

  const scrollHandler = useAnimatedScrollHandler({
    onBeginDrag: () => {
      runOnJS(handleScrollBegin)();
    },
    onEndDrag: (event: any) => {
      if (Math.abs(event.velocity.x || 0) < FLING_VELOCITY_THRESHOLD) {
        runOnJS(handleScrollEnd)(event.contentOffset.x);
      }
    },
    onMomentumEnd: (event: any) => {
      runOnJS(handleScrollEnd)(event.contentOffset.x);
    },
  });

  // Calculate values before early return
  const isScrollable = audioDuration > maxDuration;

  let waveformTotalWidth;
  if (isScrollable) {
    waveformTotalWidth = audioDuration * PIXELS_PER_SECOND;
  } else {
    waveformTotalWidth = isLooped
      ? SELECT_WIDTH
      : (audioDuration / maxDuration) * SELECT_WIDTH;
  }
  // Calculate gradient fill progress - always based on video duration box
  const playbackProgressPercent = useMemo(() => {
    if (maxDuration <= 0) return 0;
    return (clamp(videoCurrentTime, 0, maxDuration) / maxDuration) * 100;
  }, [maxDuration, videoCurrentTime]);

  // All hooks must be called before any early returns
  const contentContainerStyle = useMemo(
    () => ({
      paddingLeft: isScrollable ? SCROLL_PADDING : 0,
      paddingRight: isScrollable ? SCROLL_PADDING : 0,
    }),
    [isScrollable, SCROLL_PADDING]
  );

  const waveformViewStyle = useMemo(
    () => ({
      width: waveformTotalWidth,
    }),
    [waveformTotalWidth]
  );

  const TicksWrapper = isShortAudio ? View : React.Fragment;
  const wrapperStyle = useMemo(
    () =>
      isShortAudio
        ? {
            width: SELECT_WIDTH,
            alignSelf: 'center' as const,
            overflow: 'hidden' as const,
          }
        : undefined,
    [isShortAudio]
  );
  const wrapperProps = isShortAudio ? { style: wrapperStyle } : {};

  if (!info) {
    return null;
  }

  return (
    <Animated.View style={[styles.trimmerContainer, style]}>
      <View style={styles.titleContainer}>
        <Text style={styles.title}>
          Choose the {Math.round(selectDuration)}s audio part for your pulse.
        </Text>
        {showLoopOption && (
          <Pressable onPress={toggleLoop} style={styles.loopButtonInTitle}>
            {isLooped ? (
              <LinearGradient
                colors={['#E3196A', '#FE9050']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.loopIconGradient}
              >
                <Image style={styles.loopIconText} source={LoopCycleIcon} />
              </LinearGradient>
            ) : (
              <Image style={styles.loopIconText} source={LoopCycleIcon} />
            )}
          </Pressable>
        )}
      </View>

      <View style={styles.waveArea}>
        <TicksWrapper {...wrapperProps}>
          <RNScrollView
            horizontal
            bounces={false}
            showsHorizontalScrollIndicator={false}
            onScroll={scrollHandler}
            scrollEnabled={isScrollable}
            contentContainerStyle={contentContainerStyle}
            scrollEventThrottle={16}
          >
            <View style={waveformViewStyle}>
              <TimelineTicks
                waveformWidth={waveformTotalWidth}
                barWidth={BAR_WIDTH}
                barGap={BAR_GAP}
                isLooped={isLooped}
                audioDuration={audioDuration}
                maxDuration={maxDuration}
                isScrollable={isScrollable}
              />
            </View>
          </RNScrollView>
        </TicksWrapper>
        <View
          style={[styles.selectionBox, { width: SELECT_WIDTH }]}
          pointerEvents="none"
        >
          <LinearGradient
            colors={['#E3196A80', '#FE905080']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[
              styles.playbackFill,
              { width: `${playbackProgressPercent}%` },
            ]}
          />
        </View>
      </View>

      <View style={styles.controlsContainer}>
        <RNPressable onPress={handleCancel}>
          <Text style={styles.actionButton}>Cancel</Text>
        </RNPressable>
        <RNPressable onPress={handleConfirm}>
          <Text style={[styles.actionButton, styles.doneButton]}>Done</Text>
        </RNPressable>
      </View>

      {info?.uri && (
        <Video
          ref={audioPlayerRef}
          source={{ uri: info.uri }}
          paused={isAudioPaused}
          // @ts-ignore - audioOnly is a valid prop for react-native-video
          audioOnly
          onLoad={handleAudioLoad}
          repeat={isLooped}
          playInBackground={true}
          playWhenInactive={true}
          ignoreSilentSwitch="ignore"
          onProgress={handleInternalProgress}
          progressUpdateInterval={50}
          style={styles.hiddenVideo}
        />
      )}
    </Animated.View>
  );
};

const TimelineTicks = React.memo(
  ({
    waveformWidth,
    barWidth,
    barGap,
    isLooped,
    audioDuration,
    maxDuration,
    isScrollable,
  }: any) => {
    const styles = useMemo(() => createAudioTrimmerStyles(), []);
    const totalBarWidth = barWidth + barGap;
    const barCount =
      waveformWidth > 0 ? Math.floor(waveformWidth / totalBarWidth) : 0;

    const barColor = 'rgba(255, 255, 255, 0.5)';

    const ticksRowWidthStyle = useMemo(
      () => ({
        width: barCount * totalBarWidth,
      }),
      [barCount, totalBarWidth]
    );

    const ticksRowWaveformStyle = useMemo(
      () => ({
        width: waveformWidth,
      }),
      [waveformWidth]
    );

    const ticksRowAndroidStyle = useMemo(
      () => (deviceUtils.isAndroid ? styles.ticksRowAndroid : {}),
      [styles.ticksRowAndroid]
    );

    const ticks = React.useMemo(() => {
      if (!isScrollable && isLooped) {
        const patternWidth = (audioDuration / maxDuration) * SELECT_WIDTH;
        const patternBarCount = Math.floor(patternWidth / totalBarWidth);

        if (patternBarCount === 0) return [];

        const basePattern = Array.from({ length: patternBarCount }, (_, i) => {
          const tall = i % 2 === 0;
          const accent = i % 9 === 0 ? 1.0 : i % 5 === 0 ? 0.75 : 0;
          const base = tall ? 0.7 : 0.35;
          return Math.min(1, base + accent);
        });

        const repeatCount = Math.ceil(barCount / patternBarCount);
        return Array.from({ length: repeatCount })
          .flatMap(() => basePattern)
          .slice(0, barCount);
      }

      return Array.from({ length: barCount }, (_, i) => {
        const tall = i % 2 === 0;
        const accent = i % 9 === 0 ? 1.0 : i % 5 === 0 ? 0.75 : 0;
        const base = tall ? 0.7 : 0.35;
        return Math.min(1, base + accent);
      });
    }, [
      barCount,
      isLooped,
      audioDuration,
      maxDuration,
      isScrollable,
      totalBarWidth,
    ]);

    if (barCount === 0) {
      return <View style={[styles.ticksRow, ticksRowWaveformStyle]} />;
    }

    return (
      <View style={[styles.ticksRow, ticksRowWidthStyle, ticksRowAndroidStyle]}>
        {ticks.map((height: number, i: number) => (
          <View
            key={i}
            style={[
              styles.tick,
              { height: 8 + height * 38, backgroundColor: barColor },
            ]}
          />
        ))}
      </View>
    );
  }
);
