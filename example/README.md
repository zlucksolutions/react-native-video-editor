# Video Editor SDK – Example App

This is the **example application** for the `react-native-video-editor`.

It demonstrates how to:

* Integrate the SDK into a React Native app
* Pick a video from the device
* Open the built-in video editor UI
* Enable editing features via boolean flags
* Receive and preview the exported video

This app is intended **for development and testing only**. End users of the SDK do **not** need this example app.

---

## Prerequisites

Before running the example app, make sure you have completed the official React Native environment setup:

👉 [https://reactnative.dev/docs/set-up-your-environment](https://reactnative.dev/docs/set-up-your-environment)

Required tools:

* Node.js (see root `.nvmrc`)
* Yarn (recommended)
* Xcode (for iOS)
* Android Studio (for Android)

---

## Install Dependencies

From the **root of the repository**:

```sh
yarn
```

This installs dependencies for both:

* the SDK (root package)
* the example app (`example/`)

---

## iOS Setup

Navigate to the iOS directory of the example app:

```sh
cd example/ios
pod install
```

Then go back to the root:

```sh
cd ../..
```

---

## Running the Example App

### Start Metro

From the root directory:

```sh
yarn example start
```

---

### Run on iOS

In a new terminal (from the root directory):

```sh
yarn example ios
```

---

### Run on Android

Make sure an emulator or device is connected, then:

```sh
yarn example android
```

---

## What This Example Demonstrates

The example app shows how to use the SDK with **minimal setup**:

* Wrap the app with `GestureHandlerRootView`
* Render `VideoEditorHost` once at the root
* Call `openVideoEditor()` with feature flags

### Core Usage Pattern

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

If editing is successful, the SDK returns the exported video URI, which the example app plays using `react-native-video`.

---

## File Overview

Key files in the example app:

* `App.tsx`

  * Picks a video from the device
  * Opens the video editor
  * Displays and plays the exported video

* `VideoEditorHost`

  * Mounted once to host the native editor UI

---

## Notes

* Native code changes **require rebuilding** the app
* JavaScript/TypeScript changes hot-reload automatically
* This app uses the local SDK source via Yarn workspaces

---

## Troubleshooting

If you encounter issues:

* Clear Metro cache:

  ```sh
  npx react-native start --reset-cache
  ```
* Reinstall pods:

  ```sh
  cd example/ios && pod install
  ```
* Ensure all peer dependencies listed in the root README are installed

---

## Learn More

* SDK documentation: `../README.md`
* React Native docs: [https://reactnative.dev](https://reactnative.dev)

---

**This example app is for demonstration and development purposes only.**
