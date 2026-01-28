// @ts-ignore - Peer dependency
import { ScaledSheet } from 'react-native-size-matters';

export const createCropBottomSheetStyles = () =>
  ScaledSheet.create({
    sheetContent: {
      paddingVertical: '20@ms',
      paddingHorizontal: '16@ms',
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
