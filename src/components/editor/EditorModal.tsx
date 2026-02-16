import React from 'react';
// @ts-ignore - Peer dependency
import { View, Text, Pressable, Modal, ActivityIndicator } from 'react-native';
// @ts-ignore - Peer dependency
import { ScaledSheet } from 'react-native-size-matters';
import { COLORS } from '../../constants/colors';

type ModalType = 'alert' | 'loader';

interface EditorModalProps {
  visible: boolean;
  type?: ModalType;
  title?: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  onRequestClose?: () => void;
}

export const EditorModal: React.FC<EditorModalProps> = ({
  visible,
  type = 'alert',
  title,
  message,
  confirmLabel = 'Discard',
  cancelLabel = 'Keep',
  onConfirm,
  onCancel,
  onRequestClose,
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onRequestClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.alertContainer}>
          {title && <Text style={styles.alertTitle}>{title}</Text>}

          {type === 'loader' ? (
            <View style={styles.loaderContainer}>
              <ActivityIndicator size="large" color={COLORS.ACCENT_PINK} />
              {message && (
                <Text style={[styles.alertMessage, styles.loaderMessage]}>
                  {message}
                </Text>
              )}
            </View>
          ) : (
            <>
              {message && <Text style={styles.alertMessage}>{message}</Text>}
              <View style={styles.alertButtons}>
                <Pressable onPress={onCancel} style={styles.keepButton}>
                  <Text style={styles.keepButtonText}>{cancelLabel}</Text>
                </Pressable>

                <Pressable onPress={onConfirm} style={styles.discardButton}>
                  <Text style={styles.discardButtonText}>{confirmLabel}</Text>
                </Pressable>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = ScaledSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '20@ms',
  },
  alertContainer: {
    width: '100%',
    maxWidth: '320@ms',
    backgroundColor: COLORS.BACKGROUND_SECONDARY,
    borderRadius: '24@ms',
    padding: '24@ms',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  alertTitle: {
    color: '#fff',
    fontSize: '20@ms',
    fontWeight: '800',
    marginBottom: '12@ms',
  },
  alertMessage: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: '15@ms',
    textAlign: 'center',
    marginBottom: '28@ms',
    lineHeight: '22@ms',
  },
  loaderContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: '10@ms',
  },
  loaderMessage: {
    marginTop: '16@ms',
    marginBottom: 0,
  },
  alertButtons: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
    gap: '12@ms',
  },
  keepButton: {
    flex: 1,
    paddingVertical: '12@ms',
    borderRadius: '12@ms',
    backgroundColor: COLORS.KEEP_GREEN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keepButtonText: {
    color: '#000',
    fontSize: '14@ms',
    fontWeight: '600',
  },
  discardButton: {
    flex: 1,
    paddingVertical: '12@ms',
    borderRadius: '12@ms',
    backgroundColor: COLORS.DISCARD_PINK,
    alignItems: 'center',
    justifyContent: 'center',
  },
  discardButtonText: {
    color: '#000',
    fontSize: '14@ms',
    fontWeight: '700',
  },
});
