# react-native-video-editor-sdk

A **UI-based, native video editing SDK** for React Native.

This library provides a ready-to-use video editor UI (similar to social media editors) that allows users to trim, crop, add music, text overlays, and voice-overs — all powered by native iOS and Android implementations.

> **Important:**
> App developers do **not** need to construct JSON editing configurations.
> You simply open the editor, enable features via boolean flags, and receive the exported video.

---

## Features

* Built-in video editor UI
* Trim video
* Crop / change aspect ratio
* Add background music (BGM)
* Add text overlays
* Add voice-over
* Automatic audio ducking
* Native export to device storage
* Event-driven editor lifecycle

---

## Installation

### 1. Install the library

```sh
npm install react-native-video-editor-sdk
```

or

```sh
yarn add react-native-video-editor-sdk
```

---

### 2. Install required peer dependencies

This SDK relies on several React Native libraries that **must be installed by the host app**:

```sh
npm install \
react-native-gesture-handler \
react-native-reanimated \
react-native-worklets \
react-native-video \
@react-native-documents/picker \
react-native-safe-area-context \
react-native-permissions \
react-native-fast-image \
react-native-fs \
react-native-linear-gradient \
react-native-size-matters \
react-native-create-thumbnail
```

---

### 3. iOS setup

```sh
cd ios
pod install
```

---

### 4. Wrap your app with `GestureHandlerRootView`

This step is **mandatory**.

```tsx
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* Your app root */}
    </GestureHandlerRootView>
  );
}
```

---

### 5. Enable `react-native-worklets` Babel plugin

Update your `babel.config.js`:

```js
/** @type {import('react-native-worklets/plugin').PluginOptions} */
const workletsPluginOptions = {};

module.exports = {
  overrides: [
    {
      exclude: /\/node_modules\//,
      presets: ['module:react-native-builder-bob/babel-preset'],
      plugins: [['react-native-worklets/plugin', workletsPluginOptions]],
    },
    {
      include: /\/node_modules\//,
      presets: ['module:@react-native/babel-preset'],
    },
  ],
};
```

Restart Metro after updating Babel config:

```sh
npx react-native start --reset-cache
```

---

## Usage

### Imports

```ts
import {
  openVideoEditor,
  VideoEditorHost,
} from 'react-native-video-editor-sdk';
```

---

## Opening the Video Editor

```ts
const result = await openVideoEditor({
  source: videoUri,
  editTrim: true,
  editCrop: true,
  editBGM: true,
  editTextOverlay: true,
  editVoiceOver: true,
});
```

### Result

```ts
{
  success: boolean;
  exportedUri?: string;
  error?: string;
}
```

---

## Minimal Example

```tsx
import { View, Button, Alert } from 'react-native';
import {
  openVideoEditor,
  VideoEditorHost,
} from 'react-native-video-editor-sdk';

export default function Example() {
  const openEditor = async () => {
    const result = await openVideoEditor({
      source: 'file:///path/to/video.mp4',
      editTrim: true,
      editCrop: true,
      editBGM: true,
      editTextOverlay: true,
      editVoiceOver: true,
    });

    if (result.success && result.exportedUri) {
      Alert.alert('Video exported', result.exportedUri);
    } else {
      Alert.alert('Editor failed', result.error ?? 'Unknown error');
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Button title="Open Video Editor" onPress={openEditor} />

      {/* REQUIRED: mount editor host once */}
      <VideoEditorHost />
    </View>
  );
}
```

---

## `VideoEditorHost` (Required)

`VideoEditorHost` must be rendered **once** in your app (preferably near the root). It is responsible for rendering the native editor UI and managing its lifecycle.

```tsx
<VideoEditorHost />
```

---

## Platform Support

* iOS: ✅ Fully supported
* Android: ✅ Fully supported

---

## Example App

A fully working example app is available in the `example` directory.

```sh
cd example
yarn install
cd ios && pod install
yarn ios
```

---

## Contributing

* Development workflow: `CONTRIBUTING.md`
* Code of conduct: `CODE_OF_CONDUCT.md`

---

## License

MIT

---

Built with [create-react-native-library](https://github.com/callstack/react-native-builder-bob)
