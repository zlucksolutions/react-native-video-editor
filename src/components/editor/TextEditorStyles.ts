// @ts-ignore - Peer dependency
import { ScaledSheet } from 'react-native-size-matters';
import { StyleSheet } from 'react-native';
import { deviceUtils } from '../../utils/deviceUtils';

export const createTextEditorStyles = () =>
  ScaledSheet.create({
    overlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'center',
      zIndex: 200,
    },
    header: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: '20@ms',
      paddingTop: '10@ms',
    },
    headerButton: {
      color: 'white',
      fontSize: '18@ms',
      fontWeight: '600',
      padding: '10@ms',
    },
    androidInputContainer: {
      left: 0,
      bottom: '25@ms',
      right: 0,
    },
    inputContainer: {
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: '20@ms',
      bottom: '150@ms',
    },
    textInput: {
      width: '100%',
      textAlign: 'center',
      color: 'white',
      fontWeight: 'bold',
      paddingHorizontal: '15@ms',
      paddingVertical: '10@ms',
      borderRadius: '8@ms',
    },
    verticalSliderContainer: {
      position: 'absolute',
      right: '10@ms',
      top: '24%',
      transform: [{ translateY: deviceUtils.isAndroid ? 0 : -75 }],
    },
    slider: {
      alignItems: 'center',
    },
    sliderContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    movingFontSize: {
      position: 'absolute',
      left: -45,
      top: -15,
      paddingHorizontal: '8@ms',
      paddingVertical: '4@ms',
      borderRadius: '12@ms',
      minWidth: '35@ms',
    },
    movingFontSizeText: {
      color: 'white',
      fontSize: '12@ms',
      fontWeight: 'bold',
      textAlign: 'center',
    },
    sliderLabel: {
      color: 'white',
      fontSize: '12@ms',
      fontWeight: '600',
      marginVertical: '14@ms',
    },
    sliderTrack: {
      width: '4@ms',
      backgroundColor: 'rgba(255,255,255,0.3)',
      borderRadius: 2,
    },
    sliderThumbWrapper: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'center',
      alignItems: 'center',
    },
    sliderThumb: {
      position: 'absolute',
      width: '20@ms',
      height: '20@ms',
      backgroundColor: 'white',
      borderRadius: '12@ms',
      left: -8,
      top: -12,
    },
    colorPicker: {
      backgroundColor: 'rgba(0,0,0,0.4)',
      paddingVertical: '8@ms',
      width: '100%',
    },
    colorRow: {},
    colorRowContent: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: '10@ms',
      paddingVertical: '10@ms',
    },
    colorCircle: {
      width: '22@ms',
      height: '22@ms',
      borderRadius: '13@ms',
      marginHorizontal: '7@ms',
      justifyContent: 'center',
      alignItems: 'center',
      overflow: 'hidden',
      elevation: 0,
    },
    selectedColor: {
      borderColor: 'white',
      borderWidth: '3@ms',
    },
    bottomContainer: {
      position: 'absolute',
      bottom: deviceUtils.isSmallIphone() ? 8 : -18,
      left: 0,
      right: 0,
    },
    tabBar: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: '8@ms',
      marginBottom: deviceUtils.isIOS ? '10@ms' : 0,
    },
    tabText: {
      color: 'rgba(255, 255, 255, 0.6)',
      fontSize: 16,
      fontWeight: '500',
      marginHorizontal: 15,
    },
    activeTabText: {
      color: 'white',
    },
    iconInCircle: {
      width: '22@ms',
      height: '22@ms',
      tintColor: '#FFFFFF',
      resizeMode: 'contain',
    },
    colorCircleCentered: {
      justifyContent: 'center',
      alignItems: 'center',
    },
    transparentIcon: {
      color: '#fff',
      fontSize: '12@ms',
    },
  });
