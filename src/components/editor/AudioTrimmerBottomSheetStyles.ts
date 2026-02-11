// @ts-ignore - Peer dependency
import { ScaledSheet } from 'react-native-size-matters';
// @ts-ignore - Peer dependency
import { Dimensions } from 'react-native';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SELECT_WIDTH = 200;

export const createAudioTrimmerStyles = (_theme?: any) =>
  ScaledSheet.create({
    trimmerContainer: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: '240@ms',
      justifyContent: 'center',
      alignItems: 'center',
      paddingBottom: '20@ms',
    },
    titleContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: '20@ms',
      gap: '8@ms',
    },
    title: {
      color: 'white',
      fontSize: '13@ms',
    },
    loopButtonInTitle: {
      width: '32@ms',
      height: '32@ms',
      backgroundColor: 'rgba(255, 255, 255, 0.3)',
      borderRadius: '16@ms',
      justifyContent: 'center',
      alignItems: 'center',
    },
    loopIcon: {
      fontSize: '16@ms',
      color: 'rgba(255, 255, 255, 0.7)',
      textAlign: 'center',
      lineHeight: '24@ms',
    },
    loopIconGradient: {
      width: '30@ms',
      height: '30@ms',
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: '16@ms',
    },
    loopIconText: {
      width: '24@ms',
      height: '24@ms',
      left: '1@ms',
      bottom: '1@ms',
      tintColor: 'white',
      resizeMode: 'contain',
    },
    waveArea: {
      height: '50@ms',
      width: '100%',
      justifyContent: 'center',
      alignItems: 'center',
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.8,
      shadowRadius: 1,
      elevation: 5,
    },
    leftAlignedContent: {
      justifyContent: 'flex-start',
    },
    ticksRow: {
      flexDirection: 'row',
      alignItems: 'center',
      height: '100%',
    },
    tick: {
      width: '2.8@ms',
      marginRight: '3@ms',
      borderRadius: 2,
    },
    selectionBox: {
      position: 'absolute',
      width: SELECT_WIDTH,
      height: '50@ms',
      left: (SCREEN_WIDTH - SELECT_WIDTH) / 2,
      borderRadius: '10@ms',
      borderWidth: 3,
      borderColor: 'white',
      overflow: 'hidden',
    },
    playbackFill: {
      position: 'absolute',
      height: '100%',
      left: 0,
    },
    controlsContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      width: '90%',
      marginTop: '25@ms',
      paddingHorizontal: '10@ms',
    },
    actionsContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    actionButton: {
      color: 'white',
      fontSize: '14@ms',
      fontWeight: '600',
      paddingHorizontal: '14@ms',
      paddingVertical: '8@ms',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.8,
      shadowRadius: 1,
      elevation: 5,
    },
    doneButton: {
      backgroundColor: 'rgba(255, 255, 255, 0.3)',
      color: 'white',
      borderRadius: '8@ms',
      overflow: 'hidden',
      marginLeft: '10@ms',
    },
    hiddenVideo: {
      width: 0,
      height: 0,
    },
    ticksRowAndroid: {
      overflow: 'hidden',
    },
  });
