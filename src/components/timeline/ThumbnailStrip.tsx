import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
// @ts-ignore - Peer dependency
import FastImage from 'react-native-fast-image';
import type { ThumbnailData } from '../../types/timeline';
import { COLORS } from '../../constants/colors';

interface ThumbnailStripProps {
  thumbnails: ThumbnailData[];
  timelineWidth: number;
  isGenerating?: boolean;
}

export const ThumbnailStrip: React.FC<ThumbnailStripProps> = ({
  thumbnails,
  timelineWidth,
  isGenerating,
}) => {
  if (isGenerating && thumbnails.length === 0) {
    return (
      <View style={[styles.container, { width: timelineWidth }]}>
        <Text style={styles.loadingText}>Generating thumbnails...</Text>
      </View>
    );
  }

  if (thumbnails.length === 0) {
    return (
      <View style={[styles.container, { width: timelineWidth }]}>
        <View style={styles.placeholder} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { width: timelineWidth }]}>
      <View style={styles.thumbnailRow}>
        {thumbnails.map((thumb, index) => (
          <FastImage
            key={`thumb-${index}-${thumb.uri}`}
            source={{ uri: thumb.uri }}
            style={[
              styles.thumbnail,
              {
                width: thumb.width,
                opacity: thumb.status === 'failed' ? 0.3 : 1,
              },
            ]}
            resizeMode={FastImage.resizeMode.cover}
          />
        ))}
      </View>

      {/* Loading indicator overlay for progressive loading */}
      {isGenerating && (
        <View style={styles.loadingOverlay}>
          <Text style={styles.loadingText}>
            Loading {thumbnails.length} thumbnails...
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 60,
    backgroundColor: COLORS.BACKGROUND_SECONDARY,
    overflow: 'hidden',
  },
  thumbnailRow: {
    flexDirection: 'row',
    height: '100%',
  },
  thumbnail: {
    height: 60,
  },
  placeholder: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND_SECONDARY,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 12,
  },
});
