// @ts-ignore - External dependency
import { createThumbnail } from 'react-native-create-thumbnail';
import { Platform } from 'react-native';
import type { ThumbnailData } from '../types/timeline';
import { getTimelineWidth } from './timelineUtils';

const CHUNK_SIZE = 3;
const MIN_THUMBS = 10;
const TARGET_THUMBNAIL_WIDTH = 80;
const SAFE_START_MS = 1000;

const normalizeVideoUri = (uri: string): string => {
  if (Platform.OS === 'ios') {
    try {
      let path = uri.replace(/^file:\/\//, '');

      path = decodeURIComponent(path);

      return `file://${path}`;
    } catch (error) {
      console.error('Error normalizing URI:', error);
      return uri;
    }
  }
  return uri;
};

export const generateThumbnails = async (
  videoUri: string,
  videoDuration: number,
  onProgress?: (thumbnails: ThumbnailData[]) => void
): Promise<ThumbnailData[]> => {
  try {
    if (!videoUri || typeof videoUri !== 'string' || videoUri.trim() === '') {
      console.error(
        'Invalid videoUri provided to generateThumbnails:',
        videoUri
      );
      return [];
    }

    if (!videoDuration || videoDuration <= 0) {
      console.error('Invalid videoDuration provided:', videoDuration);
      return [];
    }

    // Normalize URI for platform compatibility
    const normalizedUri = normalizeVideoUri(videoUri);

    // Generate unique cache identifier
    const mediaUriHash =
      videoUri && typeof videoUri === 'string'
        ? videoUri
            .split('/')
            .pop()
            ?.replace(/[^a-zA-Z0-9]/g, '_')
            .substring(0, 20) || 'video'
        : 'video';

    const startTimeMs =
      videoDuration * 1000 > SAFE_START_MS ? SAFE_START_MS : 0;
    const effectiveDurationMs = videoDuration * 1000 - startTimeMs;

    // Calculate number of thumbnails needed
    const totalTimelineWidth = getTimelineWidth(videoDuration);
    const numThumbs = Math.max(
      MIN_THUMBS,
      Math.ceil(totalTimelineWidth / TARGET_THUMBNAIL_WIDTH)
    );

    const thumbnailPixelWidth = totalTimelineWidth / numThumbs;

    const allResults: ThumbnailData[] = [];

    // Generate in chunks
    for (let i = 0; i < numThumbs; i += CHUNK_SIZE) {
      const chunkPromises = Array.from(
        { length: Math.min(CHUNK_SIZE, numThumbs - i) },
        (_, j) => {
          const index = i + j;
          const position = index / (numThumbs - 1 || 1);
          const timeWithinEffectiveDuration = position * effectiveDurationMs;
          const timeStampMs = startTimeMs + timeWithinEffectiveDuration;

          if (!videoUri || typeof videoUri !== 'string') {
            throw new Error('Invalid videoUri in thumbnail generation');
          }

          return createThumbnail({
            url: normalizedUri,
            timeStamp: Math.floor(timeStampMs),
            cacheName: `thumb_${mediaUriHash}_${index}_${timeStampMs}`,
          })
            .then((thumbnail: any) => {
              if (thumbnail?.path) {
                return {
                  uri: thumbnail.path,
                  width: thumbnailPixelWidth,
                  status: 'success' as const,
                  index,
                };
              }
              throw new Error('Invalid thumbnail path');
            })
            .catch((err: any) => {
              console.error(
                `❌ [Thumbnails] Failed to generate thumbnail at ${Math.floor(
                  timeStampMs
                )}ms`,
                {
                  error: err?.message || err,
                  errorCode: err?.code || 'unknown',
                  platform: Platform.OS,
                  originalUri: videoUri,
                  normalizedUri: normalizedUri,
                  index,
                }
              );
              return {
                uri: '',
                width: thumbnailPixelWidth,
                status: 'failed' as const,
                index,
              };
            });
        }
      );

      const chunkResults = await Promise.all(chunkPromises);

      // Fill failed thumbnails with last valid one
      let lastValidUri =
        allResults.length > 0 ? allResults[allResults.length - 1]?.uri : '';
      const processedChunk = chunkResults
        .map((result: ThumbnailData) => {
          if (result.status === 'success' && result.uri) {
            lastValidUri = result.uri;
            return result;
          }
          return { ...result, uri: lastValidUri, originalStatus: 'failed' };
        })
        .filter((thumb: ThumbnailData) => thumb.uri !== '');

      allResults.push(...processedChunk);

      // Report progress
      if (onProgress) {
        onProgress([...allResults]);
      }

      // Small delay between chunks
      if (i + CHUNK_SIZE < numThumbs) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }

    return allResults;
  } catch (error) {
    console.error('Thumbnail generation error:', error);
    return [];
  }
};

export const regenerateThumbnailsForTrim = async (
  videoUri: string,
  startTime: number,
  duration: number,
  onProgress?: (thumbnails: ThumbnailData[]) => void
): Promise<ThumbnailData[]> => {
  if (!videoUri || typeof videoUri !== 'string' || videoUri.trim() === '') {
    console.error(
      'Invalid videoUri provided to regenerateThumbnailsForTrim:',
      videoUri
    );
    return [];
  }

  if (!duration || duration <= 0) {
    console.error('Invalid duration provided:', duration);
    return [];
  }

  // Normalize URI for platform compatibility
  const normalizedUri = normalizeVideoUri(videoUri);

  try {
    const mediaUriHash =
      videoUri && typeof videoUri === 'string'
        ? videoUri
            .split('/')
            .pop()
            ?.replace(/[^a-zA-Z0-9]/g, '_')
            .substring(0, 20) || 'video'
        : 'video';

    const newTimelineWidth = getTimelineWidth(duration);
    const numThumbs = Math.max(
      MIN_THUMBS,
      Math.ceil(newTimelineWidth / TARGET_THUMBNAIL_WIDTH)
    );

    const thumbnailPixelWidth = newTimelineWidth / numThumbs;
    const allResults: ThumbnailData[] = [];

    for (let i = 0; i < numThumbs; i += CHUNK_SIZE) {
      const chunkPromises = Array.from(
        { length: Math.min(CHUNK_SIZE, numThumbs - i) },
        (_, j) => {
          const index = i + j;
          const position = index / (numThumbs - 1 || 1);
          const timeWithinSegment = position * duration;
          const absoluteTimestampSeconds = startTime + timeWithinSegment;
          const timeStampMs = Math.floor(absoluteTimestampSeconds * 1000);

          if (!videoUri || typeof videoUri !== 'string') {
            throw new Error('Invalid videoUri in trim thumbnail regeneration');
          }

          return createThumbnail({
            url: normalizedUri,
            timeStamp: timeStampMs,
            cacheName: `trim_thumb_${mediaUriHash}_${index}_${timeStampMs}`,
          })
            .then((thumbnail: any) => {
              if (thumbnail?.path) {
                return {
                  uri: thumbnail.path,
                  width: thumbnailPixelWidth,
                  status: 'success' as const,
                  index,
                };
              }
              throw new Error('Invalid thumbnail path');
            })
            .catch((err: any) => {
              console.error(`❌ [Trim Thumbnails] Failed at ${timeStampMs}ms`, {
                error: err?.message || err,
                errorCode: err?.code || 'unknown',
                platform: Platform.OS,
                originalUri: videoUri,
                normalizedUri: normalizedUri,
                index,
              });
              return {
                uri: '',
                width: thumbnailPixelWidth,
                status: 'failed' as const,
                index,
              };
            });
        }
      );

      const chunkResults = await Promise.all(chunkPromises);

      let lastValidUri =
        allResults.length > 0 ? allResults[allResults.length - 1]?.uri : '';
      const processedChunk = chunkResults
        .map((result: ThumbnailData) => {
          if (result.status === 'success' && result.uri) {
            lastValidUri = result.uri;
            return result;
          }
          return { ...result, uri: lastValidUri };
        })
        .filter((thumb: ThumbnailData) => thumb.uri !== '');

      allResults.push(...processedChunk);

      if (onProgress) {
        onProgress([...allResults]);
      }

      if (i + CHUNK_SIZE < numThumbs) {
        if (global.gc) {
          global.gc();
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
    return allResults;
  } catch (error) {
    console.error('Trim thumbnail regeneration error:', error);
    return [];
  }
};
