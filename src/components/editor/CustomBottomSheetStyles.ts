// @ts-ignore - Peer dependency
import { ScaledSheet } from 'react-native-size-matters';
import { COLORS } from '../../constants/colors';

export const createCustomBottomSheetStyles = () =>
  ScaledSheet.create({
    container: {
      zIndex: 999,
      elevation: 999,
    },
    bottomSheet: {
      backgroundColor: COLORS.BACKGROUND_SECONDARY,
      borderTopLeftRadius: '16@ms',
      borderTopRightRadius: '16@ms',
    },
    contentView: {
      flex: 1,
      borderTopWidth: 1,
      borderColor: COLORS.BORDER,
      backgroundColor: COLORS.BACKGROUND_SECONDARY,
    },
    contentView2: {
      flex: 1,
    },
    contentWithRadius: {
      borderTopLeftRadius: '16@ms',
      borderTopRightRadius: '16@ms',
      overflow: 'hidden',
    },
    titleContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      borderTopLeftRadius: '16@ms',
      borderTopRightRadius: '16@ms',
      paddingHorizontal: '16@ms',
      paddingTop: '12@ms',
      paddingBottom: '12@ms',
      backgroundColor: COLORS.BACKGROUND_SECONDARY,
      alignItems: 'center',
    },
    bottomSheetTitle: {
      fontSize: '14@ms',
      fontWeight: '600',
      width: '86%',
      color: COLORS.TEXT_PRIMARY,
    },
    closeContainer: {
      height: '28@ms',
      width: '28@ms',
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: '8@ms',
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      borderWidth: 1,
      borderColor: COLORS.BORDER,
    },
    closeText: {
      fontSize: '16@ms',
      color: COLORS.TEXT_PRIMARY,
      fontWeight: '600',
    },
    handleIndicator: {
      backgroundColor: COLORS.TEXT_SECONDARY,
      width: '40@ms',
      height: '4@ms',
    },
  });
