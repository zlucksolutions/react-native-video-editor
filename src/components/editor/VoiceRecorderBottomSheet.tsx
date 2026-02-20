import React, {
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
} from 'react';
import {
  View,
  Text,
  Pressable,
  Platform,
  Alert,
  ActivityIndicator,
  PermissionsAndroid,
  // @ts-ignore - Peer dependency
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
import { useFontFamily } from '../../context/FontFamilyContext';
import AudioRecorderPlayer, {
  AudioEncoderAndroidType,
  AudioSourceAndroidType,
  AVEncoderAudioQualityIOSType,
  AVEncodingOption,
  OutputFormatAndroidType,
  // @ts-ignore - Peer dependency
} from 'react-native-audio-recorder-player';
// @ts-ignore - Peer dependency
import RNFS from 'react-native-fs';

const styles = StyleFunction();
interface VoiceRecorderBottomSheetProps {
  isVisible: boolean;
  onClose: () => void;
  onDone: (voiceoverData: {
    uri: string;
    duration: number;
    start: number;
    type: string;
    id: string;
    name?: string;
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

export const VoiceRecorderBottomSheet: React.FC<VoiceRecorderBottomSheetProps> =
  React.memo(
    ({
      isVisible,
      onClose,
      onDone,
      videoCurrentTime,
      videoDuration,
      voiceoverSegments = [],
    }) => {
      // All hooks must be called before any early returns
      const pulse = useSharedValue(1);
      const { fontStyle } = useFontFamily();

      const [isRecording, setIsRecording] = useState(false);
      const [recordTime, setRecordTime] = useState(0);
      const [recordedAudioUri, setRecordedAudioUri] = useState<string | null>(
        null
      );
      const [recordingDuration, setRecordingDuration] = useState(0);
      const [isStartingRecord, setIsStartingRecord] = useState(false);
      const [isStoppingRecord, setIsStoppingRecord] = useState(false);
      const [sheetIndex, setSheetIndex] = useState(isVisible ? 0 : -1);

      const bottomSheetRef = useRef<BottomSheet>(null);
      const audioRecorderPlayerRef = useRef<AudioRecorderPlayer>(
        new AudioRecorderPlayer()
      );
      const audioRecorderPlayer = audioRecorderPlayerRef.current;

      // Calculate max recording duration based on next voiceover or video end
      const nextVoiceover = useMemo(() => {
        return voiceoverSegments
          .filter((seg) => seg.start > videoCurrentTime)
          .sort((a, b) => a.start - b.start)[0];
      }, [voiceoverSegments, videoCurrentTime]);

      const maxRecordingDurationMs = Math.max(
        0,
        ((nextVoiceover ? nextVoiceover.start : videoDuration) -
          videoCurrentTime) *
          1000
      );

      const canRecord = maxRecordingDurationMs > 0;

      useEffect(() => {
        return () => {
          if (audioRecorderPlayer) {
            audioRecorderPlayer.stopRecorder();
            audioRecorderPlayer.removeRecordBackListener();
          }
        };
      }, [audioRecorderPlayer]);

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

      useEffect(() => {
        if (!isRecording && !isVisible) {
          try {
            audioRecorderPlayer.removeRecordBackListener();
          } catch {
            // Ignore cleanup errors
          }
        }
      }, [isRecording, isVisible, audioRecorderPlayer]);

      const animatedOuter = useAnimatedStyle(() => ({
        transform: [{ scale: pulse.value }],
      }));

      const prepareRecorder = useCallback(async () => {
        try {
          await audioRecorderPlayer.stopRecorder();
          audioRecorderPlayer.removeRecordBackListener();
        } catch {
          // ignore — usually "already stopped" errors
        }
      }, [audioRecorderPlayer]);

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

      const formatTime = useCallback((timeInMillis: number) => {
        const totalSeconds = Math.floor(timeInMillis / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
      }, []);

      const resetRecordingState = useCallback(async () => {
        // Clean up any existing listeners
        try {
          audioRecorderPlayer.removeRecordBackListener();
        } catch {
          // Ignore - may not have a listener attached
        }

        setRecordTime(0);
        setIsRecording(false);
        setRecordedAudioUri(null);
        setRecordingDuration(0);
        setIsStartingRecord(false);
        setIsStoppingRecord(false);
      }, [audioRecorderPlayer]);

      useEffect(() => {
        if (isVisible) {
          resetRecordingState();
        }
      }, [isVisible, resetRecordingState]);

      const onStopRecord = useCallback(async () => {
        setIsStoppingRecord(true);
        try {
          const resultUri = await audioRecorderPlayer.stopRecorder();
          audioRecorderPlayer.removeRecordBackListener();
          setIsRecording(false);
          setRecordingDuration(recordTime);
          setRecordedAudioUri(resultUri);
        } catch (error) {
          setRecordedAudioUri(null);
          setRecordingDuration(0);
          Alert.alert(
            'Recording Error',
            `Failed to stop recording: ${error || 'Unknown error'}.`
          );
        } finally {
          setIsStoppingRecord(false);
        }
      }, [audioRecorderPlayer, recordTime]);

      const onStartRecord = useCallback(async () => {
        setIsStartingRecord(true);

        const hasPermission = await requestAudioPermission();
        if (!hasPermission) {
          Alert.alert(
            'Permission Required',
            'Microphone permission is required.'
          );
          setIsStartingRecord(false);
          return;
        }

        setRecordedAudioUri(null);
        setRecordingDuration(0);
        setRecordTime(0);

        const audioSet = {
          AudioEncoderAndroid: AudioEncoderAndroidType.AAC,
          AudioSourceAndroid: AudioSourceAndroidType.MIC,
          OutputFormatAndroid: OutputFormatAndroidType.AAC_ADTS,
          AVEncoderAudioQualityKeyIOS: AVEncoderAudioQualityIOSType.high,
          AVNumberOfChannelsKeyIOS: 2,
          AVFormatIDKeyIOS: AVEncodingOption.aac,
        };

        try {
          await prepareRecorder();
          await new Promise((resolve) => setTimeout(resolve, 100));

          // Set subscription duration for Android to ensure progress updates
          // This ensures recordTime updates properly during recording on Android
          audioRecorderPlayer.setSubscriptionDuration(0.1);

          // Attach listener BEFORE starting recorder to ensure it receives all updates
          audioRecorderPlayer.addRecordBackListener((e: any) => {
            if (e.currentPosition >= maxRecordingDurationMs) {
              setRecordTime(maxRecordingDurationMs);
              onStopRecord();
            } else {
              setRecordTime(e.currentPosition);
            }
          });

          // Determine base path (OS-provided directories always exist)
          const basePath = deviceUtils.isAndroid
            ? RNFS.DocumentDirectoryPath
            : RNFS.CachesDirectoryPath;

          // Generate unique filename
          const ext = deviceUtils.isAndroid ? 'mp3' : 'm4a';
          const fileName = `voiceover_${Date.now()}_${Math.floor(
            Math.random() * 10000
          )}.${ext}`;

          // Create full path with proper format for each platform
          const fullPath = `${basePath}/${fileName}`;
          const targetPath = deviceUtils.isIOS
            ? `file://${fullPath}`
            : fullPath;

          console.log('[VoiceRecorder] Recording path:', targetPath);

          const result = await audioRecorderPlayer.startRecorder(
            targetPath,
            audioSet
          );

          setRecordedAudioUri(result);
          setIsRecording(true);
        } catch (error: any) {
          Alert.alert(
            'Error',
            `Failed to start recording: ${error.message || 'Unknown error'}`
          );
          setIsRecording(false);
          setRecordTime(0);
        } finally {
          setIsStartingRecord(false);
        }
      }, [
        audioRecorderPlayer,
        maxRecordingDurationMs,
        onStopRecord,
        prepareRecorder,
      ]);

      const handleDone = useCallback(async () => {
        const finalDuration =
          recordingDuration > 0
            ? recordingDuration
            : recordTime > 0
            ? recordTime
            : maxRecordingDurationMs;

        if (recordedAudioUri && finalDuration > 0) {
          // Ensure recording is fully stopped before proceeding
          if (isRecording) {
            try {
              await audioRecorderPlayer.stopRecorder();
              audioRecorderPlayer.removeRecordBackListener();
              setIsRecording(false);
            } catch (error) {
              console.warn(
                '[VoiceRecorder] Error stopping recorder in handleDone:',
                error
              );
            }
          }

          const filename = recordedAudioUri.split('/').pop();
          const voiceoverData = {
            uri: recordedAudioUri,
            duration: finalDuration / 1000,
            start: videoCurrentTime,
            type: 'voiceover',
            id: `voiceover-${Date.now()}`,
            name: filename,
          };

          onDone(voiceoverData);
          await resetRecordingState();
          onClose();
        } else {
          Alert.alert('No Recording', 'Please record audio before proceeding.');
        }
      }, [
        recordedAudioUri,
        recordingDuration,
        recordTime,
        videoCurrentTime,
        maxRecordingDurationMs,
        isRecording,
        audioRecorderPlayer,
        onDone,
        resetRecordingState,
        onClose,
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

      const handleCancel = useCallback(async () => {
        if (isRecording) {
          try {
            await audioRecorderPlayer.stopRecorder();
            audioRecorderPlayer.removeRecordBackListener();
          } catch (error) {
            console.warn(
              '[VoiceRecorder] Error stopping recorder in handleCancel:',
              error
            );
          }
        }
        await resetRecordingState();
        onClose();
      }, [isRecording, audioRecorderPlayer, resetRecordingState, onClose]);

      const handleRequestClose = useCallback(() => {
        bottomSheetRef.current?.close();
      }, []);

      // Check if dependencies are available - must be after all hooks
      if (!audioRecorderPlayer || !RNFS) {
        if (isVisible) {
          Alert.alert(
            'Dependencies Missing',
            'Voice recording requires react-native-audio-recorder-player and react-native-fs to be installed and linked. Please install these dependencies and rebuild your app.'
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
              <Text style={[styles.videoTimeText, fontStyle]}>
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
              <Text style={[styles.remainingTimeText, fontStyle]}>
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
              <Text style={[styles.footerButtonText, fontStyle]}>Cancel</Text>
            </PressableWrapper>
            <Text style={[styles.footerTitle, fontStyle]}>Voiceover</Text>
            <PressableWrapper
              style={styles.footerButton}
              onPress={handleDone}
              disabled={!recordedAudioUri}
            >
              <Text
                style={[
                  styles.doneButtonText,
                  (!recordedAudioUri || isRecording) && styles.disabledButton,
                  fontStyle,
                ]}
              >
                Done
              </Text>
            </PressableWrapper>
          </View>
        </CustomBottomSheet>
      );
    }
  );
