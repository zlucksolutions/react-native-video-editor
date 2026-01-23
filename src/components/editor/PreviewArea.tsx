import React, { useRef, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Pressable,
  Platform,
} from 'react-native';
// @ts-ignore - Peer dependency
import Video, {
  type OnLoadData,
  type OnProgressData,
  // @ts-ignore - Peer dependency
} from 'react-native-video';
// @ts-ignore - Peer dependency
import Animated, {
  useAnimatedStyle,
  interpolate,
  // @ts-ignore - Peer dependency
} from 'react-native-reanimated';
// @ts-ignore - Peer dependency
import { ScaledSheet } from 'react-native-size-matters';
import { useEditorState } from '../../context/EditorStateContext';
// @ts-ignore - Peer dependency
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  PREVIEW_WIDTH,
  PREVIEW_HEIGHT,
  SMALL_PREVIEW_WIDTH,
  SMALL_PREVIEW_HEIGHT,
} from '../../constants/dimensions';
import { DraggableText } from './DraggableText';
import type { TextSegment } from '../../types/segments';

type Props = {
  source: string;
  layoutAnimation: Animated.SharedValue<number>;
  textSegments?: TextSegment[];
};

const SCREEN_WIDTH = Dimensions.get('window').width;

export const PreviewArea: React.FC<Props> = ({
  source,
  layoutAnimation,
  textSegments = [],
}) => {
  const videoRef = useRef<any>(null);
  const voiceoverRefs = useRef<{ [key: string]: any }>({});
  const {
    setCurrentTime,
    setDuration,
    getTrim,
    getPlaybackState,
    isScrubbing,
    cropRatio,
    videoNaturalSize,
    setVideoNaturalSize,
    isPlaying,
    isDraggingHandle,
    setVideoRef,
    setIsPlaying,
    isMuted,
    audioSegments,
    voiceoverSegments,
    setEditingTextElement,
    setIsTextEditorVisible,
    setIsTextDragging,
    updateTextSegment,
    removeTextSegment,
    setIsTextPinching,
  } = useEditorState();

  // Register video ref with context
  React.useEffect(() => {
    setVideoRef(videoRef);
    return () => setVideoRef(null);
  }, [setVideoRef]);

  const { currentTime } = getPlaybackState();
  const { top: safeAreaTop } = useSafeAreaInsets();
  const [mainVideoVolume, setMainVideoVolume] = useState(1.0);

  const aspectRatios = useMemo(() => {
    const originalRatio =
      videoNaturalSize?.width && videoNaturalSize?.height
        ? videoNaturalSize.width / videoNaturalSize.height
        : 9 / 16;

    return {
      'original': originalRatio,
      '9:16': 9 / 16,
      '1:1': 1,
      '16:9': 16 / 9,
    };
  }, [videoNaturalSize]);

  // Dynamic video style based on aspect ratio
  const dynamicVideoStyle = useMemo(() => {
    const videoAspectRatio =
      aspectRatios[cropRatio as keyof typeof aspectRatios];

    if (!videoAspectRatio) {
      return { height: '100%' };
    }

    if (videoAspectRatio < 1) {
      return { height: '100%', width: undefined };
    } else {
      return { width: '100%', height: undefined };
    }
  }, [cropRatio, aspectRatios]);

  React.useEffect(() => {
    if ((isScrubbing || isDraggingHandle) && videoRef.current) {
      videoRef.current.seek(currentTime);
    }
  }, [currentTime, isScrubbing, isDraggingHandle]);

  // Force video refresh when audio segments are removed to stop background music
  const audioSegmentsLengthRef = React.useRef(audioSegments?.length || 0);
  React.useEffect(() => {
    const currentLength = audioSegments?.length || 0;
    const previousLength = audioSegmentsLengthRef.current;

    // If audio segments were removed (length decreased), force video refresh
    if (
      previousLength > 0 &&
      currentLength < previousLength &&
      videoRef.current &&
      !isScrubbing &&
      !isDraggingHandle
    ) {
      const { currentTime: videoTime, duration: videoDuration } =
        getPlaybackState();
      if (videoTime >= 0 && videoDuration > 0) {
        // Pause, seek, and resume to force native module to update and stop audio
        const wasPlaying = isPlaying;
        if (wasPlaying) {
          setIsPlaying(false);
        }

        setTimeout(() => {
          if (videoRef.current) {
            const seekTime = Math.max(0, Math.min(videoTime, videoDuration));
            // Seek to force native module to update and stop audio
            videoRef.current.seek(seekTime);

            // Resume playback if it was playing before
            if (wasPlaying) {
              setTimeout(() => {
                setIsPlaying(true);
              }, 100);
            }
          }
        }, 100);
      }
    }

    audioSegmentsLengthRef.current = currentLength;
  }, [
    audioSegments?.length,
    isScrubbing,
    isDraggingHandle,
    isPlaying,
    setIsPlaying,
    getPlaybackState,
  ]);

  // Sync voiceover players when currentTime changes (e.g., during scrubbing)
  const prevCurrentTimeRef = React.useRef(currentTime);
  React.useEffect(() => {
    const timeDiff = Math.abs(currentTime - prevCurrentTimeRef.current);
    // If time jumped significantly (user seeked), update voiceover positions
    if (timeDiff > 0.5) {
      voiceoverSegments?.forEach((seg: any) => {
        const isActive = currentTime >= seg.start && currentTime < seg.end;
        const player = voiceoverRefs.current[seg.id];
        if (player && isActive) {
          const relativeTime = currentTime - seg.start;
          player.seek(Math.max(0, relativeTime));
        }
      });
    }
    prevCurrentTimeRef.current = currentTime;
  }, [currentTime, voiceoverSegments]);

  const videoContainerAnimatedStyle = useAnimatedStyle(() => {
    const width = interpolate(
      layoutAnimation.value,
      [0, 1],
      [PREVIEW_WIDTH, SMALL_PREVIEW_WIDTH]
    );

    const height = interpolate(
      layoutAnimation.value,
      [0, 1],
      [PREVIEW_HEIGHT, SMALL_PREVIEW_HEIGHT]
    );

    const borderRadius = interpolate(layoutAnimation.value, [0, 1], [0, 12]);

    const top = Platform.OS === 'ios' ? safeAreaTop : 0;

    const left = interpolate(
      layoutAnimation.value,
      [0, 1],
      [0, (SCREEN_WIDTH - SMALL_PREVIEW_WIDTH) / 2]
    );

    const borderWidth = interpolate(layoutAnimation.value, [0.8, 1], [0, 1]);

    return {
      width,
      height,
      borderRadius,
      position: 'absolute',
      top,
      left,
      borderWidth,
      borderColor: 'rgba(255, 255, 255, 0.3)',
    };
  });

  const handleVideoPress = () => {
    setIsPlaying(!isPlaying);
  };

  const videoSourceProp = useMemo(() => ({ uri: source }), [source]);

  return (
    <Pressable onPress={handleVideoPress} style={StyleSheet.absoluteFill}>
      <Animated.View
        style={[styles.videoContainer, videoContainerAnimatedStyle]}
      >
        <Video
          ref={videoRef}
          source={videoSourceProp}
          style={[
            styles.videoPreview,
            dynamicVideoStyle,
            {
              aspectRatio: aspectRatios[cropRatio as keyof typeof aspectRatios],
            },
          ]}
          resizeMode="cover"
          repeat={true}
          paused={!isPlaying}
          controls={false}
          onLoad={(e: OnLoadData) => {
            setDuration(e.duration);
            if (e.naturalSize) {
              setVideoNaturalSize({
                width: e.naturalSize.width,
                height: e.naturalSize.height,
              });
            }
          }}
          onProgress={(e: OnProgressData) => {
            const { start, end } = getTrim();
            let time = e.currentTime;

            // Handle trim boundaries - loop back to start when reaching end
            if (
              !isScrubbing &&
              !isDraggingHandle &&
              time > end * e.seekableDuration
            ) {
              videoRef.current?.seek(start * e.seekableDuration);
              time = start * e.seekableDuration;
            }

            // Calculate volume ducking based on active segments
            const isVoiceoverActive =
              voiceoverSegments?.some(
                (seg: any) => time >= seg.start && time < seg.end
              ) || false;
            const isBgMusicActive =
              audioSegments?.some(
                (seg: any) => time >= seg.start && time < seg.end
              ) || false;

            // Apply volume rules: mute -> 0, voiceover -> 0.15, bgm -> 0.46, normal -> 1.0
            if (isMuted) {
              setMainVideoVolume(0.0);
            } else if (isVoiceoverActive) {
              setMainVideoVolume(0.15);
            } else if (isBgMusicActive) {
              setMainVideoVolume(0.46);
            } else {
              setMainVideoVolume(1.0);
            }

            // Always update timeline position during playback
            // Only skip update if user is actively scrubbing or dragging (to prevent feedback loop)
            if (!isScrubbing && !isDraggingHandle) {
              setCurrentTime(time);
            }
          }}
          progressUpdateInterval={100}
          volume={mainVideoVolume}
          muted={isMuted}
        />

        {/* Text Overlay Canvas - Now inside the same container */}
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          {textSegments.map((segment) => {
            const isVisible =
              currentTime >= segment.start && currentTime < segment.end;
            return (
              <DraggableText
                key={segment.id}
                element={segment}
                onPress={(element) => {
                  setEditingTextElement(element);
                  setIsTextEditorVisible(true);
                  if (isPlaying) setIsPlaying(false);
                }}
                onDragStateChange={setIsTextDragging}
                onUpdatePosition={(id, position) => {
                  updateTextSegment(id, position);
                }}
                onUpdateFontSize={(id, fontSize) => {
                  updateTextSegment(id, { fontSize });
                }}
                onDelete={(id) => {
                  removeTextSegment(id);
                }}
                onPinchStateChange={setIsTextPinching}
                containerSize={{
                  width: PREVIEW_WIDTH,
                  height: PREVIEW_HEIGHT,
                }}
                isDraggable={layoutAnimation.value === 0} // Disable dragging when minimized
                layoutAnimation={layoutAnimation}
                pinchActive={{ value: 0 } as any}
                isVisible={isVisible}
              />
            );
          })}
        </View>

        {!isPlaying && (
          <View style={styles.overlay} pointerEvents="none">
            <View style={styles.playButton}>
              <Text style={styles.playIcon}>▶</Text>
            </View>
          </View>
        )}
      </Animated.View>

      {/* Hidden voiceover audio players */}
      {voiceoverSegments?.map((seg: any) => {
        const isActive = currentTime >= seg.start && currentTime < seg.end;
        const relativeTime = currentTime - seg.start;

        return (
          <Video
            key={seg.id}
            ref={(ref: any) => {
              if (ref) {
                voiceoverRefs.current[seg.id] = ref;
                // Seek to correct position when component mounts or becomes active
                if (isActive && relativeTime > 0) {
                  setTimeout(() => ref.seek(relativeTime), 100);
                }
              } else {
                delete voiceoverRefs.current[seg.id];
              }
            }}
            source={{ uri: seg.uri }}
            paused={!isActive || !isPlaying || isScrubbing}
            volume={isMuted ? 0 : 1.5}
            // @ts-ignore - audioOnly is valid for react-native-video
            audioOnly
            playInBackground={false}
            playWhenInactive={false}
            style={{ width: 0, height: 0, position: 'absolute' }}
            onLoad={() => {
              // Seek to correct position when audio loads
              if (isActive && relativeTime > 0) {
                const player = voiceoverRefs.current[seg.id];
                if (player) {
                  player.seek(relativeTime);
                }
              }
            }}
          />
        );
      })}
    </Pressable>
  );
};

const styles = ScaledSheet.create({
  videoContainer: {
    alignItems: 'center',
    overflow: 'hidden',
    justifyContent: 'center',
    backgroundColor: '#000',
  },
  videoPreview: {
    backgroundColor: '#000',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  playButton: {
    width: '60@ms',
    height: '60@ms',
    borderRadius: '30@ms',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playIcon: {
    color: '#fff',
    fontSize: '24@ms',
    marginLeft: '4@ms',
  },
});
