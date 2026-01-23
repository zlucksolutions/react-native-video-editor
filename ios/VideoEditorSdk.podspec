Pod::Spec.new do |s|
  s.name         = "VideoEditorSdk"
  s.version      = "0.1.0"
  s.summary      = "React Native Video Editor SDK"
  s.description  = "A cross-platform video editor SDK for React Native with native Media3 and AVFoundation processing."

  s.platforms    = { :ios => "13.0" }
  s.source       = { :git => "https://github.com/zlucksolutions/react-native-video-editor.git", :tag => s.version }

  s.source_files = "ios/**/*.{h,m,mm,swift}"

  s.dependency "React-Core"

  s.swift_version = "5.0"
end
