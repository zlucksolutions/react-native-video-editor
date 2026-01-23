import React from 'react';
import { View, Text, Pressable } from 'react-native';
// @ts-ignore - Peer dependency
import { ScaledSheet } from 'react-native-size-matters';
import { COLORS } from '../../constants/colors';
import { Image } from 'react-native';
// @ts-ignore - Peer dependency
import { PauseFilledIcon, PlayFilledIcon } from '../../assets/icons/index.js';

interface TimelineHeaderProps {
  currentTime: number;
  videoDuration: number;
  isPlaying: boolean;
  isTrimming: boolean;
  onTogglePlayback: () => void;
  onConfirmTrim?: () => void;
  onCancelTrim?: () => void;
  onCloseTimeline: () => void;
}

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const TimelineHeader: React.FC<TimelineHeaderProps> = ({
  currentTime,
  videoDuration,
  isPlaying,
  isTrimming,
  onTogglePlayback,
  onConfirmTrim,
  onCancelTrim,
  onCloseTimeline,
}) => {
  return (
    <View style={styles.container}>
      <Pressable onPress={onTogglePlayback} style={styles.playPauseButton}>
        <Image
          style={styles.playPauseIcon}
          source={isPlaying ? PauseFilledIcon : PlayFilledIcon}
          tintColor="#fff"
        />
      </Pressable>

      <Text style={styles.durationText}>
        {formatTime(currentTime)}
        <Text style={styles.durationSeparator}> / </Text>
        {formatTime(videoDuration)}
      </Text>
      {isTrimming ? (
        <View style={styles.trimActionsContainer}>
          <Pressable onPress={onCancelTrim} style={styles.trimButtonSmall}>
            <Text style={styles.trimButtonText}>✕</Text>
          </Pressable>
          <Pressable onPress={onConfirmTrim} style={styles.trimButtonSmall}>
            <Text
              style={[styles.trimButtonText, { color: COLORS.PRIMARY_YELLOW }]}
            >
              ✓
            </Text>
          </Pressable>
        </View>
      ) : (
        <Pressable onPress={onCloseTimeline} style={styles.collapseButton}>
          <Text style={styles.collapseIcon}>✕</Text>
        </Pressable>
      )}
    </View>
  );
};

const styles = ScaledSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: '16@ms',
    marginBottom: '8@ms',
    backgroundColor: 'transparent',
  },
  playPauseButton: {
    width: '32@ms',
    height: '32@ms',
    borderRadius: '16@ms',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playPauseIcon: {
    width: '12@ms',
    height: '12@ms',
    tintColor: '#fff',
    resizeMode: 'contain',
  },
  durationText: {
    fontSize: '13@ms',
    color: '#fff',
    fontWeight: '600',
    letterSpacing: '0.5@ms',
  },
  durationSeparator: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontWeight: '400',
  },
  trimActionsContainer: {
    flexDirection: 'row',
    gap: '8@ms',
  },
  trimButtonSmall: {
    width: '32@ms',
    height: '32@ms',
    borderRadius: '16@ms',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trimButtonText: {
    fontSize: '16@ms',
    color: '#fff',
    fontWeight: '600',
  },
  collapseButton: {
    width: '32@ms',
    height: '32@ms',
    borderRadius: '16@ms',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  collapseIcon: {
    fontSize: '14@ms',
    color: '#fff',
    fontWeight: '500',
  },
});
