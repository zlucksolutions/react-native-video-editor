import { View, Text, Pressable, StyleSheet, Alert, Modal } from 'react-native';
import { useState } from 'react';
import {
  openVideoEditor,
  VideoEditorHost,
} from 'react-native-video-editor';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Video from 'react-native-video';
import { pick, types } from '@react-native-documents/picker';

export default function App() {
  // State to store the selected video URI
  const [selectedVideoUri, setSelectedVideoUri] = useState<string | null>(null);
  // State to store the exported video URI
  const [exportedVideoUri, setExportedVideoUri] = useState<string | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);

  // Function to pick video from device
  const pickVideo = async () => {
    try {
      const result = await pick({
        type: [types.video],
        mode: 'open',
      });

      if (result && result.length > 0) {
        const pickedFile = result[0];
        const videoUri = pickedFile.uri;

        setSelectedVideoUri(videoUri);

        // Immediately open editor with selected video
        openEditorWithVideo(videoUri);
      }
    } catch (err: any) {
      // Check if user cancelled
      if (err?.message === 'User canceled document picker') {
      } else {
        Alert.alert('Error', 'Failed to pick video from device');
      }
    }
  };

  // Function to open editor with a video
  const openEditorWithVideo = async (videoUri: string) => {
    try {
      const result = await openVideoEditor({
        source: videoUri,
        editTrim: true,
        editCrop: true,
        editBGM: true,
        editTextOverlay: true,
        editVoiceOver: true,
      });

      // Check if editing was successful
      if (result.success && result.exportedUri) {
        // Store the exported video URI
        setExportedVideoUri(result.exportedUri);

        // Show success alert with the URI
        Alert.alert(
          'Video Exported Successfully!',
          `Video saved at:\n${result.exportedUri}`,
          [{ text: 'OK' }]
        );

        // Open the modal to play the video
        setIsModalVisible(true);
      } else if (!result.success) {
        Alert.alert('Export Failed', result.error || 'Unknown error');
      }
    } catch (e: any) {
      Alert.alert('Error', 'Failed to open video editor', e.message || e);
    }
  };

  return (
    <GestureHandlerRootView>
      <View style={styles.container}>
        <Text style={styles.appTitle}>Video Editor App</Text>

        {/* Button to pick video and open editor */}
        <Pressable style={styles.button} onPress={pickVideo}>
          <Text style={styles.buttonText}>📹 Pick Video & Edit</Text>
        </Pressable>

        {/* Display selected video info */}
        {selectedVideoUri && (
          <View style={styles.infoContainer}>
            <Text style={styles.infoTitle}>✓ Video Selected</Text>
            <Text style={styles.infoUri} numberOfLines={2}>
              {selectedVideoUri}
            </Text>
          </View>
        )}

        {/* Display exported video URI when available */}
        {exportedVideoUri && (
          <View style={styles.resultContainer}>
            <Text style={styles.resultTitle}>✅ Video Exported!</Text>
            <Text style={styles.resultUri} numberOfLines={3}>
              {exportedVideoUri}
            </Text>
            <Pressable
              style={styles.playButton}
              onPress={() => setIsModalVisible(true)}
            >
              <Text style={styles.playButtonText}>▶ Play Edited Video</Text>
            </Pressable>
          </View>
        )}

        <Modal
          visible={isModalVisible}
          animationType="slide"
          transparent={false}
          onRequestClose={() => setIsModalVisible(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edited Video</Text>
              <Pressable
                onPress={() => setIsModalVisible(false)}
                style={styles.closeButton}
              >
                <Text style={styles.closeButtonText}>✕ Close</Text>
              </Pressable>
            </View>

            {exportedVideoUri && (
              <Video
                source={{ uri: exportedVideoUri }}
                style={styles.video}
                resizeMode="contain"
                controls
                repeat
              />
            )}
          </View>
        </Modal>

        <VideoEditorHost />
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  appTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 30,
  },
  button: {
    marginTop: 20,
    paddingVertical: 14,
    paddingHorizontal: 24,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  infoContainer: {
    marginTop: 20,
    padding: 12,
    backgroundColor: '#e3f2fd',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2196F3',
    maxWidth: '90%',
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1976D2',
    marginBottom: 6,
  },
  infoUri: {
    fontSize: 11,
    color: '#555',
    fontFamily: 'monospace',
  },
  resultContainer: {
    marginTop: 20,
    padding: 16,
    backgroundColor: '#e8f5e9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4caf50',
    maxWidth: '90%',
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2e7d32',
    marginBottom: 8,
  },
  resultUri: {
    fontSize: 12,
    color: '#555',
    fontFamily: 'monospace',
    marginBottom: 12,
  },
  playButton: {
    backgroundColor: '#4caf50',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
  },
  playButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 50, // Safe area for notch
    backgroundColor: '#111',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 8,
    backgroundColor: '#333',
    borderRadius: 6,
  },
  closeButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  video: {
    flex: 1,
    width: '100%',
  },
});
