import React, { useEffect, useCallback, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  StatusBar,
  Image,
} from 'react-native';

import {
  GestureHandlerRootView,
  Gesture,
  GestureDetector,
  // @ts-ignore - Peer dependency
} from 'react-native-gesture-handler';

import Animated, {
  useSharedValue,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
  withTiming,
  runOnJS,
  // @ts-ignore - Peer dependency
} from 'react-native-reanimated';
// @ts-ignore - Peer dependency
import { ScaledSheet } from 'react-native-size-matters';
// @ts-ignore - Peer dependency
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { EditorProvider, useEditorContext } from '../context/EditorContext';
import {
  EditorStateProvider,
  useEditorState,
} from '../context/EditorStateContext';
import { VideoEditorNative } from '../native/VideoEditorNative';
import type { VideoEditorSDKProps } from '../types';
import { PreviewArea } from './editor/PreviewArea';
import { Timeline } from './editor/Timeline';
import { CropBottomSheet } from './editor/CropBottomSheet';
import { BottomToolBar } from './editor/BottomToolBar';
import { TopBar } from './editor/TopBar';
import { AudioTrimmerBottomSheet } from './editor/AudioTrimmerBottomSheet';
// Conditionally import VoiceRecorderBottomSheet
let VoiceRecorderBottomSheet: any = null;
try {
  const voiceRecorderModule = require('./editor/VoiceRecorderBottomSheet');
  VoiceRecorderBottomSheet = voiceRecorderModule.VoiceRecorderBottomSheet;
} catch (e) {
  console.warn('VoiceRecorderBottomSheet not available:', e);
}
import { TextEditor } from './editor/TextEditor';
import { deviceUtils } from '../utils/deviceUtils';
import type {
  AudioSegment,
  TextSegment,
  VoiceoverSegment,
} from '../types/segments';
import { PREVIEW_HEIGHT, FONT_SIZE_MIN } from '../constants/dimensions';
// @ts-ignore - Peer dependency
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const VideoEditorSDKContentInner: React.FC<VideoEditorSDKProps> = ({
  source,
  editTrim = false,
  editCrop = false,
  editBGM = false,
  editTextOverlay = false,
  editVoiceOver = false,
  onCloseEditor,
}) => {
  const {
    initEditor,
    buildExportConfig,
    resetEditor,
    getPlaybackState,
    addAudioSegment,
    setAudioUri,
    setCurrentTime,
    isPlaying,
    setIsPlaying,
    textSegments,
    addTextSegment,
    updateTextSegment,
    removeTextSegment,
    isTextEditorVisible,
    setIsTextEditorVisible,
    editingTextElement,
    setEditingTextElement,
    isTextDragging,
    voiceoverSegments,
    addVoiceoverSegment,
    videoRef,
  } = useEditorState();

  // Convert source to proper URI string (handle require() numbers)
  const getSourceUri = (src: any): string => {
    if (!src) return '';

    // If it's already a string, use it
    if (typeof src === 'string') {
      return src;
    }

    // If it's a number (from require()), resolve it
    if (typeof src === 'number') {
      try {
        const resolved = Image.resolveAssetSource(src);
        if (resolved && resolved.uri) {
          return resolved.uri;
        }
        console.warn(
          '🎬 VideoEditorSDK: Failed to resolve asset source for number:',
          src
        );
        return '';
      } catch (error) {
        console.error(
          '🎬 VideoEditorSDK: Error resolving asset source:',
          error
        );
        return '';
      }
    }

    // If it's an object with uri
    if (typeof src === 'object' && src.uri) {
      return String(src.uri);
    }

    return '';
  };

  const sourceUri = getSourceUri(source);
  const { activeTool, setActiveTool } = useEditorContext();
  const [containerHeight, setContainerHeight] = useState(0);
  const [toolBarHeight, setToolBarHeight] = useState(0);
  const [isTimelineVisible, setIsTimelineVisible] = useState(false);
  const safeMargin = deviceUtils.isSmallIphone() ? toolBarHeight / 1.6 : 0;
  const safeSpaceBottom = deviceUtils.isIOS
    ? toolBarHeight / 3
    : toolBarHeight / 1.5;

  // Animation values
  const layoutAnimation = useSharedValue(0);
  const audioTrimmerAnimation = useSharedValue(0);

  const { top: safeTop, bottom: safeBottom } = useSafeAreaInsets();

  useEffect(() => {
    if (!source) {
      onCloseEditor({ success: false, error: 'Video source missing' });
      return;
    }

    initEditor({
      source: sourceUri || source,
      features: {
        editTrim,
        editCrop,
        editBGM,
        editTextOverlay,
        editVoiceOver,
      },
    });

    return () => {
      resetEditor();
    };
  }, [
    editTrim,
    editCrop,
    editBGM,
    editTextOverlay,
    editVoiceOver,
    initEditor,
    onCloseEditor,
    resetEditor,
    source,
    sourceUri,
  ]);

  const handleExport = useCallback(async () => {
    try {
      // Hide timeline before export
      if (isTimelineVisible) {
        setIsTimelineVisible(false);
        // Give animation time to complete (300ms for smooth transition)
        await new Promise((resolve) => setTimeout(resolve, 300));
      }

      const config = buildExportConfig();
      console.log('config', config);
      // return;
      const exportedUri = await VideoEditorNative.applyEdits(config);
      onCloseEditor({ success: true, exportedUri });
    } catch (e: any) {
      onCloseEditor({
        success: false,
        error: e?.message ?? 'Export failed',
      });
    }
  }, [
    buildExportConfig,
    onCloseEditor,
    isTimelineVisible,
    setIsTimelineVisible,
  ]);

  // Animation effects
  useEffect(() => {
    layoutAnimation.value = withTiming(isTimelineVisible ? 1 : 0, {
      duration: 300,
    });
  }, [isTimelineVisible, layoutAnimation]);

  useEffect(() => {
    // Show audio trimmer when bgm tool is active
    const shouldShow = activeTool === 'bgm';
    audioTrimmerAnimation.value = withTiming(shouldShow ? 1 : 0, {
      duration: 300,
    });

    // When audio trimmer opens, seek video to start and play
    if (shouldShow) {
      setCurrentTime(0);
      if (videoRef?.current) {
        videoRef.current.seek(0);
      }
      setIsPlaying(true);
    }
  }, [
    activeTool,
    audioTrimmerAnimation,
    setCurrentTime,
    setIsPlaying,
    videoRef,
  ]);

  useEffect(() => {
    // Show timeline when trim tool is active
    if (activeTool === 'trim') {
      setIsTimelineVisible(true);
    }
  }, [activeTool]);

  // Timeline Section - Absolute Positioned at Bottom
  const handleTextEditorDone = useCallback(
    (textData: Partial<TextSegment> & { id?: string | null }) => {
      const { currentTime, duration } = getPlaybackState();
      const isTextEmpty = !textData.text || textData.text.trim().length === 0;

      if (isTextEmpty) {
        if (textData.id) {
          removeTextSegment(textData.id);
        }
      } else {
        if (textData.id) {
          // Update existing text segment
          updateTextSegment(textData.id, {
            text: textData.text || '',
            fontSize: textData.fontSize || FONT_SIZE_MIN,
            color: textData.color || 'white',
            backgroundColor: textData.backgroundColor || 'transparent',
            x: textData.x ?? 0,
            y: textData.y ?? 0,
          });
        } else {
          // Create new text segment
          const newTextSegment: TextSegment = {
            id: `text-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: 'text',
            text: textData.text || '',
            fontSize: textData.fontSize || FONT_SIZE_MIN,
            color: textData.color || 'white',
            backgroundColor: textData.backgroundColor || 'transparent',
            start: currentTime,
            end: duration,
            x: textData.x ?? 0,
            y: textData.y ?? 0,
          };
          addTextSegment(newTextSegment);
        }
      }

      setIsTextEditorVisible(false);
      setEditingTextElement(null);
    },
    [
      getPlaybackState,
      removeTextSegment,
      updateTextSegment,
      addTextSegment,
      setIsTextEditorVisible,
      setEditingTextElement,
    ]
  );

  const handleTextEditorCancel = useCallback(() => {
    setIsTextEditorVisible(false);
    setEditingTextElement(null);
  }, [setIsTextEditorVisible, setEditingTextElement]);

  // Animated styles
  const timelineSectionAnimatedStyle = useAnimatedStyle(() => {
    const timelineTranslateY = interpolate(
      layoutAnimation.value,
      [0, 1],
      [TIMELINE_SECTION_HEIGHT, 0],
      Extrapolation.CLAMP
    );
    const timelineOpacity = interpolate(
      layoutAnimation.value,
      [0, 0.5, 1],
      [0, 0, 1],
      Extrapolation.CLAMP
    );

    const audioTrimmerTranslateY = interpolate(
      audioTrimmerAnimation.value,
      [0, 1],
      [0, TIMELINE_SECTION_HEIGHT / 2],
      Extrapolation.CLAMP
    );
    const audioTrimmerOpacity = interpolate(
      audioTrimmerAnimation.value,
      [0, 0.7, 1],
      [1, 0, 0],
      Extrapolation.CLAMP
    );

    return {
      transform: [{ translateY: timelineTranslateY + audioTrimmerTranslateY }],
      opacity: timelineOpacity * audioTrimmerOpacity,
    };
  });

  const safeMarginBottom = deviceUtils.isIOS ? 5 : -25;
  const bottomValue = useMemo(() => {
    return deviceUtils.isSmallIphone()
      ? 0
      : containerHeight > 0
      ? containerHeight -
        PREVIEW_HEIGHT -
        safeTop -
        safeBottom +
        safeMarginBottom
      : 0;
  }, [containerHeight, safeBottom, safeTop, safeMarginBottom]);

  const toolsSectionAnimatedStyle = useAnimatedStyle(() => {
    const translateY = interpolate(
      audioTrimmerAnimation.value,
      [0, 1],
      [0, TOOLS_SECTION_HEIGHT],
      Extrapolation.CLAMP
    );
    const opacity = interpolate(
      audioTrimmerAnimation.value,
      [0, 0.7, 1],
      [1, 0, 0],
      Extrapolation.CLAMP
    );

    const bottom = interpolate(
      layoutAnimation.value,
      [0, 1],
      [bottomValue, 0],
      Extrapolation.CLAMP
    );

    return {
      transform: [{ translateY }],
      bottom: bottom,
      opacity,
    };
  }, [bottomValue]);

  const swipeIndicatorAnimatedStyle = useAnimatedStyle(() => {
    const timelineOpacity = interpolate(
      layoutAnimation.value,
      [0, 0.2],
      [1, 0],
      Extrapolation.CLAMP
    );
    const trimmerOpacity = interpolate(
      audioTrimmerAnimation.value,
      [0, 1],
      [1, 0],
      Extrapolation.CLAMP
    );

    return {
      opacity: timelineOpacity * trimmerOpacity,
    };
  });

  const headerAnimatedStyle = useAnimatedStyle(() => {
    const audioTrimmerOpacity = interpolate(
      audioTrimmerAnimation.value,
      [0, 1],
      [1, 0],
      Extrapolation.CLAMP
    );
    return {
      opacity: audioTrimmerOpacity,
    };
  });

  const audioTrimmerSheetAnimatedStyle = useAnimatedStyle(() => {
    const translateY = interpolate(
      audioTrimmerAnimation.value,
      [0, 1],
      [300, 0],
      Extrapolation.CLAMP
    );
    const opacity = interpolate(
      audioTrimmerAnimation.value,
      [0, 0.3, 1],
      [0, 0, 1],
      Extrapolation.CLAMP
    );
    return {
      position: 'absolute',
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
      transform: [{ translateY }],
      opacity,
      pointerEvents: audioTrimmerAnimation.value < 0.5 ? 'none' : 'auto',
      zIndex: 30,
    };
  });

  // Swipe gesture for expanding/collapsing timeline
  const toggleTimeline = (expand: boolean) => {
    setIsTimelineVisible(expand);
  };

  // Reset preview to normal size
  const resetPreviewToNormal = useCallback(() => {
    setIsTimelineVisible(false);
  }, []);

  const swipeUpGesture = Gesture.Pan()
    .onUpdate((e: any) => {
      const currentValue = isTimelineVisible ? 1 : 0;
      const gestureProgress = -e.translationY / 250;
      const newProgress = Math.max(
        0,
        Math.min(1, currentValue + gestureProgress)
      );
      layoutAnimation.value = newProgress;
    })
    .onEnd((e: any) => {
      if (e.translationY < -60 || e.velocityY < -500) {
        runOnJS(toggleTimeline)(true);
      } else if (e.translationY > 60 || e.velocityY > 500) {
        runOnJS(toggleTimeline)(false);
      } else {
        runOnJS(toggleTimeline)(isTimelineVisible);
      }
    });

  const backgroundTapGesture = Gesture.Tap()
    .maxDuration(150)
    .onEnd(() => {
      // Tap to play/pause functionality can be added here
    });

  const backgroundGestures = Gesture.Race(swipeUpGesture, backgroundTapGesture);

  return (
    <GestureHandlerRootView style={styles.safeArea}>
      <StatusBar barStyle={'light-content'} />
      <View
        style={styles.container}
        onLayout={(e: any) => {
          setContainerHeight(e.nativeEvent.layout.height);
        }}
      >
        {/* Video Container - Full Screen with Swipe Gesture */}
        <GestureDetector gesture={backgroundGestures}>
          <Animated.View style={styles.videoContainer}>
            <PreviewArea
              source={sourceUri || source}
              layoutAnimation={layoutAnimation}
              textSegments={textSegments}
            />
          </Animated.View>
        </GestureDetector>

        {/* Header - Absolute Positioned at Top */}
        <Animated.View style={[styles.headerContainer, headerAnimatedStyle]}>
          <TopBar
            onCancel={() => onCloseEditor({ success: false })}
            onExport={handleExport}
          />
        </Animated.View>

        {/* Swipe Indicator */}
        <Animated.View
          style={[
            styles.swipeIndicator,
            swipeIndicatorAnimatedStyle,
            {
              bottom:
                containerHeight - PREVIEW_HEIGHT + safeSpaceBottom + safeMargin,
            },
          ]}
        >
          <View style={styles.swipeHandle} />
          <Text style={styles.swipeText}>Swipe up to edit</Text>
        </Animated.View>

        {/* Timeline Section - Absolute Positioned at Bottom */}
        <Animated.View
          style={[styles.timelineSection, timelineSectionAnimatedStyle]}
        >
          <Timeline
            videoSource={sourceUri || source}
            onSegmentPress={resetPreviewToNormal}
            onCloseTimeline={() => setIsTimelineVisible(false)}
          />
        </Animated.View>

        {/* Tools Section - Absolute Positioned at Bottom */}
        <Animated.View
          style={[styles.toolsSection, toolsSectionAnimatedStyle]}
          onLayout={(e: any) => {
            setToolBarHeight(e.nativeEvent.layout.height);
          }}
        >
          <BottomToolBar
            onToolPress={resetPreviewToNormal}
            onExport={handleExport}
          />
        </Animated.View>

        {/* Bottom Sheets */}
        <CropBottomSheet />
        <Animated.View style={audioTrimmerSheetAnimatedStyle}>
          <AudioTrimmerBottomSheet
            onClose={() => {
              setActiveTool(null);
              setAudioUri(null);
            }}
            onConfirm={(trimmedAudio) => {
              const { duration } = getPlaybackState();
              const newAudioSegment: AudioSegment = {
                id: `music-${Date.now()}`,
                type: 'audio',
                start: 0,
                end: Math.min(trimmedAudio.duration, duration),
                uri: trimmedAudio.uri,
                name: trimmedAudio.name,
                color: '#FF3040',
                audioOffset: trimmedAudio.startTime,
                clipDuration: trimmedAudio.duration,
                isLooped: trimmedAudio.isLooped,
              };
              setActiveTool(null);
              // Pause video to ensure clean state
              setIsPlaying(false);
              // Seek video to start (0) - this is where the audio segment starts
              setCurrentTime(0);
              if (videoRef?.current) {
                videoRef.current.seek(0);
              }
              // Add audio segment - native module receives audioOffset and will start audio from that position
              // when video is at segment start time (0)
              addAudioSegment(newAudioSegment);
              // Use requestAnimationFrame to ensure native module has processed the operation
              requestAnimationFrame(() => {
                // Additional small delay to ensure audio is initialized at audioOffset
                setTimeout(() => {
                  // Start playing - native module should now start audio from audioOffset position
                  setIsPlaying(true);
                }, 150);
              });
            }}
          />
        </Animated.View>

        {VoiceRecorderBottomSheet && (
          <VoiceRecorderBottomSheet
            isVisible={activeTool === 'voiceover'}
            videoCurrentTime={getPlaybackState().currentTime}
            videoDuration={getPlaybackState().duration}
            voiceoverSegments={voiceoverSegments}
            onClose={() => {
              setActiveTool(null);
              if (isPlaying) setIsPlaying(false);
            }}
            onDone={(voiceoverData: any) => {
              const { duration } = getPlaybackState();
              const endTime = Math.min(
                voiceoverData.start + voiceoverData.duration,
                duration
              );
              const newVoiceoverSegment: VoiceoverSegment = {
                id: `voiceover-${Date.now()}-${Math.random()
                  .toString(36)
                  .substr(2, 9)}`,
                type: 'voiceover',
                start: voiceoverData.start,
                end: endTime,
                uri: voiceoverData.uri,
                name: 'My Voiceover',
                color: '#9C27B0',
              };
              addVoiceoverSegment(newVoiceoverSegment);
              setActiveTool(null);
            }}
          />
        )}

        {/* Text Editor */}
        {isTextEditorVisible && (
          <TextEditor
            onCancel={handleTextEditorCancel}
            onDone={handleTextEditorDone}
            initialTextElement={editingTextElement}
          />
        )}

        {/* Delete Zone for Text Dragging */}
        {isTextDragging && (
          <View style={styles.deleteZoneContainer}>
            <Text style={styles.deleteZoneText}>Drag here to delete</Text>
            <View style={styles.deleteZoneCircle}>
              <Text style={styles.deleteTextIcon}>🗑️</Text>
            </View>
          </View>
        )}
      </View>
    </GestureHandlerRootView>
  );
};

const VideoEditorSDKContent: React.FC<VideoEditorSDKProps> = (props) => {
  return (
    <EditorProvider
      enabledFeatures={{
        editTrim: props.editTrim ?? false,
        editCrop: props.editCrop ?? false,
        editBGM: props.editBGM ?? false,
        editTextOverlay: props.editTextOverlay ?? false,
        editVoiceOver: props.editVoiceOver ?? false,
      }}
    >
      <VideoEditorSDKContentInner {...props} />
    </EditorProvider>
  );
};

export const VideoEditorSDK: React.FC<VideoEditorSDKProps> = (props) => {
  return (
    <SafeAreaProvider>
      <EditorStateProvider>
        <VideoEditorSDKContent
          editTrim={props.editTrim}
          editCrop={props.editCrop}
          editBGM={props.editBGM}
          editTextOverlay={props.editTextOverlay}
          editVoiceOver={props.editVoiceOver}
          source={props.source}
          onCloseEditor={props.onCloseEditor}
        />
      </EditorStateProvider>
    </SafeAreaProvider>
  );
};

const SCREEN_HEIGHT = Dimensions.get('window').height;
const TOOLS_SECTION_HEIGHT = 140;
const TIMELINE_SECTION_HEIGHT = deviceUtils.isAndroid
  ? SCREEN_HEIGHT * 0.3
  : SCREEN_HEIGHT * 0.32;

const styles = ScaledSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#000',
  },
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoContainer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: '10@ms',
  },
  swipeIndicator: {
    position: 'absolute',
    alignItems: 'center',
    zIndex: '10@ms',
  },
  swipeHandle: {
    width: '50@ms',
    height: '4@ms',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: '2@ms',
    marginBottom: '8@ms',
  },
  swipeText: {
    fontSize: '12@ms',
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500',
  },
  timelineSection: {
    position: 'absolute',
    bottom: TOOLS_SECTION_HEIGHT,
    left: 0,
    right: 0,
    height: TIMELINE_SECTION_HEIGHT,
    backgroundColor: '#000',
    paddingTop: '10@ms',
    zIndex: '20@ms',
    borderTopLeftRadius: '16@ms',
    borderTopRightRadius: '16@ms',
    borderTopWidth: '1@ms',
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  toolsSection: {
    position: 'absolute',
    left: 0,
    right: 0,
    justifyContent: 'center',
    zIndex: '20@ms',
  },
  deleteZoneContainer: {
    position: 'absolute',
    bottom: '100@ms',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: '150@ms',
  },
  deleteZoneText: {
    color: '#fff',
    fontSize: '16@ms',
    fontWeight: '600',
    marginBottom: '10@ms',
  },
  deleteZoneCircle: {
    width: '60@ms',
    height: '60@ms',
    borderRadius: '30@ms',
    backgroundColor: 'rgba(255, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteTextIcon: {
    fontSize: '24@ms',
  },
});
