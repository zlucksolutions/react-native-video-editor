import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from 'react';
import type {
  AudioSegment,
  TextSegment,
  VoiceoverSegment,
} from '../types/segments';
import { PREVIEW_WIDTH, PREVIEW_HEIGHT } from '../constants/dimensions';
import { PixelRatio, Platform } from 'react-native';

type VideoElement = {
  type: string;

  uri?: string;
  muted?: boolean;

  startTime?: number;
  endTime?: number;

  selection_params?: string;

  musicUri?: string;
  audioOffset?: number;
  isLooped?: boolean;

  text?: string;
  fontSize?: number;
  textColor?: string;
  textOverlayColor?: string;
  textPosition?: {
    xAxis: number;
    yAxis: number;
  };
  screenWidth?: number;
  screenHeight?: number;

  voiceOverUri?: string;
};

type InitParams = {
  source: string;
  features: Record<string, boolean>;
};

type CropRatio = 'original' | '9:16' | '1:1' | '16:9';

type EditorStateContextValue = {
  initEditor: (params: InitParams) => void;
  upsertOperation: (element: VideoElement) => void;
  removeOperation: (type: string) => void;
  buildExportConfig: () => { videoElements: VideoElement[] };
  resetEditor: () => void;
  setTrim: (start: number, end: number) => void;
  getTrim: () => { start: number; end: number };
  cropRatio: CropRatio;
  setCropRatio: (ratio: CropRatio) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setOriginalDuration: (duration: number) => void;
  getPlaybackState: () => {
    currentTime: number;
    duration: number;
    originalDuration: number;
  };
  isScrubbing: boolean;
  startScrubbing: () => void;
  stopScrubbing: () => void;
  setAudioTrim: (start: number, end: number) => void;
  getAudioTrim: () => { start: number; end: number };
  audioUri: string | null;
  setAudioUri: (uri: string | null) => void;
  videoNaturalSize: { width: number; height: number } | null;
  setVideoNaturalSize: (size: { width: number; height: number } | null) => void;
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
  isTrimming: boolean;
  setIsTrimming: (trimming: boolean) => void;
  isDraggingHandle: boolean;
  setIsDraggingHandle: (dragging: boolean) => void;
  activeSegment: { type: string; id?: string } | null;
  setActiveSegment: (segment: { type: string; id?: string } | null) => void;
  thumbnails: Array<{ uri: string; width: number; status?: string }>;
  setThumbnails: (
    thumbnails: Array<{ uri: string; width: number; status?: string }>
  ) => void;
  isMuted: boolean;
  setIsMuted: (muted: boolean) => void;
  videoRef: React.RefObject<any> | null;
  setVideoRef: (ref: React.RefObject<any> | null) => void;
  audioSegments: AudioSegment[];
  setAudioSegments: (segments: AudioSegment[]) => void;
  addAudioSegment: (segment: AudioSegment) => void;
  removeAudioSegment: (segmentId: string) => void;
  textSegments: TextSegment[];
  setTextSegments: (segments: TextSegment[]) => void;
  addTextSegment: (segment: TextSegment) => void;
  updateTextSegment: (segmentId: string, updates: Partial<TextSegment>) => void;
  updateTextSegmentStart: (segmentId: string, start: number) => void;
  updateTextSegmentEnd: (segmentId: string, end: number) => void;
  removeTextSegment: (segmentId: string) => void;
  isTextEditorVisible: boolean;
  setIsTextEditorVisible: (visible: boolean) => void;
  editingTextElement: TextSegment | null;
  setEditingTextElement: (element: TextSegment | null) => void;
  isTextDragging: boolean;
  setIsTextDragging: (dragging: boolean) => void;
  isTextPinching: boolean;
  setIsTextPinching: (pinching: boolean) => void;
  voiceoverSegments: VoiceoverSegment[];
  setVoiceoverSegments: (segments: VoiceoverSegment[]) => void;
  addVoiceoverSegment: (segment: VoiceoverSegment) => void;
  removeVoiceoverSegment: (segmentId: string) => void;
};

const EditorStateContext = createContext<EditorStateContextValue | null>(null);

type EditorStateProviderProps = {
  children: React.ReactNode;
};

export const EditorStateProvider: React.FC<EditorStateProviderProps> = ({
  children,
}) => {
  const videoElementsRef = useRef<VideoElement[]>([]);
  const sourceRef = useRef<string | null>(null);

  const getFontSizeForVideo = useCallback((fontSize: number): number => {
    if (Platform.OS === 'android') {
      return PixelRatio.get() * fontSize || 1;
    }
    return fontSize;
  }, []);

  const [cropRatio, setCropRatio] = useState<CropRatio>('original');
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [currentTime, setCurrentTimeState] = useState(0);
  const [duration, setDurationState] = useState(0);
  const [originalDuration, setOriginalDurationState] = useState(0);
  const [videoNaturalSize, setVideoNaturalSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isTrimming, setIsTrimming] = useState(false);
  const [isDraggingHandle, setIsDraggingHandle] = useState(false);
  const [activeSegment, setActiveSegment] = useState<{
    type: string;
    id?: string;
  } | null>(null);
  const [thumbnails, setThumbnails] = useState<
    Array<{ uri: string; width: number; status?: string }>
  >([]);
  const [isMuted, setIsMutedState] = useState(false);
  const setIsMuted = useCallback((muted: boolean) => {
    setIsMutedState(muted);
    const videoUriElement = videoElementsRef.current.find(
      (e) => e.type === 'videoUri'
    );
    if (videoUriElement) {
      videoUriElement.muted = muted;
    }
  }, []);
  const [videoRef, setVideoRefState] = useState<React.RefObject<any> | null>(
    null
  );
  const [audioSegments, setAudioSegmentsState] = useState<AudioSegment[]>([]);
  const [textSegments, setTextSegmentsState] = useState<TextSegment[]>([]);
  const [voiceoverSegments, setVoiceoverSegmentsState] = useState<
    VoiceoverSegment[]
  >([]);
  const [isTextEditorVisible, setIsTextEditorVisible] = useState(false);
  const [editingTextElement, setEditingTextElement] =
    useState<TextSegment | null>(null);
  const [isTextDragging, setIsTextDragging] = useState(false);
  const [isTextPinching, setIsTextPinching] = useState(false);
  const startScrubbing = () => setIsScrubbing(true);
  const stopScrubbing = () => setIsScrubbing(false);

  const setVideoRef = (ref: React.RefObject<any> | null) => {
    setVideoRefState(ref);
  };

  const [audioUri, setAudioUriState] = useState<string | null>(null);
  const audioTrimRef = useRef<{ start: number; end: number }>({
    start: 0,
    end: 0,
  });
  const normalizeFileUri = useCallback((uri?: string | null) => {
    if (!uri) return null;
    if (/^(file|content|http|https):\/\//.test(uri)) return uri;
    return `file://${uri}`;
  }, []);

  // Add or replace operation - Moved up for stability
  const upsertOperation = useCallback((element: VideoElement) => {
    // Types that can have multiple instances
    const multipleAllowedTypes = ['addTextOverlay', 'addVoiceOver'];

    if (multipleAllowedTypes.includes(element.type)) {
      // For text overlays and voiceovers, always push (no upsert logic)
      videoElementsRef.current.push(element);
    } else {
      // For other types (trim, crop, bgm), use upsert logic
      const index = videoElementsRef.current.findIndex(
        (e) => e.type === element.type
      );

      if (index >= 0) {
        videoElementsRef.current[index] = element;
      } else {
        videoElementsRef.current.push(element);
      }
    }
  }, []);

  // Remove operation - Moved up for stability
  const removeOperation = useCallback((type: string) => {
    videoElementsRef.current = videoElementsRef.current.filter(
      (e) => e.type !== type
    );
  }, []);

  useEffect(() => {
    upsertOperation({
      type: 'crop',
      selection_params: cropRatio,
    });
  }, [cropRatio, upsertOperation]);

  // Initialize editor
  const initEditor = useCallback(({ source }: InitParams) => {
    sourceRef.current = source;

    videoElementsRef.current = [
      {
        type: 'videoUri',
        uri: source,
        muted: false,
      },
    ];
  }, []);

  const trimRef = useRef<{ start: number; end: number }>({
    start: 0,
    end: Number.MAX_SAFE_INTEGER,
  });

  const setTrim = useCallback(
    (start: number, end: number) => {
      trimRef.current = { start, end };

      upsertOperation({
        type: 'trim',
        startTime: start,
        endTime: end,
      });
    },
    [upsertOperation]
  );

  const getTrim = useCallback(() => trimRef.current, []);

  const setCurrentTime = useCallback((time: number) => {
    setCurrentTimeState(time);
  }, []);

  const setDuration = useCallback((durationValue: number) => {
    setDurationState(durationValue);
  }, []);

  const setOriginalDuration = useCallback((durationValue: number) => {
    setOriginalDurationState(durationValue);
  }, []);

  const getPlaybackState = useCallback(
    () => ({
      currentTime,
      duration,
      originalDuration,
    }),
    [currentTime, duration, originalDuration]
  );

  const setAudioTrim = useCallback(
    (start: number, end: number) => {
      audioTrimRef.current = { start, end };
      upsertOperation({
        type: 'audio',
        musicUri: normalizeFileUri(audioUri) || undefined,
        audioOffset: start,
      });
    },
    [upsertOperation, audioUri, normalizeFileUri]
  );

  const getAudioTrim = useCallback(() => audioTrimRef.current, []);

  const setAudioUri = useCallback(
    (uri: string | null) => {
      setAudioUriState(normalizeFileUri(uri));
    },
    [normalizeFileUri]
  );

  const setAudioSegments = useCallback((segments: AudioSegment[]) => {
    setAudioSegmentsState(segments);
  }, []);

  const addAudioSegment = useCallback(
    (segment: AudioSegment) => {
      setAudioSegmentsState([segment]);
      upsertOperation({
        type: 'audio',
        musicUri: normalizeFileUri(segment.uri) || undefined,
        audioOffset: segment.audioOffset,
        isLooped: segment.isLooped,
      });
    },
    [upsertOperation, normalizeFileUri]
  );

  const removeAudioSegment = useCallback(
    (segmentId: string) => {
      setAudioSegmentsState((prev) => {
        const newSegments = prev.filter((seg) => seg.id !== segmentId);
        if (newSegments.length === 0) {
          removeOperation('audio');
          setAudioUriState(null); // Clear audioUri state when no segments remain
        } else {
          // Update the operation with the remaining segment
          const remainingSegment = newSegments[0];
          if (remainingSegment && remainingSegment.uri) {
            upsertOperation({
              type: 'audio',
              musicUri: normalizeFileUri(remainingSegment.uri) || undefined,
              audioOffset: remainingSegment.audioOffset,
              isLooped: remainingSegment.isLooped,
            });
          }
        }
        return newSegments;
      });

      // Clear active segment if it's the one being deleted
      setActiveSegment((prev) => {
        if (prev?.type === 'audio' && prev?.id === segmentId) {
          return null;
        }
        return prev;
      });
    },
    [removeOperation, upsertOperation, normalizeFileUri]
  );

  const setTextSegments = useCallback(
    (segments: TextSegment[]) => {
      setTextSegmentsState(segments);
      // Remove all existing text overlay operations
      videoElementsRef.current = videoElementsRef.current.filter(
        (e) => e.type !== 'addTextOverlay'
      );
      // Add new text overlay operations
      segments.forEach((segment) => {
        videoElementsRef.current.push({
          type: 'addTextOverlay',
          text: segment.text,
          fontSize: getFontSizeForVideo(segment.fontSize),
          textColor: segment.color,
          textOverlayColor: segment.backgroundColor,
          textPosition: {
            xAxis: segment?.x ?? 0,
            yAxis: segment?.y ?? 0,
          },
          startTime: segment.start,
          endTime: segment.end,
          screenWidth: PREVIEW_WIDTH,
          screenHeight: PREVIEW_HEIGHT,
        });
      });
    },
    [getFontSizeForVideo]
  );

  const addTextSegment = useCallback(
    (segment: TextSegment) => {
      setTextSegmentsState((prev) => [...prev, segment]);
      const operation = {
        type: 'addTextOverlay',
        text: segment.text,
        fontSize: getFontSizeForVideo(segment.fontSize),
        textColor: segment.color,
        textOverlayColor: segment.backgroundColor,
        textPosition: {
          xAxis: segment?.x ?? 0,
          yAxis: segment?.y ?? 0,
        },
        startTime: segment.start,
        endTime: segment.end,
        screenWidth: PREVIEW_WIDTH,
        screenHeight: PREVIEW_HEIGHT,
      };
      // Direct push for multiple text overlays
      videoElementsRef.current.push(operation);
    },
    [getFontSizeForVideo]
  );

  const updateTextSegment = useCallback(
    (segmentId: string, updates: Partial<TextSegment>) => {
      setTextSegmentsState((prev) => {
        const updated = prev.map((seg) =>
          seg.id === segmentId ? { ...seg, ...updates } : seg
        );
        // Remove all existing text overlay operations
        videoElementsRef.current = videoElementsRef.current.filter(
          (e) => e.type !== 'addTextOverlay'
        );
        // Rebuild all text overlay operations from state
        updated.forEach((segment) => {
          videoElementsRef.current.push({
            type: 'addTextOverlay',
            text: segment.text,
            fontSize: getFontSizeForVideo(segment.fontSize),
            textColor: segment.color,
            textOverlayColor: segment.backgroundColor,
            textPosition: {
              xAxis: segment?.x ?? 0,
              yAxis: segment?.y ?? 0,
            },
            startTime: segment.start,
            endTime: segment.end,
            screenWidth: PREVIEW_WIDTH,
            screenHeight: PREVIEW_HEIGHT,
          });
        });
        return updated;
      });
    },
    [getFontSizeForVideo]
  );

  const updateTextSegmentStart = useCallback(
    (segmentId: string, start: number) => {
      setTextSegmentsState((prev) => {
        const updated = prev.map((seg) =>
          seg.id === segmentId ? { ...seg, start } : seg
        );
        // Remove all existing text overlay operations
        videoElementsRef.current = videoElementsRef.current.filter(
          (e) => e.type !== 'addTextOverlay'
        );
        // Rebuild all text overlay operations from state
        updated.forEach((segment) => {
          videoElementsRef.current.push({
            type: 'addTextOverlay',
            text: segment.text,
            fontSize: getFontSizeForVideo(segment.fontSize),
            textColor: segment.color,
            textOverlayColor: segment.backgroundColor,
            textPosition: {
              xAxis: segment?.x ?? 0,
              yAxis: segment?.y ?? 0,
            },
            startTime: segment.start,
            endTime: segment.end,
            screenWidth: PREVIEW_WIDTH,
            screenHeight: PREVIEW_HEIGHT,
          });
        });
        return updated;
      });
    },
    [getFontSizeForVideo]
  );

  const updateTextSegmentEnd = useCallback(
    (segmentId: string, end: number) => {
      setTextSegmentsState((prev) => {
        const updated = prev.map((seg) =>
          seg.id === segmentId ? { ...seg, end } : seg
        );
        // Remove all existing text overlay operations
        videoElementsRef.current = videoElementsRef.current.filter(
          (e) => e.type !== 'addTextOverlay'
        );
        // Rebuild all text overlay operations from state
        updated.forEach((segment) => {
          videoElementsRef.current.push({
            type: 'addTextOverlay',
            text: segment.text,
            fontSize: getFontSizeForVideo(segment.fontSize),
            textColor: segment.color,
            textOverlayColor: segment.backgroundColor,
            textPosition: {
              xAxis: segment?.x ?? 0,
              yAxis: segment?.y ?? 0,
            },
            startTime: segment.start,
            endTime: segment.end,
            screenWidth: PREVIEW_WIDTH,
            screenHeight: PREVIEW_HEIGHT,
          });
        });
        return updated;
      });
    },
    [getFontSizeForVideo]
  );

  const removeTextSegment = useCallback(
    (segmentId: string) => {
      setTextSegmentsState((prev) => {
        const newSegments = prev.filter((seg) => seg.id !== segmentId);
        // Remove all existing text overlay operations
        videoElementsRef.current = videoElementsRef.current.filter(
          (e) => e.type !== 'addTextOverlay'
        );
        // Rebuild text overlay operations with remaining segments
        newSegments.forEach((segment) => {
          // Validate before adding operation
          if (segment.text && segment.text.trim() !== '') {
            videoElementsRef.current.push({
              type: 'addTextOverlay',
              text: segment.text,
              fontSize: getFontSizeForVideo(segment.fontSize),
              textColor: segment.color,
              textOverlayColor: segment.backgroundColor,
              textPosition: {
                xAxis: segment?.x ?? 0,
                yAxis: segment?.y ?? 0,
              },
              startTime: segment.start,
              endTime: segment.end,
              screenWidth: PREVIEW_WIDTH,
              screenHeight: PREVIEW_HEIGHT,
            });
          }
        });
        return newSegments;
      });
      // Clear active segment if it's the one being deleted
      setActiveSegment((prev) => {
        if (prev?.type === 'text' && prev?.id === segmentId) {
          return null;
        }
        return prev;
      });
    },
    [getFontSizeForVideo]
  );

  const setVoiceoverSegments = useCallback(
    (segments: VoiceoverSegment[]) => {
      setVoiceoverSegmentsState(segments);
      // Remove all existing voiceover operations
      videoElementsRef.current = videoElementsRef.current.filter(
        (e) => e.type !== 'addVoiceOver'
      );
      // Add new voiceover operations
      segments.forEach((segment) => {
        upsertOperation({
          type: 'addVoiceOver',
          voiceOverUri: segment.uri,
          startTime: segment.start,
          endTime: segment.end,
        });
      });
    },
    [upsertOperation]
  );

  const addVoiceoverSegment = useCallback((segment: VoiceoverSegment) => {
    setVoiceoverSegmentsState((prev) => [...prev, segment]);
    const operation = {
      type: 'addVoiceOver',
      voiceOverUri: segment.uri,
      startTime: segment.start,
      endTime: segment.end,
    };
    videoElementsRef.current.push(operation);
  }, []);

  const removeVoiceoverSegment = useCallback((segmentId: string) => {
    setVoiceoverSegmentsState((prev) => {
      const newSegments = prev.filter((seg) => seg.id !== segmentId);
      // Remove all existing voiceover operations
      videoElementsRef.current = videoElementsRef.current.filter(
        (e) => e.type !== 'addVoiceOver'
      );
      // Rebuild voiceover operations with remaining segments
      newSegments.forEach((segment) => {
        // Validate before adding operation
        if (segment.uri && segment.uri.trim() !== '') {
          videoElementsRef.current.push({
            type: 'addVoiceOver',
            voiceOverUri: segment.uri,
            startTime: segment.start,
            endTime: segment.end,
          });
        }
      });
      return newSegments;
    });

    // Clear active segment if it's the one being deleted
    setActiveSegment((prev) => {
      if (prev?.type === 'voiceover' && prev?.id === segmentId) {
        return null;
      }
      return prev;
    });
  }, []);

  // Build native export JSON
  const buildExportConfig = useCallback(() => {
    // Filter out invalid operations before passing to native
    const validElements = videoElementsRef.current.filter((element) => {
      // Validate audio operations
      if (element.type === 'audio') {
        if (!element.musicUri || element.musicUri.trim() === '') {
          console.warn('Skipping audio operation: musicUri is null or empty');
          return false;
        }
      }

      // Validate text overlay operations
      if (element.type === 'addTextOverlay') {
        if (!element.text || element.text.trim() === '') {
          console.warn('Skipping text overlay: text is empty');
          return false;
        }
        if (!element.textPosition) {
          console.warn('Skipping text overlay: textPosition is missing');
          return false;
        }
        if (element.startTime === undefined || element.endTime === undefined) {
          console.warn(
            'Skipping text overlay: startTime or endTime is missing'
          );
          return false;
        }
      }

      // Validate voiceover operations
      if (element.type === 'addVoiceOver') {
        if (!element.voiceOverUri || element.voiceOverUri.trim() === '') {
          console.warn('Skipping voiceover: voiceOverUri is null or empty');
          return false;
        }
      }

      // Validate crop operations
      if (element.type === 'crop') {
        if (
          element.selection_params === 'original' ||
          !element.selection_params
        ) {
          console.warn('Skipping crop: original ratio selected or empty');
          return false;
        }
      }

      // Validate trim operations
      if (element.type === 'trim') {
        if (element.startTime === undefined || element.endTime === undefined) {
          return false;
        }
      }

      return true;
    });

    return {
      videoElements: validElements,
    };
  }, []);
  // Reset editor
  const resetEditor = useCallback(() => {
    videoElementsRef.current = [];
    sourceRef.current = null;
    setCurrentTimeState(0);
    setDurationState(0);
  }, []);

  return (
    <EditorStateContext.Provider
      value={{
        initEditor,
        upsertOperation,
        removeOperation,
        buildExportConfig,
        resetEditor,
        setTrim,
        getTrim,
        cropRatio,
        setCropRatio,
        setCurrentTime,
        setDuration,
        setOriginalDuration,
        getPlaybackState,
        isScrubbing,
        startScrubbing,
        stopScrubbing,
        setAudioTrim,
        getAudioTrim,
        audioUri,
        setAudioUri,
        videoNaturalSize,
        setVideoNaturalSize,
        isPlaying,
        setIsPlaying,
        isTrimming,
        setIsTrimming,
        isDraggingHandle,
        setIsDraggingHandle,
        activeSegment,
        setActiveSegment,
        thumbnails,
        setThumbnails,
        isMuted,
        setIsMuted,
        videoRef,
        setVideoRef,
        audioSegments,
        setAudioSegments,
        addAudioSegment,
        removeAudioSegment,
        textSegments,
        setTextSegments,
        addTextSegment,
        updateTextSegment,
        updateTextSegmentStart,
        updateTextSegmentEnd,
        removeTextSegment,
        isTextEditorVisible,
        setIsTextEditorVisible,
        editingTextElement,
        setEditingTextElement,
        isTextDragging,
        setIsTextDragging,
        isTextPinching,
        setIsTextPinching,
        voiceoverSegments,
        setVoiceoverSegments,
        addVoiceoverSegment,
        removeVoiceoverSegment,
      }}
    >
      {children}
    </EditorStateContext.Provider>
  );
};

export const useEditorState = () => {
  const ctx = useContext(EditorStateContext);
  if (!ctx) {
    throw new Error('useEditorState must be used inside EditorStateProvider');
  }
  return ctx;
};
