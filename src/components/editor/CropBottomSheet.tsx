import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Platform,
  Pressable as RNPressable,
} from 'react-native';
// @ts-ignore - Peer dependency
import { Pressable as GHPressable } from 'react-native-gesture-handler';
// @ts-ignore - Peer dependency
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import { useEditorContext } from '../../context/EditorContext';
import { useEditorState } from '../../context/EditorStateContext';
import { createCropBottomSheetStyles } from './CropBottomSheetStyles';

type AspectRatio = {
  label: string;
  value: 'original' | '9:16' | '1:1' | '16:9';
};

const aspectRatios: AspectRatio[] = [
  { label: 'Original', value: 'original' },
  { label: '9:16', value: '9:16' },
  { label: '1:1', value: '1:1' },
  { label: '16:9', value: '16:9' },
];

const RNPressable2 = Platform.OS === 'ios' ? TouchableOpacity : GHPressable;

type AspectRatioIconProps = {
  label: string;
  isSelected: boolean;
  styles: ReturnType<typeof createCropBottomSheetStyles>;
};

const AspectRatioIcon: React.FC<AspectRatioIconProps> = ({
  label,
  isSelected,
  styles,
}) => {
  const isOriginal = label === 'Original';

  if (isOriginal) {
    return (
      <View
        style={isSelected ? styles.selectedIconContainer : styles.iconContainer}
      >
        <View style={[styles.iconBox, isSelected && styles.selectedIconBox]}>
          <View
            style={[
              {
                width: 24,
                height: 24,
                borderRadius: 4,
                borderWidth: 1.5,
                borderColor: isSelected ? '#00ff88' : '#bebebe',
                backgroundColor: isSelected ? '#00ff88' : 'transparent',
              },
            ]}
          />
        </View>
      </View>
    );
  }

  const shapeKey = `shape_${label.replace(':', '_')}` as
    | 'shape_9_16'
    | 'shape_1_1'
    | 'shape_16_9';

  return (
    <View
      style={isSelected ? styles.selectedIconContainer : styles.iconContainer}
    >
      <View style={[styles.iconBox, isSelected && styles.selectedIconBox]}>
        <View
          style={[
            styles.aspectRatioShape,
            styles[shapeKey],
            isSelected && styles.selectedShape,
          ]}
        />
      </View>
    </View>
  );
};

export const CropBottomSheet: React.FC = () => {
  const { activeTool, setActiveTool } = useEditorContext();
  const { cropRatio, setCropRatio } = useEditorState();
  const styles = createCropBottomSheetStyles();

  if (activeTool !== 'crop') return null;

  const handleRatioSelect = (ratio: AspectRatio) => {
    setCropRatio(ratio.value);
  };

  const handleClose = () => {
    setActiveTool(null);
  };

  return (
    <>
      {/* Backdrop */}
      <Animated.View entering={FadeIn.duration(200)} style={styles.backdrop}>
        <RNPressable onPress={handleClose} style={styles.backdropTouchable} />
      </Animated.View>

      {/* Bottom Sheet */}
      <Animated.View
        entering={SlideInDown.duration(300).damping(20)}
        style={styles.sheetContainer}
      >
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Choose an aspect ratio</Text>
            <RNPressable onPress={handleClose} style={styles.closeButton}>
              <Text style={styles.closeText}>✕</Text>
            </RNPressable>
          </View>

          <View style={styles.optionsContainer}>
            {aspectRatios.map((ratio) => {
              const isSelected = cropRatio === ratio.value;
              return (
                <RNPressable2
                  key={ratio.value}
                  style={styles.optionButton}
                  onPress={() => handleRatioSelect(ratio)}
                  activeOpacity={0.7}
                >
                  <AspectRatioIcon
                    label={ratio.label}
                    isSelected={isSelected}
                    styles={styles}
                  />
                  <Text
                    style={[
                      styles.optionText,
                      isSelected && styles.selectedOptionText,
                    ]}
                  >
                    {ratio.label}
                  </Text>
                </RNPressable2>
              );
            })}
          </View>
        </View>
      </Animated.View>
    </>
  );
};
