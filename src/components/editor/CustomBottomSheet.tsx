import React, { forwardRef, useCallback } from 'react';
import { Keyboard, Text, TouchableOpacity, View } from 'react-native';
// @ts-ignore - Peer dependency
import BottomSheet, { BottomSheetBackdrop } from '@gorhom/bottom-sheet';
// @ts-ignore - Peer dependency
import { SafeAreaView } from 'react-native-safe-area-context';
import { createCustomBottomSheetStyles } from './CustomBottomSheetStyles';

type CustomBottomSheetProps = {
  snapPoints?: Array<string | number>;
  title?: string;
  children: React.ReactNode;
  bottomSheetStyle?: object;
  containerStyle?: object;
  onClose?: () => void;
  onChange?: (index: number) => void;
  disablePanDownToClose?: boolean;
  safeAreaDisabled?: boolean;
  headerStyle?: object;
  sheetContentStyle?: object;
  headerTextStyle?: object;
  closeBtnCntnrStyle?: object;
  closeIconColor?: string;
  isSheetOpen?: number;
  setIsSheetOpen?: (index: number) => void;
  showHandleComponent?: boolean;
  showNoHeader?: boolean;
  pressBehavior?: 'close' | 'collapse' | 'none';
};

export const CustomBottomSheet = forwardRef<
  BottomSheet,
  CustomBottomSheetProps
>(
  (
    {
      snapPoints = ['40%'],
      title,
      children,
      bottomSheetStyle,
      containerStyle,
      onClose,
      onChange,
      disablePanDownToClose,
      safeAreaDisabled = false,
      headerStyle,
      sheetContentStyle,
      headerTextStyle,
      closeBtnCntnrStyle,
      closeIconColor,
      isSheetOpen = -1,
      setIsSheetOpen,
      showHandleComponent = false,
      showNoHeader = false,
      pressBehavior = 'close',
      ...restProps
    },
    ref
  ) => {
    const styles = createCustomBottomSheetStyles();

    const renderBackdrop = useCallback(
      (backdropProps: any) => (
        <BottomSheetBackdrop
          {...backdropProps}
          disappearsOnIndex={-1}
          appearsOnIndex={0}
          pressBehavior={pressBehavior}
        />
      ),
      [pressBehavior]
    );

    const handleClosePress = () => {
      onClose?.();
      if (ref && 'current' in ref) {
        ref.current?.close();
      }
      Keyboard.dismiss();
      setTimeout(() => {
        setIsSheetOpen?.(-1);
      }, 200);
    };

    const handleChange = (index: number) => {
      if (index === -1) {
        onClose?.();
        setTimeout(() => {
          setIsSheetOpen?.(-1);
        }, 200);
      }
      onChange?.(index);
    };

    if (isSheetOpen === -1) {
      return null;
    }

    return (
      <BottomSheet
        ref={ref}
        snapPoints={snapPoints}
        index={isSheetOpen}
        enablePanDownToClose={!disablePanDownToClose}
        backdropComponent={renderBackdrop}
        onChange={handleChange}
        handleComponent={showHandleComponent ? undefined : null}
        backgroundStyle={styles.bottomSheet}
        enableDynamicSizing={false}
        containerStyle={[styles.container, containerStyle]}
        style={[styles.bottomSheet, bottomSheetStyle]}
        onClose={onClose}
        handleIndicatorStyle={styles.handleIndicator}
        {...restProps}
      >
        <>
          {!showNoHeader && title && (
            <View style={[styles.titleContainer, headerStyle]}>
              <Text style={[styles.bottomSheetTitle, headerTextStyle]}>
                {title}
              </Text>
              <TouchableOpacity
                style={[styles.closeContainer, closeBtnCntnrStyle]}
                onPress={handleClosePress}
              >
                <Text
                  style={[
                    styles.closeText,
                    closeIconColor ? { color: closeIconColor } : null,
                  ]}
                >
                  ✕
                </Text>
              </TouchableOpacity>
            </View>
          )}
          {safeAreaDisabled ? (
            children
          ) : (
            <SafeAreaView
              style={[
                showNoHeader ? styles.contentWithRadius : null,
                styles.contentView2,
              ]}
              edges={['bottom']}
            >
              <View style={[styles.contentView, sheetContentStyle]}>
                {children}
              </View>
            </SafeAreaView>
          )}
        </>
      </BottomSheet>
    );
  }
);
