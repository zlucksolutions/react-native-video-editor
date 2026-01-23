import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Keyboard,
  Platform,
} from 'react-native';
// @ts-ignore - Peer dependency
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  GestureDetector,
  Gesture,
  Pressable as GHPressable,
  ScrollView as GHScrollView,
  // @ts-ignore - Peer dependency
} from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  runOnJS,
  withTiming,
  // @ts-ignore - Peer dependency
} from 'react-native-reanimated';
import { FONT_SIZE_MIN, FONT_SIZE_MAX } from '../../constants/dimensions';
import { createTextEditorStyles } from './TextEditorStyles';
import type { TextSegment } from '../../types/segments';

// Window dimensions removed as centering now uses PREVIEW area constants

const hiddenInputStyle = {
  position: 'absolute' as const,
  top: -100,
  width: 0,
  height: 0,
  opacity: 0,
  color: 'transparent',
};

type FontSizeSliderProps = {
  fontSize: number;
  onFontSizeChange: (size: number) => void;
};

const FontSizeSlider: React.FC<FontSizeSliderProps> = ({
  fontSize,
  onFontSizeChange,
}) => {
  const sliderHeight = 150;
  const minFontSize = FONT_SIZE_MIN;
  const maxFontSize = FONT_SIZE_MAX;
  const styles = createTextEditorStyles();

  const initialY =
    sliderHeight -
    ((fontSize - minFontSize) / (maxFontSize - minFontSize)) * sliderHeight;
  const sliderY = useSharedValue(initialY);
  const startY = useSharedValue(0);
  const labelOpacity = useSharedValue(0);

  useEffect(() => {
    const newY =
      sliderHeight -
      ((fontSize - minFontSize) / (maxFontSize - minFontSize)) * sliderHeight;
    sliderY.value = withTiming(newY);
  }, [fontSize, sliderY, minFontSize, maxFontSize]);

  const sliderGesture = Gesture.Pan()
    .onStart(() => {
      startY.value = sliderY.value;
      labelOpacity.value = withTiming(1);
    })
    .onUpdate((event: any) => {
      const newY = Math.max(
        0,
        Math.min(sliderHeight, startY.value + event.translationY)
      );
      sliderY.value = newY;
      const percentage = 1 - newY / sliderHeight;
      const newFontSize =
        minFontSize + percentage * (maxFontSize - minFontSize);
      runOnJS(onFontSizeChange)(Math.round(newFontSize));
    })
    .onEnd(() => {
      labelOpacity.value = withTiming(0);
    });

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sliderY.value }],
  }));
  const fontSizeIndicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sliderY.value }],
  }));
  const labelAnimatedStyle = useAnimatedStyle(() => ({
    opacity: labelOpacity.value,
  }));

  return (
    <View style={styles.slider}>
      <Animated.View style={labelAnimatedStyle}>
        <Text style={styles.sliderLabel}>{maxFontSize}</Text>
      </Animated.View>
      <View style={styles.sliderContainer}>
        <View style={[styles.sliderTrack, { height: sliderHeight }]}>
          <GestureDetector gesture={sliderGesture}>
            <Animated.View style={styles.sliderThumbWrapper}>
              <Animated.View style={[styles.sliderThumb, thumbStyle]} />
            </Animated.View>
          </GestureDetector>
          <Animated.View
            style={[
              styles.movingFontSize,
              fontSizeIndicatorStyle,
              labelAnimatedStyle,
            ]}
          >
            <Text style={styles.movingFontSizeText}>
              {Math.round(fontSize)}
            </Text>
          </Animated.View>
        </View>
      </View>
      <Animated.View style={labelAnimatedStyle}>
        <Text style={styles.sliderLabel}>{minFontSize}</Text>
      </Animated.View>
    </View>
  );
};

type TextEditorProps = {
  onCancel: () => void;
  onDone: (textData: Partial<TextSegment> & { id?: string | null }) => void;
  initialTextElement?: TextSegment | null;
};

const PressableWrapper = Platform.OS === 'ios' ? Pressable : GHPressable;
const RNScrollView = Platform.OS === 'ios' ? ScrollView : GHScrollView;

export const TextEditor: React.FC<TextEditorProps> = ({
  onCancel,
  onDone,
  initialTextElement,
}) => {
  const insets = useSafeAreaInsets();
  const [text, setText] = useState(initialTextElement?.text || '');
  const [fontSize, setFontSize] = useState(
    initialTextElement?.fontSize || FONT_SIZE_MIN
  );
  const [textColor, setTextColor] = useState(
    initialTextElement?.color || 'white'
  );
  const [backgroundColor, setBackgroundColor] = useState(
    initialTextElement?.backgroundColor || 'transparent'
  );
  const [activeTab, setActiveTab] = useState<'Font' | 'Background'>('Font');
  const [isCursorVisible, setIsCursorVisible] = useState(true);
  const [isKeyboardActive, setIsKeyboardActive] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const textElementSizeRef = useRef({ width: 0, height: 0 });

  const styles = createTextEditorStyles();
  const textInputRef = useRef<TextInput>(null);

  useEffect(() => {
    const keyboardWillShow = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setIsKeyboardActive(true);
        setKeyboardHeight(e.endCoordinates.height);
      }
    );
    const keyboardWillHide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setIsKeyboardActive(false);
        setKeyboardHeight(0);
      }
    );

    return () => {
      keyboardWillShow.remove();
      keyboardWillHide.remove();
    };
  }, []);

  useEffect(() => {
    let cursorInterval: NodeJS.Timeout | null = null;
    if (isKeyboardActive) {
      setIsCursorVisible(true);
      cursorInterval = setInterval(() => {
        setIsCursorVisible((prev) => !prev);
      }, 530);
    }
    return () => {
      if (cursorInterval) {
        clearInterval(cursorInterval);
      }
    };
  }, [isKeyboardActive]);

  useEffect(() => {
    if (initialTextElement) {
      setText(initialTextElement.text);
      setFontSize(initialTextElement.fontSize);
      setTextColor(initialTextElement.color);
      setBackgroundColor(initialTextElement.backgroundColor || 'transparent');
    }
    setTimeout(() => (textInputRef.current as any)?.focus(), 100);
  }, [initialTextElement]);

  const fontColors = [
    '#FFFFFF', // white
    '#000000', // black
    '#FF3B30', // red
    '#FFCC00', // yellow
    '#4CD964', // green
    '#007AFF', // blue
    '#5856D6', // indigo
    '#FF9500', // orange
    '#8E8E93', // iOS system gray (neutral)
    '#34C759', // vibrant green
    '#AF52DE', // purple
    '#FF2D55', // pink
  ];

  const backgroundColors = [
    'transparent', // no background
    '#FFFFFF', // white
    '#000000', // black
    '#1C1C1E', // dark gray
    '#2C2C2C', // deep gray
    '#F5F5F7', // off-white
    '#E5E5EA', // light gray
    '#3A3A3C', // muted dark gray
    '#FFEBEE', // pastel red
    '#E8F5E9', // pastel green
    '#E3F2FD', // pastel blue
    '#FFFDE7', // pastel yellow
  ];

  const handleDone = () => {
    // Only calculate default position if editing new text (no existing position)
    const shouldUseDefaultPosition =
      !initialTextElement ||
      (initialTextElement.x === undefined &&
        initialTextElement.y === undefined);

    // If it's a new text or has no position, let DraggableText handle the initial centering
    // by passing undefined. Otherwise, use the existing position.
    const defaultX = shouldUseDefaultPosition
      ? undefined
      : initialTextElement?.x;
    const defaultY = shouldUseDefaultPosition
      ? undefined
      : initialTextElement?.y;

    const textData = {
      id: initialTextElement?.id || null,
      text: text.trim(),
      fontSize,
      color: textColor,
      backgroundColor,
      x: defaultX,
      y: defaultY,
    };
    onDone(textData as Partial<TextSegment> & { id?: string | null });
  };

  const textDisplayStyle = {
    fontSize: fontSize,
    color: text ? textColor : 'rgba(255,255,255,0.7)',
    fontWeight: 'bold' as const,
    textAlign: 'center' as const,
  };
  const textBackgroundStyle = {
    backgroundColor: text.trim() ? backgroundColor : 'transparent',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 5,
    alignSelf: 'center' as const,
    maxWidth: '95%',
  };
  const cursorTextStyle = {
    color: isCursorVisible ? textColor : 'transparent',
  };

  const bottomContainerDynamicStyle = useMemo(
    () =>
      isKeyboardActive
        ? {
            bottom: Platform.OS === 'ios' ? keyboardHeight : 10,
          }
        : { bottom: 18 },
    [isKeyboardActive, keyboardHeight]
  );

  const bottomContainerIOSPaddingStyle = useMemo(
    () =>
      Platform.OS === 'ios' && !isKeyboardActive
        ? { paddingBottom: insets.bottom }
        : {},
    [isKeyboardActive, insets.bottom]
  );

  const getBackgroundColorCircleStyle = (color: string) => ({
    backgroundColor: color === 'transparent' ? '#333333' : color,
  });

  return (
    <View style={styles.overlay}>
      <TextInput
        ref={textInputRef as any}
        value={text}
        onChangeText={setText}
        style={hiddenInputStyle}
        autoFocus
        multiline
        caretHidden
        selectionColor="transparent"
      />
      <View
        style={[
          styles.header,
          Platform.OS === 'ios' && { paddingTop: insets.top + 10 },
        ]}
      >
        <PressableWrapper onPress={onCancel}>
          <Text style={styles.headerButton}>Cancel</Text>
        </PressableWrapper>
        <PressableWrapper onPress={handleDone}>
          <Text style={styles.headerButton}>Done</Text>
        </PressableWrapper>
      </View>
      <PressableWrapper
        onLayout={(e: any) => {
          const { width, height } = e.nativeEvent.layout;
          textElementSizeRef.current = { width, height };
        }}
        style={styles.inputContainer}
        onPress={() => (textInputRef.current as any)?.focus()}
      >
        <View style={textBackgroundStyle}>
          <Text style={textDisplayStyle}>
            {text || 'Start typing'}
            {isKeyboardActive && <Text style={cursorTextStyle}>|</Text>}
          </Text>
        </View>
      </PressableWrapper>
      <View style={styles.verticalSliderContainer}>
        <FontSizeSlider fontSize={fontSize} onFontSizeChange={setFontSize} />
      </View>
      <View
        style={[
          styles.bottomContainer,
          bottomContainerDynamicStyle,
          bottomContainerIOSPaddingStyle,
        ]}
      >
        <View style={styles.colorPicker}>
          {activeTab === 'Font' && (
            <RNScrollView
              horizontal
              keyboardShouldPersistTaps="always"
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.colorRowContent}
            >
              {fontColors.map((color) => (
                <PressableWrapper
                  key={color}
                  onPress={() => setTextColor(color)}
                  style={[
                    styles.colorCircle,
                    { backgroundColor: color },
                    textColor === color && styles.selectedColor,
                  ]}
                />
              ))}
            </RNScrollView>
          )}
          {activeTab === 'Background' && (
            <RNScrollView
              horizontal
              keyboardShouldPersistTaps="always"
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.colorRowContent}
            >
              {backgroundColors.map((color) => (
                <PressableWrapper
                  key={color}
                  onPress={() => setBackgroundColor(color)}
                  style={[
                    styles.colorCircle,
                    styles.colorCircleCentered,
                    getBackgroundColorCircleStyle(color),
                    backgroundColor === color && styles.selectedColor,
                  ]}
                >
                  {color === 'transparent' && (
                    <Text style={styles.transparentIcon}>✕</Text>
                  )}
                </PressableWrapper>
              ))}
            </RNScrollView>
          )}
        </View>
        <View style={styles.tabBar}>
          <PressableWrapper onPress={() => setActiveTab('Font')}>
            <Text
              style={[
                styles.tabText,
                activeTab === 'Font' && styles.activeTabText,
              ]}
            >
              Font
            </Text>
          </PressableWrapper>
          <PressableWrapper onPress={() => setActiveTab('Background')}>
            <Text
              style={[
                styles.tabText,
                activeTab === 'Background' && styles.activeTabText,
              ]}
            >
              Background
            </Text>
          </PressableWrapper>
        </View>
      </View>
    </View>
  );
};
