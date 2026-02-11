import React from 'react';
// @ts-ignore - Peer dependency
import { Platform, requireNativeComponent, type ViewStyle } from 'react-native';

interface NativeWaveformViewProps {
  audioSource: string;
  progress: number;
  style?: ViewStyle;
  waveWidth?: number;
  waveGap?: number;
  waveBackgroundColor?: string;
  waveProgressColor?: string;
}

// iOS Native Component
// React Native automatically prefixes with "RCT" for view managers
const NativeWaveformViewIOS =
  requireNativeComponent<NativeWaveformViewProps>('WaveformView');

export const NativeWaveformView: React.FC<NativeWaveformViewProps> = (
  props
) => {
  if (Platform.OS === 'ios') {
    return (
      <NativeWaveformViewIOS
        audioSource={props.audioSource}
        progress={props.progress}
        style={props.style}
        waveWidth={props.waveWidth}
        waveGap={props.waveGap}
        waveBackgroundColor={props.waveBackgroundColor}
        waveProgressColor={props.waveProgressColor}
      />
    );
  }
  // } else {
  //   // Use existing Android library
  //   return (
  //     <AudioWaveView
  //       audioSource={props.audioSource}
  //       progress={props.progress}
  //       style={props.style}
  //       waveWidth={props.waveWidth}
  //       waveGap={props.waveGap}
  //       waveBackgroundColor={props.waveBackgroundColor}
  //       waveProgressColor={props.waveProgressColor}
  //     />
  //   );
  // }
  return null;
};
