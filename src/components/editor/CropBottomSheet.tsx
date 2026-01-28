import React, {
  useMemo,
  useEffect,
  useState,
  useCallback,
  useRef,
} from 'react';
import { View, Text, TouchableOpacity, Platform } from 'react-native';
// @ts-ignore - Peer dependency
import { Pressable as GHPressable } from 'react-native-gesture-handler';
import { useEditorContext } from '../../context/EditorContext';
import { useEditorState } from '../../context/EditorStateContext';
import { createCropBottomSheetStyles } from './CropBottomSheetStyles';
import { CustomBottomSheet } from './CustomBottomSheet';
// @ts-ignore - Peer dependency
import type BottomSheet from '@gorhom/bottom-sheet';
import { deviceUtils } from '../../utils/deviceUtils';

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

  const originalIconBoxStyle = useMemo(
    () => [
      styles.originalIconBox,
      isSelected
        ? styles.originalIconBoxSelected
        : styles.originalIconBoxUnselected,
    ],
    [isSelected, styles]
  );

  if (isOriginal) {
    return (
      <View
        style={isSelected ? styles.selectedIconContainer : styles.iconContainer}
      >
        <View style={[styles.iconBox, isSelected && styles.selectedIconBox]}>
          <View style={originalIconBoxStyle} />
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
  const [sheetIndex, setSheetIndex] = useState(-1);
  const bottomSheetRef = useRef<BottomSheet>(null);

  useEffect(() => {
    setSheetIndex(activeTool === 'crop' ? 0 : -1);
  }, [activeTool]);

  const handleRatioSelect = (ratio: AspectRatio) => {
    setCropRatio(ratio.value);
  };

  const handleRequestClose = useCallback(() => {
    bottomSheetRef.current?.close();
  }, []);

  const handleClose = useCallback(() => {
    handleRequestClose();
    setTimeout(() => {
      setActiveTool(null);
    }, 400);
  }, [setActiveTool, handleRequestClose]);

  const snapPoints = deviceUtils.isAndroid
    ? ['25%']
    : deviceUtils.isSmallIphone()
    ? ['30%']
    : ['28%'];

  return (
    <CustomBottomSheet
      ref={bottomSheetRef}
      snapPoints={snapPoints}
      title="Choose an aspect ratio"
      isSheetOpen={sheetIndex}
      setIsSheetOpen={setSheetIndex}
      onClose={handleClose}
      sheetContentStyle={styles.sheetContent}
    >
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
    </CustomBottomSheet>
  );
};
