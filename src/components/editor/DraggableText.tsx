import React, { useEffect, useState } from 'react';
// @ts-ignore - Peer dependency
import { StyleSheet, Dimensions, Platform, Text as RNText } from 'react-native';
// @ts-ignore - Peer dependency
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useDerivedValue,
  runOnJS,
  withSpring,
  interpolate,
  createAnimatedComponent,
  // @ts-ignore - Peer dependency
} from 'react-native-reanimated';
import type { TextSegment } from '../../types/segments';
import {
  FONT_SIZE_MIN,
  FONT_SIZE_MAX,
  PREVIEW_WIDTH,
  SMALL_PREVIEW_WIDTH,
} from '../../constants/dimensions';

// Create animated text component
const AnimatedText = createAnimatedComponent(RNText);
const { height: SCREEN_HEIGHT } = Dimensions.get('window');

type DraggableTextProps = {
  element: TextSegment;
  onDragStateChange: (isDragging: boolean) => void;
  onUpdatePosition: (id: string, position: { x: number; y: number }) => void;
  onDelete: (id: string) => void;
  onPress: (element: TextSegment) => void;
  containerSize: { width: number; height: number };
  isDraggable: boolean;
  onUpdateFontSize: (id: string, fontSize: number) => void;
  onPinchStateChange: (isPinching: boolean) => void;
  layoutAnimation: Animated.SharedValue<number>;
  pinchActive: Animated.SharedValue<number>;
  isVisible?: boolean;
  minFontSize?: number;
  maxFontSize?: number;
};

export const DraggableText: React.FC<DraggableTextProps> = ({
  element,
  onDragStateChange,
  onUpdatePosition,
  onDelete,
  onPress,
  containerSize,
  isDraggable,
  onUpdateFontSize,
  onPinchStateChange,
  pinchActive,
  layoutAnimation,
  isVisible = true,
  minFontSize = FONT_SIZE_MIN,
  maxFontSize = FONT_SIZE_MAX,
}) => {
  const x = useSharedValue(element.x || 0);
  const y = useSharedValue(element.y || 0);
  const currentScale = useSharedValue(1);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const fontSize = useSharedValue(element.fontSize || 26);
  const startFontSize = useSharedValue(element.fontSize || 26);
  const hapticTriggered = useSharedValue(false);

  const [textLayout, setTextLayout] = useState({ width: 0, height: 0 });
  const [originalTextWidth, setOriginalTextWidth] = useState(0);
  const [isCentered, setIsCentered] = useState(false);
  const DELETE_ZONE_Y = SCREEN_HEIGHT - 200;

  const previewScale = useDerivedValue(() => {
    return interpolate(
      layoutAnimation.value,
      [0, 1],
      [1, SMALL_PREVIEW_WIDTH / PREVIEW_WIDTH]
    );
  });

  const [isPinchJustFinished, setIsPinchJustFinished] = useState(false);
  const isPinchJustFinishedSV = useSharedValue(false);

  useEffect(() => {
    isPinchJustFinishedSV.value = isPinchJustFinished;
  }, [isPinchJustFinished, isPinchJustFinishedSV]);

  useEffect(() => {
    if (element.fontSize) {
      fontSize.value = element.fontSize;
    }
  }, [element.fontSize, fontSize]);

  const triggerHaptic = () => {
    try {
      if (Platform.OS === 'ios') {
        const hapticModule = (global as any)?.HapticFeedback;
        if (hapticModule && typeof hapticModule === 'function') {
          hapticModule('impactMedium');
        }
      }
    } catch {
      // Haptic feedback not available, ignore
    }
  };

  const tapGesture = Gesture.Tap().onEnd(() => {
    if (isDraggable) {
      runOnJS(onPress)(element);
    }
  });

  const dragGesture = Gesture.Pan()
    .minPointers(1)
    .maxPointers(1)
    .enabled(isDraggable)
    .onStart(() => {
      startX.value = x.value;
      startY.value = y.value;
      currentScale.value = withSpring(1.2);
      runOnJS(onDragStateChange)(true);
      hapticTriggered.value = false;
    })
    .onUpdate((event: any) => {
      const scaleFactor = previewScale.value;
      let newX = startX.value + event.translationX / scaleFactor;
      let newY = startY.value + event.translationY / scaleFactor;

      // Clamp coordinates within full-size container bounds
      // Relax maxY during dragging so user can reach the trash icon
      const maxX = Math.max(0, containerSize.width - textLayout.width);

      x.value = Math.max(0, Math.min(maxX, newX));
      y.value = Math.max(0, newY); // Allow dragging below the bottom

      // Only check delete zone when actually dragging down significantly
      // AND the absolute Y position is in the delete zone
      if (event.absoluteY > DELETE_ZONE_Y && event.translationY > 20) {
        if (!hapticTriggered.value) {
          runOnJS(triggerHaptic)();
          hapticTriggered.value = true;
          currentScale.value = withSpring(0.8);
        }
      } else {
        if (hapticTriggered.value) {
          hapticTriggered.value = false;
          currentScale.value = withSpring(1.2);
        }
      }
    })
    .onEnd((event: any) => {
      currentScale.value = withSpring(1);
      runOnJS(onDragStateChange)(false);

      // Only delete if dragged significantly down AND in delete zone
      if (event.absoluteY > DELETE_ZONE_Y && event.translationY > 20) {
        runOnJS(onDelete)(element.id);
      } else {
        // Enforce clamping back within bounds on release
        const maxX = Math.max(0, containerSize.width - textLayout.width);
        const maxY = Math.max(0, containerSize.height - textLayout.height);
        x.value = withSpring(Math.max(0, Math.min(maxX, x.value)));
        y.value = withSpring(Math.max(0, Math.min(maxY, y.value)));

        runOnJS(onUpdatePosition)(element.id, { x: x.value, y: y.value });
      }
    });

  const pinchGesture = Gesture.Pinch()
    .enabled(isDraggable)
    .onStart(() => {
      'worklet';
      startFontSize.value = fontSize.value;
      if (onPinchStateChange) {
        runOnJS(onPinchStateChange)(true);
      }
    })
    .onUpdate((event: any) => {
      const newSize = startFontSize.value * event.scale;
      fontSize.value = Math.max(minFontSize, Math.min(maxFontSize, newSize));
    })
    .onEnd(() => {
      if (onUpdateFontSize) {
        runOnJS(onUpdateFontSize)(element.id, fontSize.value);
      }
      runOnJS(setIsPinchJustFinished)(true);
    })
    .onFinalize(() => {
      'worklet';
      if (onPinchStateChange) {
        runOnJS(onPinchStateChange)(false);
      }
    });

  const composedGesture = Gesture.Simultaneous(
    dragGesture,
    pinchGesture,
    tapGesture
  );

  const elementWidth = useSharedValue(0);
  const elementHeight = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => {
    // Scale factor based on layout animation (0 = full size, 1 = small size)
    const s = previewScale.value;

    // Scale text position proportionally
    const scaledX = x.value * s;
    const scaledY = y.value * s;

    // Compensation for center-origin scaling to maintain Top-Left anchor
    // Visual Shift = (Size * (1 - s)) / 2
    // We subtract this shift to keep the Top-Left corner at (scaledX, scaledY)
    const offsetX = (elementWidth.value * (1 - s)) / 2;
    const offsetY = (elementHeight.value * (1 - s)) / 2;

    return {
      position: 'absolute',
      transform: [
        { translateX: scaledX - offsetX },
        { translateY: scaledY - offsetY },
        { scale: currentScale.value * s },
      ],
      zIndex: 100,
      opacity: isVisible ? 1 : 0,
      pointerEvents: isVisible ? 'auto' : 'none',
    };
  });

  const animatedContainerStyle = useAnimatedStyle(() => {
    if (pinchActive.value === 1 || isPinchJustFinishedSV.value) {
      return {
        width: 'auto',
      };
    }

    return {
      width: originalTextWidth > 0 ? originalTextWidth + 18 : 'auto',
    };
  });

  const animatedTextStyle = useAnimatedStyle(() => {
    return {
      fontSize: fontSize.value,
    };
  });

  useEffect(() => {
    if (
      textLayout.width > 0 &&
      textLayout.height > 0 &&
      !isCentered &&
      (element.x === undefined || element.x === 0) &&
      (element.y === undefined || element.y === 0)
    ) {
      const centerX = Math.max(0, (containerSize.width - textLayout.width) / 2);
      const centerY = Math.max(
        0,
        (containerSize.height - textLayout.height) / 2
      );
      x.value = centerX;
      y.value = centerY;
      setIsCentered(true);
      if (onUpdatePosition) {
        onUpdatePosition(element.id, { x: centerX, y: centerY });
      }
    } else if (
      element.x !== undefined &&
      element.y !== undefined &&
      element.x !== 0 &&
      element.y !== 0 &&
      !isCentered
    ) {
      // Use existing position if available
      x.value = element.x;
      y.value = element.y;
      setIsCentered(true);
    }
  }, [
    textLayout,
    containerSize,
    isCentered,
    element.x,
    element.y,
    x,
    y,
    onUpdatePosition,
    element.id,
  ]);

  return (
    <GestureDetector gesture={composedGesture}>
      <Animated.View
        style={animatedStyle}
        onLayout={(event: any) => {
          const { width, height } = event.nativeEvent.layout;
          if (width > 0 && height > 0) {
            setTextLayout({ width, height });
            elementWidth.value = width;
            elementHeight.value = height;

            if (originalTextWidth === 0 || isPinchJustFinished) {
              setOriginalTextWidth(width);
              if (isPinchJustFinished) {
                setIsPinchJustFinished(false);
              }
            }
          }
        }}
      >
        <Animated.View style={[styles.backgroundView, animatedContainerStyle]}>
          <AnimatedText
            style={[
              styles.textElement,
              {
                color: element.color,
                backgroundColor: element.backgroundColor || 'transparent',
                fontFamily: element.fontFamily,
              },
              animatedTextStyle,
            ]}
          >
            {element.text}
          </AnimatedText>
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
};

const styles = StyleSheet.create({
  backgroundView: {
    borderRadius: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignSelf: 'flex-start',
  },
  textElement: {
    fontWeight: 'bold',
    textAlign: 'center',
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: 8,
  },
});
