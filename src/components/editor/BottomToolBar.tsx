// @ts-ignore - Peer dependency
import { View, Text, Pressable, FlatList, Image } from 'react-native';
import React, { useRef, useCallback } from 'react';
// @ts-ignore - Peer dependency
import { ScaledSheet } from 'react-native-size-matters';
// @ts-ignore - Peer dependency
import LinearGradient from 'react-native-linear-gradient';
import { useEditorContext } from '../../context/EditorContext';
import { useEditorState } from '../../context/EditorStateContext';
import type { EditorTool } from '../../context/EditorContext';
import { CAPTION_BG_COLORS, COLORS } from '../../constants/colors';
import {
  pick,
  keepLocalCopy,
  types,
  // @ts-ignore - Peer dependency
} from '@react-native-documents/picker';
// @ts-ignore - Peer dependency
import {
  MusicIcon,
  TextIcon,
  CropIcon,
  TrimIcon,
  MicOutline,
  DownloadIcon,
  // @ts-ignore - Peer dependency
} from '../../assets/icons/index.js';

const TOOLS: { id: EditorTool; label: string; icon: any }[] = [
  { id: 'bgm', label: 'Music', icon: MusicIcon },
  { id: 'text', label: 'Text', icon: TextIcon },
  { id: 'crop', label: 'Crop', icon: CropIcon },
  { id: 'trim', label: 'Trim', icon: TrimIcon },
  { id: 'voiceover', label: 'Voice', icon: MicOutline },
  { id: 'save', label: 'Save', icon: DownloadIcon },
];

type BottomToolBarProps = {
  onToolPress?: () => void;
  onExport?: () => void;
};

type ToolItemProps = {
  tool: (typeof TOOLS)[0];
  isEnabled: boolean;
  isSelected: boolean;
  onPress: (id: EditorTool) => void;
};

const ToolItem = React.memo(
  ({ tool, isEnabled, isSelected, onPress }: ToolItemProps) => {
    if (!isEnabled && tool.id !== 'save') return null;

    return (
      <Pressable
        onPress={() => onPress(tool.id)}
        style={[styles.toolCard, isSelected && styles.toolCardSelected]}
      >
        <LinearGradient
          colors={
            isSelected
              ? COLORS.PRIMARY_GRADIENT
              : ['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.1)']
          }
          style={styles.toolIconContainer}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Image
            style={styles.toolIconText}
            source={tool.icon}
            tintColor="#fff"
          />
        </LinearGradient>
        <Text style={styles.toolLabel}>{tool.label}</Text>
      </Pressable>
    );
  }
);

export const BottomToolBar = React.memo(
  ({ onToolPress, onExport }: BottomToolBarProps) => {
    const { setActiveTool, enabledTools, activeTool } = useEditorContext();
    const {
      setAudioUri,
      setActiveSegment,
      setIsTextEditorVisible,
      setEditingTextElement,
      isPlaying,
      setIsPlaying,
    } = useEditorState();

    const wasPlayingBeforePickerRef = useRef(false);

    const handleBGMPress = useCallback(async () => {
      try {
        // Store previous playing state before pausing
        wasPlayingBeforePickerRef.current = isPlaying;

        if (isPlaying) {
          setIsPlaying(false);
        }

        const [pickResult] = await pick({
          type: [types.audio],
          allowMultiSelection: false,
        });

        const selectedFile = [pickResult]?.[0];

        if (selectedFile) {
          try {
            const [localCopy] = await keepLocalCopy({
              files: [
                {
                  uri: selectedFile.uri,
                  fileName: selectedFile.name ?? 'audio',
                },
              ],
              destination: 'cachesDirectory',
            });

            const audioUriToUse =
              localCopy?.localUri || localCopy?.uri || selectedFile.uri;

            if (audioUriToUse) {
              setAudioUri(audioUriToUse);
              setActiveTool('bgm');
              return;
            }
          } catch (copyErr: any) {
            console.warn('Failed to create local copy:', copyErr);
            if (selectedFile.uri) {
              setAudioUri(selectedFile.uri);
              setActiveTool('bgm');
              return;
            }
          }
        }

        if (wasPlayingBeforePickerRef.current) {
          setIsPlaying(true);
        }
      } catch (err: any) {
        // Handle cancellation manually as isCancel might be undefined
        const isCancelled =
          err?.code === 'DOCUMENT_PICKER_CANCELED' ||
          err?.message === 'User canceled document picker';

        if (isCancelled) {
          if (wasPlayingBeforePickerRef.current) {
            setIsPlaying(true);
          }
        } else {
          // console.error('Audio picker error:', err);
          if (wasPlayingBeforePickerRef.current) {
            setIsPlaying(true);
          }
        }
      }
    }, [isPlaying, setIsPlaying, setAudioUri, setActiveTool]);

    const handlePress = useCallback(
      (toolId: EditorTool) => {
        onToolPress?.();

        if (toolId === 'bgm') {
          handleBGMPress();
        } else if (toolId === 'text') {
          setEditingTextElement(null);
          setIsTextEditorVisible(true);
          if (isPlaying) setIsPlaying(false);
          setActiveTool('text');
        } else if (toolId === 'save') {
          // Trigger export
          onExport?.();
        } else {
          if (toolId === 'trim') {
            setActiveSegment({ type: 'trim' });
          }
          setActiveTool(activeTool === toolId ? null : toolId);
        }
      },
      [
        onToolPress,
        handleBGMPress,
        setEditingTextElement,
        setIsTextEditorVisible,
        isPlaying,
        setIsPlaying,
        setActiveTool,
        setActiveSegment,
        activeTool,
        onExport,
      ]
    );

    const renderToolItem = useCallback(
      ({ item: tool }: { item: (typeof TOOLS)[0] }) => {
        return (
          <ToolItem
            tool={tool}
            isEnabled={enabledTools[tool.id] ?? true}
            isSelected={activeTool === tool.id}
            onPress={handlePress}
          />
        );
      },
      [enabledTools, activeTool, handlePress]
    );

    const keyExtractor = useCallback((item: any) => item.id, []);

    return (
      <View style={styles.container}>
        <FlatList
          data={TOOLS}
          renderItem={renderToolItem}
          keyExtractor={keyExtractor}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.toolsList}
        />
      </View>
    );
  }
);

const styles = ScaledSheet.create({
  container: {
    height: '100@ms',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  toolsList: {
    paddingHorizontal: '12@ms',
    alignItems: 'center',
  },
  toolCard: {
    alignItems: 'center',
    marginHorizontal: '4@ms',
    padding: '8@ms',
    minWidth: '70@ms',
  },
  toolCardSelected: {
    backgroundColor: CAPTION_BG_COLORS[2],
    borderWidth: 1,
    borderColor: 'white',
    borderRadius: '12@ms',
  },
  toolIconContainer: {
    width: '48@ms',
    height: '48@ms',
    borderRadius: '24@ms',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: '8@ms',
  },
  toolIconText: {
    width: '24@ms',
    height: '24@ms',
    resizeMode: 'contain',
  },
  toolLabel: {
    color: '#fff',
    fontSize: '11@ms',
    textAlign: 'center',
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
});
