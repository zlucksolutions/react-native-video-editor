// @ts-ignore - Peer dependency
import { ScaledSheet } from 'react-native-size-matters';
import { StyleSheet } from 'react-native';

export const createCropBottomSheetStyles = () =>
  ScaledSheet.create({
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      zIndex: 100,
    },
    backdropTouchable: {
      flex: 1,
    },
    sheetContainer: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 101,
      backgroundColor: '#0a0a0a',
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
    },
    sheet: {
      minHeight: '120@ms',
      backgroundColor: '#0a0a0a',
      paddingVertical: '20@ms',
      paddingHorizontal: '16@ms',
      borderTopWidth: 1,
      borderTopColor: '#1c1c1e',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '12@ms',
    },
    title: {
      color: '#fff',
      fontSize: '14@ms',
      fontWeight: '600',
      flex: 1,
      textAlign: 'center',
    },
    closeButton: {
      width: '28@ms',
      height: '28@ms',
      borderRadius: 14,
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'absolute',
      right: 0,
    },
    closeText: {
      color: '#fff',
      fontSize: '16@ms',
      fontWeight: '600',
    },
    optionsContainer: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      alignItems: 'flex-start',
      marginTop: '8@ms',
    },
    optionButton: {
      alignItems: 'center',
      padding: '8@ms',
      flex: 1,
    },
    iconContainer: {
      width: '56@ms',
      height: '56@ms',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: '8@ms',
      borderRadius: 8,
    },
    selectedIconContainer: {
      width: '56@ms',
      height: '56@ms',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: '8@ms',
      borderRadius: 8,
    },
    iconBox: {
      borderRadius: 8,
      justifyContent: 'center',
      alignItems: 'center',
      width: '100%',
      height: '100%',
    },
    selectedIconBox: {
      borderRadius: 8,
      justifyContent: 'center',
      alignItems: 'center',
      width: '100%',
      height: '100%',
    },
    aspectRatioShape: {
      borderWidth: 1.5,
      borderRadius: 2,
    },
    shape_9_16: {
      width: '40%',
      height: '70%',
      borderColor: '#bebebe',
    },
    shape_1_1: {
      width: '55%',
      height: '55%',
      borderColor: '#bebebe',
    },
    shape_16_9: {
      width: '70%',
      height: '40%',
      borderColor: '#bebebe',
    },
    selectedShape: {
      borderColor: '#00ff88',
    },
    optionText: {
      fontSize: '12@ms',
      fontWeight: '500',
      color: '#bebebe',
      textAlign: 'center',
      marginTop: '4@ms',
    },
    selectedOptionText: {
      color: '#00ff88',
      fontWeight: '600',
    },
    originalIcon: {
      width: '24@ms',
      height: '24@ms',
      tintColor: '#bebebe',
    },
    selectedOriginalIcon: {
      tintColor: '#00ff88',
    },
    originalIconBox: {
      width: '24@ms',
      height: '24@ms',
      borderRadius: 4,
      borderWidth: 1.5,
    },
    originalIconBoxSelected: {
      borderColor: '#00ff88',
      backgroundColor: '#00ff88',
    },
    originalIconBoxUnselected: {
      borderColor: '#bebebe',
      backgroundColor: 'transparent',
    },
  });
