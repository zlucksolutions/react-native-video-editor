// @ts-ignore - Peer dependency
import { ScaledSheet } from 'react-native-size-matters';
import { COLORS } from '../../constants/colors';

export const StyleFunction = () =>
  ScaledSheet.create({
    content: {
      paddingHorizontal: '20@ms',
      paddingTop: '16@ms',
      alignItems: 'center',
    },
    recordingInfo: {
      marginBottom: '0@ms',
    },
    videoTimeText: {
      fontSize: '14@ms',
      color: COLORS.TEXT_SECONDARY,
      textAlign: 'center',
    },
    recordButtonContainer: {
      width: '100@ms',
      height: '100@ms',
      alignItems: 'center',
      justifyContent: 'center',
    },
    disabledRecordButton: {
      opacity: 0.5,
    },
    recordButtonOuter: {
      position: 'absolute',
      width: '75@ms',
      height: '75@ms',
      borderRadius: '40@ms',
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      borderWidth: '4@ms',
      borderColor: COLORS.TEXT_PRIMARY,
    },
    recordButtonOuterRecording: {
      borderColor: '#FF3040',
    },
    recordButtonInner: {
      width: '38@ms',
      height: '38@ms',
      borderRadius: '19@ms',
      backgroundColor: COLORS.TEXT_PRIMARY,
    },
    recordButtonInnerSquare: {
      borderRadius: '8@ms',
      width: '30@ms',
      height: '30@ms',
    },
    timerContainer: {
      marginBottom: '16@ms',
    },
    remainingTimeText: {
      fontSize: '16@ms',
      fontWeight: '600',
      color: COLORS.TEXT_PRIMARY,
    },
    footer: {
      flex: 1,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: '20@ms',
      borderTopWidth: 1,
      borderTopColor: COLORS.BORDER,
    },
    footerButton: {
      paddingHorizontal: '16@ms',
      justifyContent: 'center',
    },
    footerButtonText: {
      fontSize: '16@ms',
      color: COLORS.TEXT_PRIMARY,
      fontWeight: '600',
    },
    footerTitle: {
      fontSize: '16@ms',
      fontWeight: '600',
      color: COLORS.TEXT_PRIMARY,
    },
    doneButtonText: {
      fontSize: '16@ms',
      color: '#00ff88',
      fontWeight: '600',
    },
    disabledButton: {
      opacity: 0.5,
    },
  });
