import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  Platform,
  Alert,
  ActivityIndicator,
  PermissionsAndroid,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  cancelAnimation,
  // @ts-ignore - Peer dependency
} from 'react-native-reanimated';
import { deviceUtils } from '../../utils/deviceUtils';
// @ts-ignore - Peer dependency
import { Pressable as PressableGH } from 'react-native-gesture-handler';
// @ts-ignore - Peer dependency
import type BottomSheet from '@gorhom/bottom-sheet';
import { StyleFunction } from './VoiceRecorderBottomSheetStyles';
import { CustomBottomSheet } from './CustomBottomSheet';

// Safe imports with try-catch
let Sound: any = null;
let AudioEncoderAndroidType: any;
let AudioSourceAndroidType: any;
let AVEncoderAudioQualityIOSType: any;
let OutputFormatAndroidType: any;
let RNFS: any = null;

try {
  // @ts-ignore - Peer dependency
  const soundModule = require('react-native-nitro-sound');
  Sound = soundModule.default || soundModule;
  AudioEncoderAndroidType = soundModule.AudioEncoderAndroidType;
  AudioSourceAndroidType = soundModule.AudioSourceAndroidType;
  AVEncoderAudioQualityIOSType = soundModule.AVEncoderAudioQualityIOSType;
  OutputFormatAndroidType = soundModule.OutputFormatAndroidType;
} catch (e) {
  console.warn('react-native-nitro-sound not available:', e);
}

try {
  // @ts-ignore - Peer dependency
  RNFS = require('react-native-fs');
} catch (e) {
  console.warn('react-native-fs not available:', e);
}

const styles = StyleFunction();
interface VoiceRecorderBottomSheetProps {
  isVisible: boolean;
  onClose: () => void;
  onDone: (voiceoverData: {
    uri: string;
    duration: number;
    start: number;
  }) => void;
  videoCurrentTime: number;
  videoDuration: number;
  voiceoverSegments?: Array<{
    id: string;
    start: number;
    end: number;
  }>;
}

const PressableWrapper = deviceUtils.isIOS ? Pressable : PressableGH;

export const VoiceRecorderBottomSheet: React.FC<
  VoiceRecorderBottomSheetProps
> = ({
  isVisible,
  onClose,
  onDone,
  videoCurrentTime,
  videoDuration,
  voiceoverSegments = [],
}) => {
  // All hooks must be called before any early returns
  const pulse = useSharedValue(1);

  const [isRecording, setIsRecording] = useState(false);
  const [recordTime, setRecordTime] = useState(0);
  const [recordedAudioUri, setRecordedAudioUri] = useState<string | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isStartingRecord, setIsStartingRecord] = useState(false);
  const [isStoppingRecord, setIsStoppingRecord] = useState(false);
  const [sheetIndex, setSheetIndex] = useState(isVisible ? 0 : -1);
  const bottomSheetRef = useRef<BottomSheet>(null);

  // Calculate max recording duration based on next voiceover or video end
  const nextVoiceover = voiceoverSegments
    .filter((seg) => seg.start > videoCurrentTime)
    .sort((a, b) => a.start - b.start)[0];

  const maxRecordingDurationMs = Math.max(
    0,
    ((nextVoiceover ? nextVoiceover.start : videoDuration) - videoCurrentTime) *
      1000
  );

  useEffect(() => {
    return () => {
      try {
        Sound.stopRecorder();
        Sound.removeRecordBackListener();
      } catch {
        // Ignore cleanup errors
      }
    };
  }, []);

  // Additional cleanup when recording state changes
  useEffect(() => {
    if (!isRecording && !isVisible) {
      // Clean up listener when not recording and sheet is closed
      try {
        Sound.removeRecordBackListener();
      } catch {
        // Ignore cleanup errors
      }
    }
  }, [isRecording, isVisible]);

  useEffect(() => {
    if (isRecording) {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1.08, { duration: 600 }),
          withTiming(1, { duration: 600 })
        ),
        -1,
        true
      );
    } else {
      cancelAnimation(pulse);
      pulse.value = 1;
    }
  }, [isRecording, pulse]);

  useEffect(() => {
    setSheetIndex(isVisible ? 0 : -1);
  }, [isVisible]);

  const animatedOuter = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  const prepareRecorder = async () => {
    try {
      Sound.removeRecordBackListener();
      await Sound.stopRecorder();
    } catch {
      // ignore
    }
  };

  const requestAudioPermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          {
            title: 'Audio Recording Permission',
            message:
              'This app needs access to your microphone to record audio.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.warn('PermissionsAndroid.request error:', err);
        return false;
      }
    }
    return true;
  };

  const onStopRecord = useCallback(async () => {
    setIsStoppingRecord(true);
    try {
      const resultUri = await Sound.stopRecorder();
      Sound.removeRecordBackListener();
      setIsRecording(false);
      setRecordingDuration(recordTime);
      setRecordedAudioUri(resultUri);
    } catch {
      // handle error
    } finally {
      setIsStoppingRecord(false);
    }
  }, [recordTime]);

  const onStartRecord = useCallback(async () => {
    setIsStartingRecord(true);

    const hasPermission = await requestAudioPermission();
    if (!hasPermission) {
      Alert.alert('Permission Required', 'Microphone permission is required.');
      setIsStartingRecord(false);
      return;
    }

    setRecordedAudioUri(null);
    setRecordTime(0);

    try {
      await prepareRecorder();
      const makeRecordingPath = () => {
        const ext = deviceUtils.isAndroid ? 'mp3' : 'm4a';
        const fileName = `voiceover_${Date.now()}_${Math.floor(
          Math.random() * 10000
        )}.${ext}`;
        const basePath = deviceUtils.isAndroid
          ? RNFS.DocumentDirectoryPath
          : RNFS.CachesDirectoryPath;

        const fullPath = `${basePath}/${fileName}`;
        return deviceUtils.isIOS ? `file://${fullPath}` : fullPath;
      };

      const documentsDir = deviceUtils.isAndroid
        ? RNFS.DocumentDirectoryPath
        : RNFS.CachesDirectoryPath;
      const targetPath = deviceUtils.isAndroid
        ? makeRecordingPath()
        : undefined;

      try {
        const exists = await RNFS.exists(documentsDir);
        if (!exists) {
          await RNFS.mkdir(documentsDir);
        }
      } catch (e) {
        console.warn('RNFS dir check/mkdir failed', e);
      }

      const audioSet = {
        // Common settings
        AudioSamplingRate: 44100,
        AudioEncodingBitRate: 128000,
        AudioChannels: 2,

        // Android specific
        AudioEncoderAndroid: AudioEncoderAndroidType.AAC,
        AudioSourceAndroid: AudioSourceAndroidType.MIC,
        OutputFormatAndroid: OutputFormatAndroidType.AAC_ADTS,

        // iOS specific
        AVEncoderAudioQualityKeyIOS: AVEncoderAudioQualityIOSType.high,
        AVNumberOfChannelsKeyIOS: 2,
        AVFormatIDKeyIOS: 'aac',
      };

      let result;
      try {
        result = await Sound.startRecorder(targetPath, audioSet);
      } catch (pathError) {
        console.warn('Custom path failed, using library default:', pathError);
        result = await Sound.startRecorder(undefined, audioSet);
      }

      setRecordedAudioUri(result);
      setIsRecording(true);

      Sound.addRecordBackListener((e: any) => {
        if (e.currentPosition >= maxRecordingDurationMs) {
          setRecordTime(maxRecordingDurationMs);
          onStopRecord();
        } else {
          setRecordTime(e.currentPosition);
        }
      });
    } catch (error: any) {
      console.error('Recording failed:', error);
      Alert.alert(
        'Error',
        `Failed to start recording: ${error.message || 'Unknown error'}`
      );
      setIsRecording(false);
    } finally {
      setIsStartingRecord(false);
    }
  }, [maxRecordingDurationMs, onStopRecord]);

  const resetRecordingState = useCallback(() => {
    setRecordTime(0);
    setIsRecording(false);
    setRecordedAudioUri(null);
    setRecordingDuration(0);
    setIsStartingRecord(false);
    setIsStoppingRecord(false);
  }, []);

  const handleDone = useCallback(() => {
    const finalDuration =
      recordingDuration > 0
        ? recordingDuration
        : recordTime > 0
        ? recordTime
        : maxRecordingDurationMs;

    if (recordedAudioUri && finalDuration > 0) {
      const voiceoverData = {
        uri: recordedAudioUri,
        duration: finalDuration / 1000,
        start: videoCurrentTime,
      };

      onDone(voiceoverData);
      resetRecordingState();
      bottomSheetRef.current?.close();
    } else {
      Alert.alert('No Recording', 'Please record audio before proceeding.');
    }
  }, [
    recordedAudioUri,
    recordingDuration,
    recordTime,
    videoCurrentTime,
    maxRecordingDurationMs,
    onDone,
    resetRecordingState,
  ]);

  const handleToggleRecording = useCallback(async (): Promise<void> => {
    if (isStartingRecord || isStoppingRecord) {
      return;
    }

    if (isRecording) {
      await onStopRecord();
      setTimeout(() => {
        if (recordedAudioUri || recordTime > 0) {
          handleDone();
        }
      }, 100);
      return;
    } else {
      await onStartRecord();
      return;
    }
  }, [
    isStartingRecord,
    isStoppingRecord,
    isRecording,
    onStartRecord,
    onStopRecord,
    recordedAudioUri,
    recordTime,
    handleDone,
  ]);

  const formatTime = useCallback((timeInMillis: number) => {
    const totalSeconds = Math.floor(timeInMillis / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, []);

  const handleCancel = useCallback(() => {
    if (isRecording) {
      Sound.stopRecorder();
      Sound.removeRecordBackListener();
    }
    resetRecordingState();
    bottomSheetRef.current?.close();
    setTimeout(() => {
      onClose();
    }, 500);
  }, [isRecording, resetRecordingState, onClose]);

  const handleRequestClose = useCallback(() => {
    bottomSheetRef.current?.close();
  }, []);

  useEffect(() => {
    if (isVisible) {
      resetRecordingState();
    }
  }, [isVisible, resetRecordingState]);

  const canRecord = maxRecordingDurationMs > 0;

  // Check if dependencies are available - must be after all hooks
  if (!Sound || !RNFS) {
    if (isVisible) {
      Alert.alert(
        'Dependencies Missing',
        'Voice recording requires react-native-nitro-sound and react-native-fs to be installed and linked. Please install these dependencies and rebuild your app.'
      );
      onClose();
    }
    return null;
  }

  const snapPoints = deviceUtils.isAndroid
    ? ['34%']
    : deviceUtils.isSmallIphone()
    ? ['41%']
    : ['38%'];

  return (
    <CustomBottomSheet
      ref={bottomSheetRef}
      snapPoints={snapPoints}
      title="Record Voiceover"
      isSheetOpen={sheetIndex}
      setIsSheetOpen={setSheetIndex}
      onClose={handleCancel}
    >
      <View style={styles.content}>
        {/* Recording Info */}
        <View style={styles.recordingInfo}>
          <Text style={styles.videoTimeText}>
            Voiceover will start at: {formatTime(videoCurrentTime * 1000)}
          </Text>
        </View>

        {/* Recording Button */}
        <PressableWrapper
          style={[
            styles.recordButtonContainer,
            !canRecord && styles.disabledRecordButton,
          ]}
          onPress={handleToggleRecording}
          disabled={!canRecord || isStartingRecord || isStoppingRecord}
        >
          <Animated.View
            style={[
              styles.recordButtonOuter,
              isRecording && styles.recordButtonOuterRecording,
              isRecording && animatedOuter,
            ]}
          />

          {isStartingRecord || isStoppingRecord ? (
            <ActivityIndicator size="large" color="#FF3040" />
          ) : (
            <Animated.View
              style={[
                styles.recordButtonInner,
                isRecording && styles.recordButtonInnerSquare,
              ]}
            />
          )}
        </PressableWrapper>

        {/* Timer */}
        <View style={styles.timerContainer}>
          <Text style={styles.remainingTimeText}>
            {formatTime(recordTime)} / {formatTime(maxRecordingDurationMs)}
          </Text>
        </View>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <PressableWrapper
          style={styles.footerButton}
          onPress={handleRequestClose}
        >
          <Text style={styles.footerButtonText}>Cancel</Text>
        </PressableWrapper>
        <Text style={styles.footerTitle}>Voiceover</Text>
        <PressableWrapper
          style={styles.footerButton}
          onPress={handleDone}
          disabled={!recordedAudioUri}
        >
          <Text
            style={[
              styles.doneButtonText,
              (!recordedAudioUri || isRecording) && styles.disabledButton,
            ]}
          >
            Done
          </Text>
        </PressableWrapper>
      </View>
    </CustomBottomSheet>
  );
};
