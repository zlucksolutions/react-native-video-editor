// @ts-ignore - Peer dependency
import { Platform, Dimensions, PixelRatio } from 'react-native';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export const deviceUtils = {
  isIOS: Platform.OS === 'ios',
  isAndroid: Platform.OS === 'android',

  /**
   * Check if device is a small iPhone (SE, 6, 7, 8)
   */
  isSmallIphone: (): boolean => {
    return Platform.OS === 'ios' && screenWidth <= 375 && screenHeight <= 667;
  },

  /**
   * Check if device is iPhone X, 11 Pro, 12 Mini, 13 Mini
   */
  _isIphoneXAnd11Pro: (): boolean => {
    return Platform.OS === 'ios' && screenHeight === 812 && screenWidth === 375;
  },

  /**
   * Convert DP to pixels (Android)
   */
  dpToPixels: (dp: number): number => {
    return PixelRatio.getPixelSizeForLayoutSize(dp);
  },

  /**
   * Get safe area top (simple approximation)
   */
  getSafeAreaTop: (): number => {
    if (Platform.OS === 'ios') {
      // iPhone X and newer
      if (screenHeight >= 812) {
        return 44;
      }
      // Older iPhones
      return 20;
    }
    return 0;
  },

  /**
   * Get safe area bottom (simple approximation)
   */
  getSafeAreaBottom: (): number => {
    if (Platform.OS === 'ios' && screenHeight >= 812) {
      return 34;
    }
    return 0;
  },
};
