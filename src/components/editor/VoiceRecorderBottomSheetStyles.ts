// @ts-ignore - Peer dependency
import { ScaledSheet } from 'react-native-size-matters';
import { COLORS } from '../../constants/colors';

export const StyleFunction = () =>
  ScaledSheet.create({
    container: {
      backgroundColor: COLORS.BACKGROUND,
      borderTopLeftRadius: '16@ms',
      borderTopRightRadius: '16@ms',
      paddingBottom: '24@ms',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: '20@ms',
      paddingTop: '20@ms',
      paddingBottom: '16@ms',
      borderBottomWidth: 1,
      borderBottomColor: COLORS.BORDER,
    },
    title: {
      fontSize: '18@ms',
      fontWeight: '600',
      color: COLORS.TEXT_PRIMARY,
    },
    closeButton: {
      width: '32@ms',
      height: '32@ms',
      borderRadius: '16@ms',
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    closeText: {
      fontSize: '20@ms',
      color: COLORS.TEXT_PRIMARY,
      fontWeight: '600',
    },
    content: {
      paddingHorizontal: '20@ms',
      paddingTop: '32@ms',
      alignItems: 'center',
    },
    recordingInfo: {
      marginBottom: '24@ms',
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
      marginBottom: '24@ms',
    },
    disabledRecordButton: {
      opacity: 0.5,
    },
    recordButtonOuter: {
      position: 'absolute',
      width: '100@ms',
      height: '100@ms',
      borderRadius: '50@ms',
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      borderWidth: '4@ms',
      borderColor: COLORS.TEXT_PRIMARY,
    },
    recordButtonOuterRecording: {
      borderColor: '#FF3040',
    },
    recordButtonInner: {
      width: '50@ms',
      height: '50@ms',
      borderRadius: '25@ms',
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
    statusContainer: {
      marginTop: '8@ms',
      minHeight: '24@ms',
    },
    statusText: {
      fontSize: '14@ms',
      color: COLORS.TEXT_SECONDARY,
      textAlign: 'center',
    },
    footer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: '20@ms',
      paddingTop: '16@ms',
      borderTopWidth: 1,
      borderTopColor: COLORS.BORDER,
    },
    footerButton: {
      paddingHorizontal: '16@ms',
      paddingVertical: '8@ms',
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
