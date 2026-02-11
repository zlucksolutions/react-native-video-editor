// @ts-ignore - Peer dependency
import { View, Text, Pressable, FlatList, Image } from 'react-native';
import { useRef } from 'react';
// @ts-ignore - Peer dependency
import { ScaledSheet } from 'react-native-size-matters';
// @ts-ignore - Peer dependency
import LinearGradient from 'react-native-linear-gradient';
import { useEditorContext } from '../../context/EditorContext';
import { useEditorState } from '../../context/EditorStateContext';
import type { EditorTool } from '../../context/EditorContext';
import { CAPTION_BG_COLORS, COLORS } from '../../constants/colors';
// @ts-ignore - Peer dependency
import { pick, keepLocalCopy, types } from '@react-native-documents/picker';
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

export const BottomToolBar = ({
  onToolPress,
  onExport,
}: BottomToolBarProps) => {
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

  const handleBGMPress = async () => {
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

      if (pickResult) {
        try {
          const [localCopy] = await keepLocalCopy({
            files: [
              {
                uri: pickResult.uri,
                fileName: pickResult.name ?? 'audio',
              },
            ],
            destination: 'cachesDirectory',
          });

          const audioUriToUse =
            localCopy?.localUri || localCopy?.uri || pickResult.uri;

          if (audioUriToUse) {
            setAudioUri(audioUriToUse);
            setActiveTool('bgm');
            return;
          }
        } catch (copyErr: any) {
          console.warn('Failed to create local copy:', copyErr);
          if (pickResult.uri) {
            setAudioUri(pickResult.uri);
            setActiveTool('bgm');
            return;
          }
        }
      }

      if (wasPlayingBeforePickerRef.current) {
        setIsPlaying(true);
      }
    } catch (err: any) {
      console.error('Error picking audio:', err);
      if (err?.code === 'DOCUMENT_PICKER_CANCELED') {
        if (wasPlayingBeforePickerRef.current) {
          setIsPlaying(true);
        }
      } else {
        console.error('Audio picker error details:', err);
        if (wasPlayingBeforePickerRef.current) {
          setIsPlaying(true);
        }
      }
    }
  };

  const renderToolItem = ({ item: tool }: { item: (typeof TOOLS)[0] }) => {
    const isEnabled = enabledTools[tool.id] ?? true;
    if (!isEnabled && tool.id !== 'save') return null;

    const isSelected = activeTool === tool.id;

    const handlePress = () => {
      onToolPress?.();

      if (tool.id === 'bgm') {
        handleBGMPress();
      } else if (tool.id === 'text') {
        setEditingTextElement(null);
        setIsTextEditorVisible(true);
        if (isPlaying) setIsPlaying(false);
        setActiveTool('text');
      } else if (tool.id === 'save') {
        // Trigger export
        onExport?.();
      } else {
        if (tool.id === 'trim') {
          setActiveSegment({ type: 'trim' });
        }
        setActiveTool(isSelected ? null : tool.id);
      }
    };

    return (
      <Pressable
        onPress={handlePress}
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
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={TOOLS}
        renderItem={renderToolItem}
        keyExtractor={(item: any) => item.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.toolsList}
      />
    </View>
  );
};

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
