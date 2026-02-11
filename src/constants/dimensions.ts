// @ts-ignore - Peer dependency
import { Dimensions, Platform } from 'react-native';
import { deviceUtils } from '../utils/deviceUtils';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Timeline Constants
export const PIXELS_PER_SECOND = 50;
export const TIMELINE_MARGIN_HORIZONTAL = 16;
export const MAX_THUMBNAILS = 20;
export const HANDLE_WIDTH = 24;
export const MIN_DURATION_SECONDS = 2;
export const MIN_DURATION_PIXELS = MIN_DURATION_SECONDS * PIXELS_PER_SECOND;

// Preview Area
export const PREVIEW_ASPECT_RATIO = 9 / 16;
export const PREVIEW_WIDTH = SCREEN_WIDTH;
export const PREVIEW_HEIGHT = PREVIEW_WIDTH / PREVIEW_ASPECT_RATIO;

// Small Preview (when timeline is visible)
export const SMALL_PREVIEW_WIDTH = deviceUtils.isSmallIphone()
  ? SCREEN_WIDTH * 0.44
  : SCREEN_WIDTH * 0.55;
export const SMALL_PREVIEW_HEIGHT = SMALL_PREVIEW_WIDTH / PREVIEW_ASPECT_RATIO;

// Section Heights
export const TOOLS_SECTION_HEIGHT = 140;
export const TIMELINE_SECTION_HEIGHT = Platform.select({
  ios: 230,
  android: SCREEN_HEIGHT * 0.32,
  default: 230,
});

// Loop visualization
export const MIN_WIDTH_FOR_LOOP_NUMBER = 35;
export const MIN_WIDTH_FOR_LOOP_NAME = 100;

// Font sizes
export const FONT_SIZE_MIN = 12;
export const FONT_SIZE_MAX = 40;
export const FONT_SIZE_DEFAULT = 26;

export { SCREEN_WIDTH, SCREEN_HEIGHT };
