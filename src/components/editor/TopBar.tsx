import React, { useMemo, useState } from 'react';
// @ts-ignore - Peer dependency
import { View, Text, Pressable, StatusBar, Image } from 'react-native';
// @ts-ignore - Peer dependency
import { ScaledSheet } from 'react-native-size-matters';
import { deviceUtils } from '../../utils/deviceUtils';
import { useFontFamily } from '../../context/FontFamilyContext';
// @ts-ignore - Peer dependency
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// @ts-ignore - Peer dependency
import { CloseIcon } from '../../assets/icons/index.js';
import { COLORS } from '../../constants/colors';
import { EditorModal } from './EditorModal';

type Props = {
  onCancel: () => void;
  onExport: () => void;
};

export const TopBar: React.FC<Props> = React.memo(({ onCancel, onExport }) => {
  const { top } = useSafeAreaInsets();
  const { fontStyle } = useFontFamily();
  const [showDiscardAlert, setShowDiscardAlert] = useState(false);

  const handleCancelPress = () => {
    setShowDiscardAlert(true);
  };

  const handleConfirmDiscard = () => {
    setShowDiscardAlert(false);
    onCancel();
  };

  const headerStyle = useMemo(
    () => ({
      paddingTop: deviceUtils.isAndroid
        ? (StatusBar.currentHeight || 20) + 10
        : top,
    }),
    [top]
  );

  return (
    <View style={[styles.header, headerStyle]}>
      <Pressable onPress={handleCancelPress} style={styles.headerButton}>
        <View style={styles.closeIconPlaceholder}>
          <Image
            style={styles.closeIconText}
            tintColor={COLORS.TEXT_PRIMARY}
            source={CloseIcon}
          />
        </View>
      </Pressable>

      <Pressable
        onPress={onExport}
        style={[styles.headerButton, styles.nextButton]}
      >
        <Text style={[styles.nextButtonText, fontStyle]}>Next</Text>
      </Pressable>

      <EditorModal
        visible={showDiscardAlert}
        title="Discard Edits?"
        message="If you go back, your changes will be lost."
        onConfirm={handleConfirmDiscard}
        onCancel={() => setShowDiscardAlert(false)}
        onRequestClose={() => setShowDiscardAlert(false)}
      />
    </View>
  );
});

const styles = ScaledSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: '16@ms',
    paddingBottom: '16@ms',
    backgroundColor: 'transparent',
  },
  headerButton: {
    padding: '8@ms',
    borderRadius: '20@ms',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeIconPlaceholder: {
    width: '32@ms',
    height: '32@ms',
    borderRadius: '16@ms',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeIconText: {
    tintColor: '#fff',
    height: '10@ms',
    width: '10@ms',
    resizeMode: 'contain',
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: '16@ms',
    fontWeight: '700',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  nextButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: '18@ms',
    paddingVertical: '8@ms',
    borderRadius: '20@ms',
  },
  nextButtonText: {
    color: '#fff',
    fontSize: '14@ms',
    fontWeight: '700',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
