import AVFoundation
import Foundation
import Photos
import React
import UIKit
import UniformTypeIdentifiers

// MARK: - Error & Logging
enum VideoEditingError: Error {
  case invalidJSON
  case invalidURL
  case invalidVideoTrack
  case invalidRange
  case readerFailed(String)
  case writerFailed(String)
  case exportFailed(String)
  case missingParameter(String)
}

private func makeNSError(_ error: VideoEditingError, underlying: Error? = nil) -> NSError {
  let domain = "VideoEditing"
  let (code, message): (Int, String) = {
    switch error {
    case .invalidJSON: return (1001, "Invalid JSON configuration")
    case .invalidURL: return (1002, "Invalid URL")
    case .invalidVideoTrack: return (1003, "Invalid or missing video track")
    case .invalidRange: return (1004, "Invalid time range")
    case .readerFailed(let msg): return (1005, "Reader failed: \(msg)")
    case .writerFailed(let msg): return (1006, "Writer failed: \(msg)")
    case .exportFailed(let msg): return (1007, "Export failed: \(msg)")
    case .missingParameter(let name): return (1008, "Missing parameter: \(name)")
    }
  }()

  var userInfo: [String: Any] = [NSLocalizedDescriptionKey: message]
  if let underlying = underlying {
    userInfo[NSUnderlyingErrorKey] = underlying
  }
  return NSError(domain: domain, code: code, userInfo: userInfo)
}

private func logEvent(_ name: String, _ fields: [String: Any]) {
  var payload = fields
  payload["event"] = name
  if let data = try? JSONSerialization.data(withJSONObject: payload, options: [.prettyPrinted]),
     let string = String(data: data, encoding: .utf8) {
    print("📋 \(string)")
  } else {
    print("📋 \(name): \(fields)")
  }
}

// MARK: - Time helpers
private let kPreferredTimescale: CMTimeScale = 600

@inline(__always)
private func secondsToCMTime(_ seconds: Double) -> CMTime {
  let clamped = max(seconds, 0)
  return CMTime(seconds: clamped, preferredTimescale: kPreferredTimescale)
}

@inline(__always)
private func msToCMTime(_ milliseconds: Double) -> CMTime {
  return secondsToCMTime(milliseconds / 1000.0)
}

private func clampTimeRange(
  start: Double,
  end: Double,
  durationSeconds: Double
) -> (start: Double, end: Double)? {
  guard durationSeconds > 0 else { return nil }
  let clampedStart = max(0, min(start, durationSeconds))
  let clampedEnd = max(clampedStart, min(end, durationSeconds))
  guard clampedEnd > clampedStart else { return nil }
  return (clampedStart, clampedEnd)
}

private func estimatedVideoBitrate(for asset: AVAsset) -> Double? {
  guard let rate = asset.tracks(withMediaType: .video).first?.estimatedDataRate else {
    return nil
  }
  return Double(rate)
}

// MARK: - Video Editing Configuration Models
struct VideoEditingConfig: Codable {
  let videoElements: [VideoElement]
  let isVisionCameraVideo: Bool?
}

struct VideoElement: Codable {
  let type: String
  let uri: String?
  let muted: Bool?

  // Trim parameters
  let startTime: Double?
  let endTime: Double?

  // Crop parameters
  let selection_params: String?

  // BGM parameters
  let musicUri: String?
  let audioOffset: Double?
  let isLooped: Bool?

  // Text overlay parameters
  let text: String?
  let fontSize: Double?
  let fontFamily: String?
  let textColor: String?
  let textOverlayColor: String?
  let textPosition: TextPosition?
  let screenWidth: Double?
  let screenHeight: Double?

  // Subtitle parameters
  // let subtitleJson: [SubtitleEntry]?
  // let subtitleSize: Double?
  // let subtitlePosition: String?
  // let subtitleOverlayColor: String?
  // let subtitleColor: String?

  // Voice over parameters
  let voiceOverUri: String?
}

struct TextPosition: Codable {
  let xAxis: Double
  let yAxis: Double
}

// struct SubtitleEntry: Codable {
//   let start: Double
//   let end: Double
//   let text: String
// }

struct VideoInfo {
  let renderSize: CGSize
  let transform: CGAffineTransform
  let isProcessed: Bool
  let duration: CMTime
}

// Add after VideoInfo struct
struct VideoQualitySettings {
  static func videoSettings(for renderSize: CGSize, sourceBitrate: Double? = nil) -> [String: Any] {
    let optimal = Double(calculateOptimalBitrate(for: renderSize))
    // Use source bitrate if available (preserves original quality); fall back to resolution-based optimal
    let target = sourceBitrate ?? optimal
    let bitrate = Int(max(500_000, target))

    return [
      AVVideoCodecKey: AVVideoCodecType.h264,
      AVVideoWidthKey: Int(renderSize.width),
      AVVideoHeightKey: Int(renderSize.height),
      AVVideoCompressionPropertiesKey: [
        AVVideoAverageBitRateKey: bitrate,
        AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel,
        AVVideoMaxKeyFrameIntervalKey: 30,
      ],
    ]
  }

  static func audioSettings() -> [String: Any] {
    return [
      AVFormatIDKey: kAudioFormatMPEG4AAC,
      AVSampleRateKey: 44100,
      AVNumberOfChannelsKey: 2,
      AVEncoderBitRateKey: 256_000,
      AVEncoderAudioQualityKey: AVAudioQuality.high.rawValue,
    ]
  }

  static func nominalFrameDuration(for track: AVAssetTrack) -> CMTime {
    let fps = track.nominalFrameRate
    let validFps = (fps.isNaN || fps <= 0) ? 30.0 : fps
    // Round to nearest common frame rate to avoid floating-point drift
    let rounded = (validFps * 100).rounded() / 100
    return CMTimeMake(value: 1, timescale: CMTimeScale(rounded))
  }

  static func calculateOptimalBitrate(for size: CGSize) -> Int {
    let pixels = size.width * size.height

    switch pixels {
    case 0..<(720 * 480):  // SD
      return 2_500_000  // 2.5 Mbps
    case (720 * 480)..<(1280 * 720):  // HD
      return 5_000_000  // 5 Mbps
    case (1280 * 720)..<(1920 * 1080):  // Full HD
      return 10_000_000  // 10 Mbps
    case (1920 * 1080)..<(3840 * 2160):  // 4K
      return 20_000_000  // 20 Mbps
    default:  // Higher than 4K
      return 30_000_000  // 30 Mbps
    }
  }
}

extension UIColor {
  convenience init?(hexString: String) {
    var hexSanitized = hexString.trimmingCharacters(in: .whitespacesAndNewlines)
    hexSanitized = hexSanitized.replacingOccurrences(of: "#", with: "")

    var rgb: UInt64 = 0
    var r: CGFloat = 0.0
    var g: CGFloat = 0.0
    var b: CGFloat = 0.0
    var a: CGFloat = 1.0

    let length = hexSanitized.count
    guard Scanner(string: hexSanitized).scanHexInt64(&rgb) else { return nil }

    if length == 6 {
      r = CGFloat((rgb & 0xFF0000) >> 16) / 255.0
      g = CGFloat((rgb & 0x00FF00) >> 8) / 255.0
      b = CGFloat(rgb & 0x0000FF) / 255.0
    } else if length == 8 {
      r = CGFloat((rgb & 0xFF00_0000) >> 24) / 255.0
      g = CGFloat((rgb & 0x00FF_0000) >> 16) / 255.0
      b = CGFloat((rgb & 0x0000_FF00) >> 8) / 255.0
      a = CGFloat(rgb & 0x0000_00FF) / 255.0
    } else {
      return nil
    }
    self.init(red: r, green: g, blue: b, alpha: a)
  }
}

@objc(VideoEditorSdk)
class VideoEditorSdk: NSObject {

  private var originalVideoUri: String?
  private var isVisionCameraVideo: Bool = false
  private var hasAppliedManualTransform: Bool = false
  /// Bitrate of the original imported video, captured once before any processing begins.
  /// Passed through every export step so intermediate re-encodes never degrade quality.
  private var originalVideoBitrate: Double?

  private func getOriginalVideoPath() -> String? {
    return originalVideoUri
  }

  @objc(setOriginalVideoPath:)
  func setOriginalVideoPath(_ path: String) {
    originalVideoUri = path
  }

  private func getVideoInfo(from videoPath: String) -> VideoInfo? {
    guard let videoURL = URL(string: videoPath) else { return nil }

    let asset = AVAsset(url: videoURL)
    guard let videoTrack = asset.tracks(withMediaType: .video).first else { return nil }

    let preferredTransform = videoTrack.preferredTransform
    let naturalSize = videoTrack.naturalSize

    let transformedSize = naturalSize.applying(preferredTransform)
    let renderSize = CGSize(width: abs(transformedSize.width), height: abs(transformedSize.height))

    return VideoInfo(
      renderSize: renderSize,
      transform: preferredTransform,
      isProcessed: isProcessedVideo(videoPath),
      duration: asset.duration
    )
  }

  private func isLandscapeVideo(videoUri: String) -> Bool {
    guard let videoURL = URL(string: videoUri) else { return false }
    let asset = AVAsset(url: videoURL)
    guard let videoTrack = asset.tracks(withMediaType: .video).first else { return false }

    let naturalSize = videoTrack.naturalSize
    let transform = videoTrack.preferredTransform
    let transformedSize = naturalSize.applying(transform)

    let width = abs(transformedSize.width)
    let height = abs(transformedSize.height)

    return width >= height
  }

  private func isProcessedVideo(_ videoPath: String) -> Bool {
    let tempDir = getTempDirectory()
    guard let videoURL = URL(string: videoPath) else { return false }
    return videoURL.path.contains(tempDir.path)
  }

  private func setupAudioSession() {
    do {
      try AVAudioSession.sharedInstance().setCategory(.playback, mode: .default, options: [.allowAirPlay, .allowBluetooth, .allowBluetoothA2DP])

      try AVAudioSession.sharedInstance().setActive(true)
    } catch {
      print("Failed to setup audio session: \(error)")
    }
  }

  private func validateVideoTrack(_ asset: AVAsset) -> Bool {
    guard let videoTrack = asset.tracks(withMediaType: .video).first else {
      return false
    }

    let naturalSize = videoTrack.naturalSize
    let transform = videoTrack.preferredTransform

    // Check if video has valid dimensions
    if naturalSize.width <= 0 || naturalSize.height <= 0 {
      return false
    }

    // Check if the transformed size is valid
    let transformedSize = naturalSize.applying(transform)
    if abs(transformedSize.width) <= 0 || abs(transformedSize.height) <= 0 {
      return false
    }
    return true
  }

  @objc(cleanupTempFiles)
  func cleanupTempFiles() {
    cleanupTemp()
  }

  private func getTempDirectory() -> URL {
    let cacheDirectory = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first!
    let tempDir = cacheDirectory.appendingPathComponent("video_editing")

    if !FileManager.default.fileExists(atPath: tempDir.path) {
      try? FileManager.default.createDirectory(at: tempDir, withIntermediateDirectories: true, attributes: nil)
    }
    return tempDir
  }

  private func generateTempFileName() -> String {
    return "temp_\(UUID().uuidString).mp4"
  }

  private func exportWithAssetWriter(
    asset: AVAsset,
    videoComposition: AVMutableVideoComposition?,
    audioMix: AVMutableAudioMix? = nil,
    outputURL: URL,
    sourceBitrate: Double? = nil,
    completion: @escaping (Result<URL, Error>) -> Void
  ) {
    if FileManager.default.fileExists(atPath: outputURL.path) {
      try? FileManager.default.removeItem(at: outputURL)
    }

    guard let videoTrack = asset.tracks(withMediaType: .video).first else {
      completion(.failure(makeNSError(.invalidVideoTrack)))
      return
    }

    let naturalSize = videoTrack.naturalSize
    let renderSize = videoComposition?.renderSize ?? naturalSize

    // Setup reader
    guard let reader = try? AVAssetReader(asset: asset) else {
      completion(.failure(makeNSError(.readerFailed("Failed to create reader"))))
      return
    }

    let readerVideoOutput = AVAssetReaderVideoCompositionOutput(
      videoTracks: [videoTrack],
      videoSettings: [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA]
    )
    readerVideoOutput.videoComposition = videoComposition
    readerVideoOutput.alwaysCopiesSampleData = false

    guard reader.canAdd(readerVideoOutput) else {
      completion(.failure(makeNSError(.readerFailed("Cannot add video output"))))
      return
    }
    reader.add(readerVideoOutput)

    let audioTracks = asset.tracks(withMediaType: .audio)
    var readerAudioOutput: AVAssetReaderAudioMixOutput?

    if !audioTracks.isEmpty {
      readerAudioOutput = AVAssetReaderAudioMixOutput(
        audioTracks: audioTracks,  // Pass ALL tracks
        audioSettings: nil
      )
      if let audioMix = audioMix {
        readerAudioOutput!.audioMix = audioMix
        print("🎚️ Audio mix applied to reader")
      }
      readerAudioOutput!.alwaysCopiesSampleData = false
      if reader.canAdd(readerAudioOutput!) {
        reader.add(readerAudioOutput!)
      }
    }

    // Setup writer
    guard let writer = try? AVAssetWriter(outputURL: outputURL, fileType: .mp4) else {
      completion(.failure(makeNSError(.writerFailed("Failed to create writer"))))
      return
    }

    let videoSettings = VideoQualitySettings.videoSettings(for: renderSize, sourceBitrate: sourceBitrate)

    let videoInput = AVAssetWriterInput(mediaType: .video, outputSettings: videoSettings)
    videoInput.expectsMediaDataInRealTime = false
    writer.add(videoInput)

    var audioInput: AVAssetWriterInput?
    if readerAudioOutput != nil {
      let audioSettings = VideoQualitySettings.audioSettings()
      audioInput = AVAssetWriterInput(mediaType: .audio, outputSettings: audioSettings)
      audioInput!.expectsMediaDataInRealTime = false
      writer.add(audioInput!)
    }

    // Start writing and reading
    writer.startWriting()
    guard reader.startReading() else {
      completion(.failure(reader.error ?? NSError(domain: "VideoEditing", code: -2, userInfo: [NSLocalizedDescriptionKey: "Failed to start reading"])))
      return
    }
    writer.startSession(atSourceTime: .zero)

    let group = DispatchGroup()

    // Video processing
    group.enter()
    let videoQueue = DispatchQueue(label: "videoQueue")
    videoInput.requestMediaDataWhenReady(on: videoQueue) {
      while videoInput.isReadyForMoreMediaData {
        guard reader.status == .reading else {
          videoInput.markAsFinished()
          group.leave()
          break
        }

        if let sample = readerVideoOutput.copyNextSampleBuffer() {
          if !videoInput.append(sample) {
            print("Failed to append video sample")
          }
        } else {
          videoInput.markAsFinished()
          group.leave()
          break
        }
      }
    }

    // Audio processing
    if let readerAudioOutput = readerAudioOutput, let audioInput = audioInput {
      group.enter()
      let audioQueue = DispatchQueue(label: "audioQueue")
      audioInput.requestMediaDataWhenReady(on: audioQueue) {
        while audioInput.isReadyForMoreMediaData {
          guard reader.status == .reading else {
            audioInput.markAsFinished()
            group.leave()
            break
          }

          if let sample = readerAudioOutput.copyNextSampleBuffer() {
            if !audioInput.append(sample) {
              print("Failed to append audio sample")
            }
          } else {
            audioInput.markAsFinished()
            group.leave()
            break
          }
        }
      }
    }

    group.notify(queue: .main) {
      writer.finishWriting {
        if writer.status == .completed {
          logEvent("export_completed", [
            "output": outputURL.absoluteString,
            "bitrate": VideoQualitySettings.calculateOptimalBitrate(for: renderSize),
            "renderWidth": renderSize.width,
            "renderHeight": renderSize.height,
            "sourceBitrate": sourceBitrate ?? -1
          ])
          completion(.success(outputURL))
        } else {
          completion(.failure(makeNSError(.writerFailed(writer.error?.localizedDescription ?? "Export failed"), underlying: writer.error)))
        }
      }
    }
  }

  private func createHighQualityExportSession(
    asset: AVAsset,
    composition: AVMutableComposition? = nil,
    videoComposition: AVMutableVideoComposition?,
    outputURL: URL
  ) -> AVAssetExportSession? {

    let assetToExport = composition ?? asset
    // Prefer HEVC when supported, fall back to HighestQuality
    let preset = AVAssetExportSession.allExportPresets().contains(AVAssetExportPresetHEVCHighestQuality)
      ? AVAssetExportPresetHEVCHighestQuality
      : AVAssetExportPresetHighestQuality

    guard let exportSession = AVAssetExportSession(asset: assetToExport, presetName: preset) else { return nil }

    exportSession.outputURL = outputURL
    exportSession.videoComposition = videoComposition

    // Determine the best output format
    if exportSession.supportedFileTypes.contains(.mp4) {
      exportSession.outputFileType = .mp4
    } else if exportSession.supportedFileTypes.contains(.mov) {
      exportSession.outputFileType = .mov
    } else {
      exportSession.outputFileType = exportSession.supportedFileTypes.first!
    }

    exportSession.shouldOptimizeForNetworkUse = true
    return exportSession
  }

  private func applyPortraitOverlayOperation(
    videoUri: String, completion: @escaping (Result<String, Error>) -> Void
  ) {
    print("VideoEditing: Applying portrait overlay to landscape video")
    let tempFileName = generateTempFileName()

    overlayOnPortraitLayer(videoUri, outputFileName: tempFileName) { result in
      switch result {
      case .success(let newVideoUri):
        print("VideoEditing: Portrait overlay completed - \(newVideoUri)")
        completion(.success(newVideoUri))
      case .failure(let error):
        print("VideoEditing: Portrait overlay failed - \(error.localizedDescription)")
        completion(.failure(error))
      }
    }
  }

  // MARK: - New Comprehensive Video Editing Method
  @objc(applyEdits:resolve:reject:)
  func applyEdits(
    _ editingConfigJson: NSDictionary,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    print("🎬 [VideoEditing] Starting comprehensive video processing")

    hasAppliedManualTransform = false
    guard let jsonData = try? JSONSerialization.data(withJSONObject: editingConfigJson, options: []) else {
      hasAppliedManualTransform = false
      let err = makeNSError(.invalidJSON)
      reject("E_INVALID_JSON", err.localizedDescription, err)
      return
    }
    let config: VideoEditingConfig
    do {
      config = try JSONDecoder().decode(VideoEditingConfig.self, from: jsonData)
    } catch {
      let err = makeNSError(.invalidJSON, underlying: error)
      reject("E_JSON_DECODE", err.localizedDescription, err)
      return
    }

    self.isVisionCameraVideo = config.isVisionCameraVideo ?? false
    print("📹 [VideoEditing] Vision camera video: \(self.isVisionCameraVideo)")

    guard let sourceVideoElement = config.videoElements.first(where: { $0.type == "videoUri" }),
      let sourceVideoUri = sourceVideoElement.uri
    else {
      hasAppliedManualTransform = false
      let err = makeNSError(.missingParameter("videoUri"))
      reject("E_NO_SOURCE_VIDEO", err.localizedDescription, err)
      return
    }

    setOriginalVideoPath(sourceVideoUri)

    guard let videoURL = URL(string: sourceVideoUri) else {
      let err = makeNSError(.invalidURL)
      reject("E_INVALID_URL", err.localizedDescription, err)
      return
    }

    let asset = AVAsset(url: videoURL)

    guard validateVideoTrack(asset) else {
      hasAppliedManualTransform = false
      let err = makeNSError(.invalidVideoTrack)
      reject("E_INVALID_VIDEO", err.localizedDescription, err)
      return
    }

    let operations = config.videoElements.filter { $0.type != "videoUri" }

    // Capture the original video's bitrate ONCE before any processing.
    // This value is passed through every export step so intermediate
    // re-encodes never degrade the bitrate.
    self.originalVideoBitrate = estimatedVideoBitrate(for: asset)
    print("� [VideoEditing] Original video bitrate: \(self.originalVideoBitrate ?? -1) bps")

    print("�🔧 [VideoEditing] Found \(operations.count) operations to process")

    let currentVideoUri = sourceVideoUri
    let shouldMuteVideo = sourceVideoElement.muted ?? false

    if shouldMuteVideo {
      print("🔇 [VideoEditing] Muting video as requested")
      muteVideo(videoUri: currentVideoUri) { [weak self] result in
        switch result {
        case .success(let mutedVideoUri):
          print("✅ [VideoEditing] Mute completed. New muted file: \(mutedVideoUri)")
          self?.processOperationsAfterMuting(
            currentVideoUri: mutedVideoUri,
            config: config,
            resolve: resolve,
            reject: reject
          )
        case .failure(let error):
          print("❌ [VideoEditing] Mute operation failed: \(error.localizedDescription)")
          self?.hasAppliedManualTransform = false
          reject("E_MUTE_FAILED", "Mute operation failed: \(error.localizedDescription)", error)
        }
      }
    } else {
      processOperationsAfterMuting(
        currentVideoUri: currentVideoUri,
        config: config,
        resolve: resolve,
        reject: reject
      )
    }
  }

  private func processOperationsAfterMuting(
    currentVideoUri: String,
    config: VideoEditingConfig,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    let operations = config.videoElements.filter { $0.type != "videoUri" }
    let trimOperation = operations.first { $0.type == "trim" }
    let cropOperation = operations.first { $0.type == "crop" }
    let otherOperations = operations.filter { $0.type != "trim" && $0.type != "crop" }

    print("VideoEditing: Found \(operations.count) operations to process")
    var processVideoUri = currentVideoUri

    let isLandscape = isLandscapeVideo(videoUri: currentVideoUri)
    let hasCropOperation = cropOperation != nil

    if isLandscape && !hasCropOperation {
      print("VideoEditing: Landscape video detected without crop operation - applying portrait overlay first")
      applyPortraitOverlayOperation(videoUri: processVideoUri) { [weak self] result in
        switch result {
        case .success(let portraitVideoUri):
          processVideoUri = portraitVideoUri
          self?.continueProcessingOperations(
            processVideoUri: processVideoUri,
            trimOperation: trimOperation,
            cropOperation: cropOperation,
            otherOperations: otherOperations,
            resolve: resolve,
            reject: reject
          )
        case .failure(let error):
          self?.hasAppliedManualTransform = false
          reject("EPORTRAITOVERLAYFAILED", "Portrait overlay failed: \(error.localizedDescription)", error)
        }
      }
    } else {
      continueProcessingOperations(
        processVideoUri: processVideoUri,
        trimOperation: trimOperation,
        cropOperation: cropOperation,
        otherOperations: otherOperations,
        resolve: resolve,
        reject: reject
      )
    }
  }

  private func continueProcessingOperations(
    processVideoUri: String,
    trimOperation: VideoElement?,
    cropOperation: VideoElement?,
    otherOperations: [VideoElement],
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    var currentVideoUri = processVideoUri

    if let trim = trimOperation {
      print("✂️ [VideoEditing] Step 1: Applying trim operation")
      applyTrimOperation(
        videoUri: currentVideoUri,
        operation: trim
      ) { [weak self] result in
        switch result {
        case .success(let trimmedUri):
          logEvent("trim_complete", [
            "input": currentVideoUri,
            "output": trimmedUri,
            "start": trim.startTime ?? 0,
            "end": trim.endTime ?? 0
          ])
          currentVideoUri = trimmedUri
          self?.processCropAndRemainingOperations(
            videoUri: currentVideoUri,
            cropOperation: cropOperation,
            otherOperations: otherOperations,
            resolve: resolve,
            reject: reject
          )
        case .failure(let error):
          self?.hasAppliedManualTransform = false
          let err = error as NSError
          reject("E_TRIM_FAILED", err.localizedDescription, err)
        }
      }
    } else {
      processCropAndRemainingOperations(
        videoUri: currentVideoUri,
        cropOperation: cropOperation,
        otherOperations: otherOperations,
        resolve: resolve,
        reject: reject
      )
    }
  }

  private func processCropAndRemainingOperations(
    videoUri: String,
    cropOperation: VideoElement?,
    otherOperations: [VideoElement],
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    var currentVideoUri = videoUri

    if let crop = cropOperation {
      print("VideoEditing: Step 2 - Applying crop operation")
      applyCropOperation(videoUri: currentVideoUri, operation: crop) { [weak self] result in
        switch result {
        case .success(let croppedUri):
          logEvent("crop_complete", [
            "input": currentVideoUri,
            "output": croppedUri,
            "ratio": crop.selection_params ?? "original"
          ])
          currentVideoUri = croppedUri
          self?.processRemainingOperations(
            videoUri: currentVideoUri,
            operations: otherOperations,
            resolve: resolve,
            reject: reject
          )
        case .failure(let error):
          self?.hasAppliedManualTransform = false
          let err = error as NSError
          reject("ECROPFAILED", err.localizedDescription, err)
        }
      }
    } else {
      processRemainingOperations(
        videoUri: currentVideoUri,
        operations: otherOperations,
        resolve: resolve,
        reject: reject
      )
    }
  }

  // MARK: - Process Remaining Operations
  private func processRemainingOperations(
    videoUri: String,
    operations: [VideoElement],
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    var currentVideoUri = videoUri
    var remainingOperations = operations
    let totalOperations = operations.count

    print("🔄 [VideoEditing] Processing \(totalOperations) remaining operations")

    func processNext(operationIndex: Int) {
      guard !remainingOperations.isEmpty else {
        print("✅ [VideoEditing] All operations completed successfully")
        hasAppliedManualTransform = false
        resolve(currentVideoUri)
        return
      }

      let operation = remainingOperations.removeFirst()
      let currentIndex = operationIndex + 1

      print("🔧 [VideoEditing] Processing operation \(currentIndex)/\(totalOperations): \(operation.type)")

      switch operation.type {
      case "crop":
        applyCropOperation(videoUri: currentVideoUri, operation: operation) { result in
          switch result {
          case .success(let newVideoUri):
            logEvent("crop_complete", [
              "input": currentVideoUri,
              "output": newVideoUri,
              "ratio": operation.selection_params ?? "original"
            ])
            currentVideoUri = newVideoUri
            print("✅ [VideoEditing] Operation \(currentIndex)/\(totalOperations) completed")
            processNext(operationIndex: currentIndex)
          case .failure(let error):
            self.hasAppliedManualTransform = false
            reject("E_OPERATION_FAILED", "Operation failed: \(error.localizedDescription)", error)
          }
        }

      case "audio","addBGM":
        applyBGMOperation(videoUri: currentVideoUri, operation: operation) { result in
          switch result {
          case .success(let newVideoUri):
            logEvent("bgm_complete", [
              "input": currentVideoUri,
              "output": newVideoUri,
              "musicUri": operation.musicUri ?? "",
              "start": operation.startTime ?? 0,
              "end": operation.endTime ?? 0,
              "audioOffset": operation.audioOffset ?? 0,
              "isLooped": operation.isLooped ?? false
            ])
            currentVideoUri = newVideoUri
            print("✅ [VideoEditing] Operation \(currentIndex)/\(totalOperations) completed")
            processNext(operationIndex: currentIndex)
          case .failure(let error):
            self.hasAppliedManualTransform = false
            reject("E_OPERATION_FAILED", "Operation failed: \(error.localizedDescription)", error)
          }
        }

      case "addTextOverlay":
        var textOverlays = [operation]
        while let nextOp = remainingOperations.first, nextOp.type == "addTextOverlay" {
          textOverlays.append(remainingOperations.removeFirst())
        }

        applyTextOverlayOperations(videoUri: currentVideoUri, operations: textOverlays) { result in
          switch result {
          case .success(let newVideoUri):
            logEvent("text_overlay_complete", [
              "input": currentVideoUri,
              "output": newVideoUri,
              "count": textOverlays.count
            ])
            currentVideoUri = newVideoUri
            print("✅ [VideoEditing] Operation \(currentIndex)/\(totalOperations) completed")
            processNext(operationIndex: currentIndex)
          case .failure(let error):
            self.hasAppliedManualTransform = false
            reject("E_OPERATION_FAILED", "Operation failed: \(error.localizedDescription)", error)
          }
        }

      case "subtitle":
        // Subtitle operations are not supported
        print("⚠️ [VideoEditing] Skipping subtitle operation")
        processNext(operationIndex: currentIndex)

      case "addVoiceOver":
        var voiceOverOps = [operation]
        while let nextOp = remainingOperations.first, nextOp.type == "addVoiceOver" {
          voiceOverOps.append(remainingOperations.removeFirst())
        }

        applyVoiceOverOperation(videoUri: currentVideoUri, operations: voiceOverOps) { result in
          switch result {
          case .success(let newVideoUri):
            logEvent("voiceover_complete", [
              "input": currentVideoUri,
              "output": newVideoUri,
              "count": voiceOverOps.count
            ])
            currentVideoUri = newVideoUri
            print("✅ [VideoEditing] Operation \(currentIndex)/\(totalOperations) completed")
            processNext(operationIndex: currentIndex)
          case .failure(let error):
            self.hasAppliedManualTransform = false
            reject("E_OPERATION_FAILED", "Operation failed: \(error.localizedDescription)", error)
          }
        }

      default:
        print("⚠️ [VideoEditing] Unknown operation type: \(operation.type)")
        processNext(operationIndex: currentIndex)
      }
    }
    processNext(operationIndex: 0)
  }

  private func handleOperationResult(
    result: Result<String, Error>,
    currentVideoUri: inout String,
    remainingOperations: inout [VideoElement],
    operationIndex: Int,
    totalOperations: Int,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    switch result {
    case .success(let newVideoUri):
      print("💾 [File Generated] oprationResult complete. New file: \(newVideoUri)")
      currentVideoUri = newVideoUri
      print("✅ [VideoEditing] Operation \(operationIndex)/\(totalOperations) completed")

      processRemainingOperations(
        videoUri: currentVideoUri,
        operations: remainingOperations,
        resolve: resolve,
        reject: reject
      )

    case .failure(let error):
      hasAppliedManualTransform = false
      reject("E_OPERATION_FAILED", "Operation failed: \(error.localizedDescription)", error)
    }
  }

  // MARK:Trim Operation
  private func applyTrimOperation(
    videoUri: String,
    operation: VideoElement,
    completion: @escaping (Result<String, Error>) -> Void
  ) {
    guard let startTime = operation.startTime,
      let endTime = operation.endTime
    else {
      completion(.failure(NSError(domain: "VideoEditing", code: 400, userInfo: [NSLocalizedDescriptionKey: "Missing trim parameters"])))
      return
    }

    let tempFileName = generateTempFileName()

    guard let videoURL = URL(string: videoUri) else {
      completion(.failure(NSError(domain: "VideoEditing", code: 400, userInfo: [NSLocalizedDescriptionKey: "Invalid video URI"])))
      return
    }

    let asset = AVAsset(url: videoURL)
    let durationSeconds = CMTimeGetSeconds(asset.duration)
    guard let clamped = clampTimeRange(start: startTime, end: endTime, durationSeconds: durationSeconds) else {
      completion(.failure(NSError(domain: "VideoEditing", code: 400, userInfo: [NSLocalizedDescriptionKey: "Invalid trim range"])))
      return
    }
    guard validateVideoTrack(asset) else {
      completion(.failure(NSError(domain: "VideoEditing", code: 400, userInfo: [NSLocalizedDescriptionKey: "Invalid video track"])))
      return
    }

    trimVideoToTemp(
      videoUri,
      startTime: clamped.start * 1000.0,
      endTime: clamped.end * 1000.0,
      tempFileName: tempFileName,
      resolve: { result in
        if let uri = result as? String {
          completion(.success(uri))
        }
      },
      reject: { _, message, error in
        completion(.failure(error ?? NSError(domain: "VideoEditing", code: 500, userInfo: [NSLocalizedDescriptionKey: message ?? "Trim failed"])))
      }
    )
  }

  // MARK: Crop Operation
  private func applyCropOperation(
    videoUri: String,
    operation: VideoElement,
    completion: @escaping (Result<String, Error>) -> Void
  ) {
    guard let aspectRatio = operation.selection_params else {
      completion(.failure(NSError(domain: "VideoEditing", code: 400, userInfo: [NSLocalizedDescriptionKey: "Missing crop parameters"])))
      return
    }

    let tempFileName = generateTempFileName()

    cropVideoToTemp(
      videoUri,
      aspectRatio: aspectRatio,
      tempFileName: tempFileName,
      resolve: { result in
        if let uri = result as? String {
          // completion(.success(uri))
          let finalName = self.generateTempFileName()
          self.overlayOnPortraitLayer(uri, outputFileName: finalName, completion: completion)
        }
      },
      reject: { _, message, error in
        completion(.failure(error ?? NSError(domain: "VideoEditing", code: 500, userInfo: [NSLocalizedDescriptionKey: message ?? "Crop failed"])))
      }
    )
  }

  // MARK: BGM Operation
  private func applyBGMOperation(
    videoUri: String,
    operation: VideoElement,
    completion: @escaping (Result<String, Error>) -> Void
  ) {
    guard let musicUri = operation.musicUri,
      let audioOffset = operation.audioOffset
    else {
      completion(.failure(NSError(domain: "VideoEditing", code: 400, userInfo: [NSLocalizedDescriptionKey: "Missing BGM parameters"])))
      return
    }

    let asset = AVAsset(url: URL(string: videoUri)!)
    let videoDurationSeconds = CMTimeGetSeconds(asset.duration)

    let startTime = max(0.0, operation.startTime ?? 0.0)
    let requestedEnd = operation.endTime ?? videoDurationSeconds
    guard let clamped = clampTimeRange(start: startTime, end: requestedEnd, durationSeconds: videoDurationSeconds) else {
      completion(.failure(NSError(domain: "VideoEditing", code: 400, userInfo: [NSLocalizedDescriptionKey: "Invalid BGM time range"])))
      return
    }

    let tempFileName = generateTempFileName()
    let isLooped = operation.isLooped ?? false

    addTrimmedAudioToTemp(
      videoUri,
      audioPath: musicUri,
      startTime: clamped.start * 1000.0,
      endTime: clamped.end * 1000.0,
      audioOffset: audioOffset * 1000.0,
      tempFileName: tempFileName,
      isLooped: isLooped,
      resolve: { result in
        if let uri = result as? String {
          completion(.success(uri))
        }
      },
      reject: { _, message, error in
        completion(.failure(error ?? NSError(domain: "VideoEditing", code: 500, userInfo: [NSLocalizedDescriptionKey: message ?? "BGM failed"])))
      }
    )
  }

  // MARK: Text Overlay
  private func applyTextOverlayOperations(
    videoUri: String,
    operations: [VideoElement],
    completion: @escaping (Result<String, Error>) -> Void
  ) {
    var overlays: [NSDictionary] = []

    for operation in operations {
      guard let text = operation.text,
        let fontSize = operation.fontSize,
        let textColor = operation.textColor,
        let startTime = operation.startTime,
        let endTime = operation.endTime,
        let position = operation.textPosition,
        let containerWidth = operation.screenWidth,
        let containerHeight = operation.screenHeight
      else {
        continue
      }

      let screenSize: CGRect = UIScreen.main.bounds
//      let screenWidth = screenSize.width
//      let screenHeight = screenSize.height

      print("container_Width: ",containerWidth)
      print("container_Height: ",containerHeight)

      let normalizedX = position.xAxis / containerWidth
      let normalizedY = position.yAxis / containerHeight

//      let clampedX = min(max(normalizedX, 0.0), 1.0)
//      let clampedY = min(max(normalizedY, 0.0), 1.0)

      let clampedX = normalizedX  // changed at 8th october, 2025
      let clampedY = normalizedY  // changed at 8th october, 2025

      let overlay: NSDictionary = [
        "text": text,
        "fontSize": fontSize,
        "fontFamily": operation.fontFamily ?? "",
        "color": textColor,
        "overlayColor": operation.textOverlayColor ?? "#00000000",
        "xNormalized": clampedX,
        "yNormalized": clampedY,
        "startTimeMs": startTime * 1000.0,
        "endTimeMs": endTime * 1000.0,
      ]
      overlays.append(overlay)
    }

    let tempFileName = generateTempFileName()

    addTextOverlayToTemp(
      videoUri,
      overlays: overlays,
      outputFileName: tempFileName,
      resolve: { result in
        if let uri = result as? String {
          completion(.success(uri))
        }
      },
      reject: { _, message, error in
        completion(.failure(error ?? NSError(domain: "VideoEditing", code: 500, userInfo: [NSLocalizedDescriptionKey: message ?? "Text overlay failed"])))
      }
    )
  }

  // private func applySubtitleOperation(
  //   videoUri: String,
  //   operation: VideoElement,
  //   completion: @escaping (Result<String, Error>) -> Void
  // ) {
  //   guard let subtitleEntries = operation.subtitleJson,
  //     let subtitlePosition = operation.subtitlePosition
  //   else {
  //     completion(.failure(NSError(domain: "VideoEditing", code: 400, userInfo: [NSLocalizedDescriptionKey: "Missing subtitle parameters"])))
  //     return
  //   }

  //   let encoder = JSONEncoder()
  //   do {
  //     let jsonData = try encoder.encode(subtitleEntries)
  //     let jsonString = String(data: jsonData, encoding: .utf8) ?? "[]"

  //     let tempFileName = generateTempFileName()
  //     let subtitleOverlayColor = operation.subtitleOverlayColor ?? "#00000080"
  //     let subtitleColor = operation.subtitleColor ?? "#FFFFFF"

  //     addSubtitlesToTemp(
  //       videoUri,
  //       subtitleContent: jsonString,
  //       subtitleFormat: "json",
  //       tempFileName: tempFileName,
  //       verticalPosition: subtitlePosition,
  //       subtitleOverlayColor: subtitleOverlayColor,
  //       subtitleColor: subtitleColor,
  //       subtitleSize: operation.subtitleSize ?? 52.0,
  //       resolve: { result in
  //         if let uri = result as? String {
  //           completion(.success(uri))
  //         }
  //       },
  //       reject: { _, message, error in
  //         completion(.failure(error ?? NSError(domain: "VideoEditing", code: 500, userInfo: [NSLocalizedDescriptionKey: message ?? "Subtitle failed"])))
  //       }
  //     )
  //   } catch {
  //     completion(.failure(error))
  //   }
  // }

  // MARK: Voice Over
  private func applyVoiceOverOperation(
    videoUri: String,
    operations: [VideoElement],
    completion: @escaping (Result<String, Error>) -> Void
  ) {

    guard let videoURL = URL(string: videoUri) else {
      completion(.failure(NSError(domain: "VideoEditing", code: 400, userInfo: [NSLocalizedDescriptionKey: "Invalid video URI"])))
      return
    }

    let videoAsset = AVAsset(url: videoURL)
    let videoDurationSeconds = CMTimeGetSeconds(videoAsset.duration)
    let composition = AVMutableComposition()

    guard let videoTrack = videoAsset.tracks(withMediaType: .video).first,
      let compositionVideoTrack = composition.addMutableTrack(
        withMediaType: .video, preferredTrackID: kCMPersistentTrackID_Invalid)
    else {
      return
    }

    do {
      try compositionVideoTrack.insertTimeRange(
        CMTimeRange(start: .zero, duration: videoAsset.duration), of: videoTrack, at: .zero)
    } catch {
      completion(.failure(error))
      return
    }

    var existingAudioTracks: [AVMutableCompositionTrack] = []
    for originalAudioTrack in videoAsset.tracks(withMediaType: .audio) {
      if let compositionAudioTrack = composition.addMutableTrack(
        withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid
      )
      {
        try? compositionAudioTrack.insertTimeRange(
          CMTimeRange(start: .zero, duration: videoAsset.duration), of: originalAudioTrack, at: .zero)
        existingAudioTracks.append(compositionAudioTrack)
      }
    }

    // 🎚️ Collect voiceover time ranges for ducking
    var voiceOverTimeRanges: [CMTimeRange] = []

    // 🎚️ Add voice over tracks with tracking
    var voiceOverTracks: [AVMutableCompositionTrack] = []
    for (index, operation) in operations.enumerated() {
      guard let voiceOverUri = operation.voiceOverUri,
        let startTime = operation.startTime,
        let endTime = operation.endTime,
        let voiceOverURL = URL(string: voiceOverUri)
      else {
        print("⚠️ Skipping invalid voice over operation at index \(index)")
        continue
      }

      guard let clamped = clampTimeRange(start: startTime, end: endTime, durationSeconds: videoDurationSeconds) else {
        print("⚠️ Skipping voice over with invalid start/end times at index \(index)")
        continue
      }

      let voiceOverAsset = AVAsset(url: voiceOverURL)
      guard let voiceOverAudioTrack = voiceOverAsset.tracks(withMediaType: .audio).first else {
        print("⚠️ Skipping voice over URI with no audio track: \(voiceOverUri)")
        continue
      }

      // KEY FIX: Create separate audio track for each voice over
      guard let compositionVoiceOverTrack = composition.addMutableTrack(withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid)
      else {
        print("⚠️ Could not add new audio track to composition for voiceover at index \(index)")
        continue
      }

      let durationInSeconds = clamped.end - clamped.start
      let timeRangeToInsert = CMTimeRange(
        start: .zero,
        duration: secondsToCMTime(durationInSeconds)
      )
      let insertAtTime = secondsToCMTime(clamped.start)

      do {
        try compositionVoiceOverTrack.insertTimeRange(
          timeRangeToInsert, of: voiceOverAudioTrack, at: insertAtTime)
        voiceOverTracks.append(compositionVoiceOverTrack)

        let voiceOverRange = CMTimeRange(
          start: insertAtTime,
          duration: timeRangeToInsert.duration
        )
        voiceOverTimeRanges.append(voiceOverRange)
        print("✅ Added voiceover track at index \(index) - Start: \(startTime)s, End: \(endTime)s")
      } catch {
        print("❌ Failed to insert voiceover track at index \(index): \(error.localizedDescription)")
      }
    }

    let audioMix = AVMutableAudioMix()
    var audioMixParameters: [AVMutableAudioMixInputParameters] = []

    for existingTrack in existingAudioTracks {
      let params = AVMutableAudioMixInputParameters(track: existingTrack)

      // Start with normal volume (100%)
      params.setVolume(1.0, at: .zero)

      // Duck volume for each voiceover time range
      for voiceOverRange in voiceOverTimeRanges {
        let startTime = voiceOverRange.start
        let endTime = CMTimeAdd(voiceOverRange.start, voiceOverRange.duration)

        // Fade down to 25% volume just before voiceover starts (0.3 seconds fade)
        let fadeDownStart = CMTimeSubtract(startTime, CMTime(seconds: 0.3, preferredTimescale: 600))
        if CMTimeCompare(fadeDownStart, .zero) > 0 {
          params.setVolumeRamp(
            fromStartVolume: 1.0, toEndVolume: 0.25, timeRange: CMTimeRange(start: fadeDownStart, duration: CMTime(seconds: 0.3, preferredTimescale: 600)))
        } else {
          params.setVolume(0.25, at: startTime)
        }

        // Keep at 25% during voiceover
        params.setVolume(0.25, at: startTime)

        // Fade back up to 100% after voiceover ends (0.3 seconds fade)
        params.setVolumeRamp(
          fromStartVolume: 0.25, toEndVolume: 1.0, timeRange: CMTimeRange(start: endTime, duration: CMTime(seconds: 0.3, preferredTimescale: 600)))

        print("🔉 Background audio ducking: \(CMTimeGetSeconds(startTime))s to \(CMTimeGetSeconds(endTime))s")
      }

      audioMixParameters.append(params)
    }

    for voiceOverTrack in voiceOverTracks {
      let params = AVMutableAudioMixInputParameters(track: voiceOverTrack)
      params.setVolume(1.5, at: .zero)  // 150% volume for voiceover
      audioMixParameters.append(params)
      print("🔊 Voiceover track boosted to 150% volume")
    }

    audioMix.inputParameters = audioMixParameters

    //    for operation in operations {
    //      guard let voiceOverUri = operation.voiceOverUri,
    //        let startTime = operation.startTime,
    //        let endTime = operation.endTime,
    //        let voiceOverURL = URL(string: voiceOverUri)
    //      else {
    //        print("⚠️ Skipping invalid voice over operation.")
    //        continue
    //      }
    //
    //      guard startTime < endTime else {
    //        print("⚠️ Skipping voice over with invalid start/end times.")
    //        continue
    //      }
    //
    //      let voiceOverAsset = AVAsset(url: voiceOverURL)
    //
    //      guard let voiceOverAudioTrack = voiceOverAsset.tracks(withMediaType: .audio).first else {
    //        print("⚠️ Skipping voice over URI with no audio track: \(voiceOverUri)")
    //        continue
    //      }
    //
    //      let durationInSeconds = endTime - startTime
    //      let timeRangeToInsert = CMTimeRange(
    //        start: .zero,
    //        duration: CMTime(seconds: durationInSeconds, preferredTimescale: 600)
    //      )
    //      let insertAtTime = CMTime(seconds: startTime, preferredTimescale: 600)
    //
    //      guard
    //        let compositionVoiceOverTrack = composition.addMutableTrack(
    //          withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid)
    //      else {
    //        print("⚠️ Could not add new audio track to composition for voiceover.")
    //        continue
    //      }
    //
    //      do {
    //        try compositionVoiceOverTrack.insertTimeRange(
    //          timeRangeToInsert, of: voiceOverAudioTrack, at: insertAtTime)
    //      } catch {
    //        print("❌ Failed to insert voiceover track: \(error.localizedDescription)")
    //      }
    //    }

    guard let videoComposition = createVideoComposition(for: videoAsset, composition: composition)
    else {
      completion(.failure(NSError(domain: "VideoEditing", code: 500, userInfo: [NSLocalizedDescriptionKey: "Failed to create video composition."])))
      return
    }

    let sourceBitrate = self.originalVideoBitrate

    // 5. Export the final composed video (no changes needed here)
    let tempFileName = generateTempFileName()
    let outputURL = getTempDirectory().appendingPathComponent(tempFileName)
    if FileManager.default.fileExists(atPath: outputURL.path) {
      try? FileManager.default.removeItem(at: outputURL)
    }

    guard composition.tracks(withMediaType: .video).first != nil else {
      completion(.failure(NSError(domain: "VideoEditing", code: 500, userInfo: [
              NSLocalizedDescriptionKey: "No video track found in composition before export"])))
      return
    }

    exportWithAssetWriter(
      asset: composition,
      videoComposition: videoComposition,
      audioMix: audioMix,
      outputURL: outputURL,
      sourceBitrate: sourceBitrate
    ) { result in
      switch result {
      case .success(let url):
        completion(.success(url.absoluteString))
      case .failure(let error):
        completion(.failure(error))
      }
    }
  }

  // MARK: Vision Camera
  private func isVisionCameraVideoDetected(_ asset: AVAsset, explicitFlag: Bool) -> Bool {
    if explicitFlag {
      return true
    }
    return false
  }

  private func calculateManualTransformForVisionCamera(_ videoTrack: AVAssetTrack)
    -> CGAffineTransform
  {
    let naturalSize = videoTrack.naturalSize
    print("🔄 [VisionCamera] Calculating manual transform for size: \(naturalSize)")

    if naturalSize.width > naturalSize.height {
      // Landscape video - rotate 90 degrees clockwise for portrait
      let rotationTransform = CGAffineTransform(rotationAngle: CGFloat.pi / 2)
      let translationTransform = CGAffineTransform(translationX: naturalSize.height, y: 0)
      return rotationTransform.concatenating(translationTransform)
    } else {
      // Portrait video - usually needs 180-degree rotation for vision-camera
      let rotationTransform = CGAffineTransform(rotationAngle: CGFloat.pi)
      let translationTransform = CGAffineTransform(
        translationX: naturalSize.width, y: naturalSize.height)
      return rotationTransform.concatenating(translationTransform)
    }
  }

  private func getCorrectTransform(for asset: AVAsset) -> CGAffineTransform {
    guard let videoTrack = asset.tracks(withMediaType: .video).first else {
      return CGAffineTransform.identity
    }

    let preferredTransform = videoTrack.preferredTransform
    let naturalSize = videoTrack.naturalSize
    let transformedSize = naturalSize.applying(preferredTransform)
    let isValidTransform = abs(transformedSize.width) > 0 && abs(transformedSize.height) > 0

    if isVisionCameraVideoDetected(asset, explicitFlag: isVisionCameraVideo) && !hasAppliedManualTransform {
      print("🔄 Applying manual transform for vision-camera video")
      hasAppliedManualTransform = true
      let manualTransform = calculateManualTransformForVisionCamera(videoTrack)
      let manualTransformedSize = naturalSize.applying(manualTransform)
      if abs(manualTransformedSize.width) > 0 && abs(manualTransformedSize.height) > 0 {
        return manualTransform
      } else {
        print("⚠️ Manual transform invalid, falling back to preferred transform")
        return isValidTransform ? preferredTransform : CGAffineTransform.identity
      }
    } else {
      print("📹 Using preferred transform for standard video")
      return isValidTransform ? preferredTransform : CGAffineTransform.identity
    }
  }

  private func createVideoComposition(
    for asset: AVAsset,
    composition: AVMutableComposition
  ) -> AVMutableVideoComposition? {

    guard let videoTrack = asset.tracks(withMediaType: .video).first else { return nil }
    guard let compositionTrack = composition.tracks(withMediaType: .video).first else { return nil }

    let correctTransform = getCorrectTransform(for: asset)
    let naturalSize = videoTrack.naturalSize

    let transformedSize = naturalSize.applying(correctTransform)

    guard abs(transformedSize.width) > 0 && abs(transformedSize.height) > 0 else {
      print("❌ Invalid transformed size: \(transformedSize)")
      return nil
    }

    let renderSize = CGSize(width: abs(transformedSize.width), height: abs(transformedSize.height))

    print("📐 Video transform - Natural size: \(naturalSize), Render size: \(renderSize)")
    print("🔄 Transform applied: \(correctTransform)")

    let videoComposition = AVMutableVideoComposition()
    videoComposition.renderSize = renderSize
    videoComposition.frameDuration = VideoQualitySettings.nominalFrameDuration(for: videoTrack)

    let instruction = AVMutableVideoCompositionInstruction()
    instruction.timeRange = CMTimeRange(start: .zero, duration: composition.duration)

    let layerInstruction = AVMutableVideoCompositionLayerInstruction(assetTrack: compositionTrack)
    layerInstruction.setTransform(correctTransform, at: .zero)
    layerInstruction.setOpacity(1.0, at: .zero)
    instruction.layerInstructions = [layerInstruction]
    videoComposition.instructions = [instruction]

    return videoComposition
  }

  @objc(trimVideoToTemp:startTime:endTime:tempFileName:resolve:reject:)
  func trimVideoToTemp(
    _ videoPath: String,
    startTime: Double,
    endTime: Double,
    tempFileName: String,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    guard let inputURL = URL(string: videoPath) else {
      let err = makeNSError(.invalidURL)
      reject("E_INVALID_URL", err.localizedDescription, err)
      return
    }

    let asset = AVAsset(url: inputURL)
    let startTimeCM = msToCMTime(startTime)
    let endTimeCM = msToCMTime(endTime)
    let timeRange = CMTimeRange(start: startTimeCM, end: endTimeCM)

    let outputURL = getTempDirectory().appendingPathComponent(tempFileName)

    if FileManager.default.fileExists(atPath: outputURL.path) {
      try? FileManager.default.removeItem(at: outputURL)
    }

    guard asset.tracks(withMediaType: .video).first != nil else {
      reject("E_NO_VIDEO_TRACK", "No video track found in asset before export", nil)
      return
    }

    let composition = AVMutableComposition()

    guard let videoTrack = asset.tracks(withMediaType: .video).first,
          let compositionVideoTrack = composition.addMutableTrack(
            withMediaType: .video, preferredTrackID: kCMPersistentTrackID_Invalid)
    else {
      reject("E_NO_VIDEO_TRACK", "No video track found", nil)
      return
    }

    do {
      try compositionVideoTrack.insertTimeRange(timeRange, of: videoTrack, at: .zero)

      if let audioTrack = asset.tracks(withMediaType: .audio).first,
         let compositionAudioTrack = composition.addMutableTrack(
           withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid)
      {
        try compositionAudioTrack.insertTimeRange(timeRange, of: audioTrack, at: .zero)
      }
    } catch {
      reject("E_INSERT_FAILED", "Failed to insert tracks", error)
      return
    }

    guard let videoComposition = createVideoComposition(for: asset, composition: composition) else {
      reject("E_VIDEO_COMPOSITION", "Failed to create video composition", nil)
      return
    }

    let sourceBitrate = self.originalVideoBitrate

    exportWithAssetWriter(
      asset: composition,
      videoComposition: videoComposition,
      audioMix: nil,
      outputURL: outputURL,
      sourceBitrate: sourceBitrate
    ) { result in
        switch result {
        case .success(let url):
          resolve(url.absoluteString)
        case .failure(let error):
          reject("E_TRIM_FAILED", error.localizedDescription, error)
        }
    }
  }

  // ORIGINAL
  @objc(cropVideoToTemp:aspectRatio:tempFileName:resolve:reject:)
  func cropVideoToTemp(
    _ videoPath: String,
    aspectRatio: String,
    tempFileName: String,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    guard let videoURL = URL(string: videoPath) else {
      reject("E_INVALID_URL", "Invalid video URL", nil)
      return
    }

    let asset = AVAsset(url: videoURL)
    let composition = AVMutableComposition()

    guard let videoTrack = asset.tracks(withMediaType: .video).first,
      let compositionVideoTrack = composition.addMutableTrack(
        withMediaType: .video, preferredTrackID: kCMPersistentTrackID_Invalid)
    else {
      reject("E_NO_VIDEO_TRACK", "No video track found", nil)
      return
    }

    do {
      try compositionVideoTrack.insertTimeRange(
        CMTimeRange(start: .zero, duration: asset.duration), of: videoTrack, at: .zero)

      if let audioTrack = asset.tracks(withMediaType: .audio).first,
        let compositionAudioTrack = composition.addMutableTrack(
          withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid)
      {
        try compositionAudioTrack.insertTimeRange(
          CMTimeRange(start: .zero, duration: asset.duration), of: audioTrack, at: .zero)
      }
    } catch {
      reject("E_INSERT_FAILED", "Failed to insert tracks", error)
      return
    }

    let naturalSize = videoTrack.naturalSize
    let correctTransform = getCorrectTransform(for: asset)
    let orientedSize = naturalSize.applying(correctTransform)
    let baseRenderSize = CGSize(width: abs(orientedSize.width), height: abs(orientedSize.height))

    var targetSize: CGSize
    switch aspectRatio {
    case "1:1":
      let side = min(baseRenderSize.width, baseRenderSize.height)
      targetSize = CGSize(width: side, height: side)
    case "9:16":
      if baseRenderSize.width > baseRenderSize.height {
        targetSize = CGSize(width: baseRenderSize.height * 9 / 16, height: baseRenderSize.height)
      } else {
        targetSize = CGSize(width: baseRenderSize.width, height: baseRenderSize.width * 16 / 9)
      }
    case "16:9":
      if baseRenderSize.width > baseRenderSize.height {
        targetSize = CGSize(width: baseRenderSize.width, height: baseRenderSize.width * 9 / 16)
      } else {
        let targetWidth = baseRenderSize.width
        let targetHeight = targetWidth * 9 / 16
        targetSize = CGSize(width: targetWidth, height: targetHeight)
      }
    default:  // "original"
      targetSize = baseRenderSize
    }

    let scaleX = targetSize.width / baseRenderSize.width
    let scaleY = targetSize.height / baseRenderSize.height
    let scale = max(scaleX, scaleY)

    let scaledWidth = baseRenderSize.width * scale
    let scaledHeight = baseRenderSize.height * scale

    let translateX = (targetSize.width - scaledWidth) / 2.0
    let translateY = (targetSize.height - scaledHeight) / 2.0

    let scaleTransform = CGAffineTransform(scaleX: scale, y: scale)
    let translateTransform = CGAffineTransform(translationX: translateX, y: translateY)

    let finalTransform = correctTransform.concatenating(scaleTransform).concatenating(translateTransform)

    let videoComposition = AVMutableVideoComposition()
    videoComposition.renderSize = targetSize
    videoComposition.frameDuration = VideoQualitySettings.nominalFrameDuration(for: videoTrack)

    let instruction = AVMutableVideoCompositionInstruction()
    instruction.timeRange = CMTimeRange(start: .zero, duration: asset.duration)

    let layerInstruction = AVMutableVideoCompositionLayerInstruction(
      assetTrack: compositionVideoTrack)

    layerInstruction.setTransform(finalTransform, at: .zero)
    layerInstruction.setOpacity(1.0, at: .zero)
    instruction.layerInstructions = [layerInstruction]
    videoComposition.instructions = [instruction]

    let sourceBitrate = self.originalVideoBitrate

    let outputURL = getTempDirectory().appendingPathComponent(tempFileName)
    if FileManager.default.fileExists(atPath: outputURL.path) {
      try? FileManager.default.removeItem(at: outputURL)
    }

    exportWithAssetWriter(
      asset: composition,
      videoComposition: videoComposition,
      audioMix: nil,
      outputURL: outputURL,
      sourceBitrate: sourceBitrate
    ) { result in
      switch result {
      case .success(let url):
        resolve(url.path)
      case .failure(let error):
        reject("E_CROP_FAILED", "Crop failed: \(error.localizedDescription)", error)
      }
    }
  }

  private func overlayOnPortraitLayer(
    _ videoUri: String,
    outputFileName: String,
    completion: @escaping (Result<String, Error>) -> Void
  ) {

    let videoURL: URL
    if videoUri.hasPrefix("file://") {
      guard let url = URL(string: videoUri) else {
        completion(.failure(NSError(domain: "VideoEditing", code: 400, userInfo: [NSLocalizedDescriptionKey: "Invalid video URL"])))
        return
      }
      videoURL = url
    } else {
      videoURL = URL(fileURLWithPath: videoUri)
    }

    let asset = AVAsset(url: videoURL)
    let composition = AVMutableComposition()

    guard let videoTrack = asset.tracks(withMediaType: .video).first,
      let compositionVideoTrack = composition.addMutableTrack(
        withMediaType: .video, preferredTrackID: kCMPersistentTrackID_Invalid)
    else {
      completion(.failure(NSError(domain: "VideoEditing", code: 404, userInfo: [NSLocalizedDescriptionKey: "No video track in cropped video"])))
      return
    }

    if let audioTrack = asset.tracks(withMediaType: .audio).first,
       let compositionAudioTrack = composition.addMutableTrack(
         withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid)
    {
      try? compositionAudioTrack.insertTimeRange(
        CMTimeRange(start: .zero, duration: asset.duration), of: audioTrack, at: .zero)
    }

    do {
      try compositionVideoTrack.insertTimeRange(
        CMTimeRange(start: .zero, duration: asset.duration), of: videoTrack, at: .zero)
    } catch {
      completion(.failure(error))
      return
    }

    // Use the source video's actual dimensions instead of a hardcoded 1080×1920
    // so that HD, 4K, or sub-HD content keeps its original pixel count.
    let rawTransformedSize = videoTrack.naturalSize.applying(videoTrack.preferredTransform)
    let portraitSize = CGSize(
      width: max(abs(rawTransformedSize.width), 1),
      height: max(abs(rawTransformedSize.height), 1)
    )
    let videoComposition = AVMutableVideoComposition()
    videoComposition.renderSize = portraitSize
    videoComposition.frameDuration = VideoQualitySettings.nominalFrameDuration(for: videoTrack)

    let instruction = AVMutableVideoCompositionInstruction()
    instruction.timeRange = CMTimeRange(start: .zero, duration: asset.duration)

    let layerInstruction = AVMutableVideoCompositionLayerInstruction(
      assetTrack: compositionVideoTrack)

    // Center cropped video inside portrait
    let naturalSize = videoTrack.naturalSize
    let scaleX = portraitSize.width / naturalSize.width
    let scaleY = portraitSize.height / naturalSize.height
    let scale = min(scaleX, scaleY)

    let scaledWidth = naturalSize.width * scale
    let scaledHeight = naturalSize.height * scale

    let translateX = (portraitSize.width - scaledWidth) / 2.0
    let translateY = (portraitSize.height - scaledHeight) / 2.0

    let scaleTransform = CGAffineTransform(scaleX: scale, y: scale)
    let translateTransform = CGAffineTransform(translationX: translateX, y: translateY)
    let finalTransform = scaleTransform.concatenating(translateTransform)

    layerInstruction.setTransform(finalTransform, at: .zero)
    instruction.layerInstructions = [layerInstruction]
    videoComposition.instructions = [instruction]

    // Add background layer
    let backgroundLayer = CALayer()
    backgroundLayer.frame = CGRect(origin: .zero, size: portraitSize)
    backgroundLayer.backgroundColor = UIColor.black.cgColor

    let videoLayer = CALayer()
    videoLayer.frame = CGRect(origin: .zero, size: portraitSize)

    let parentLayer = CALayer()
    parentLayer.frame = CGRect(origin: .zero, size: portraitSize)
    parentLayer.addSublayer(backgroundLayer)
    parentLayer.addSublayer(videoLayer)

    videoComposition.animationTool = AVVideoCompositionCoreAnimationTool(
      postProcessingAsVideoLayer: videoLayer,
      in: parentLayer
    )

    let sourceBitrate = self.originalVideoBitrate

    let outputURL = getTempDirectory().appendingPathComponent(outputFileName)
    if FileManager.default.fileExists(atPath: outputURL.path) {
      try? FileManager.default.removeItem(at: outputURL)
    }

    exportWithAssetWriter(
      asset: composition,
      videoComposition: videoComposition,
      audioMix: nil,
      outputURL: outputURL,
      sourceBitrate: sourceBitrate
    ) { result in
      switch result {
      case .success(let url):
        completion(.success(url.absoluteString))
      case .failure(let error):
        completion(.failure(error))
      }
    }
  }

  @objc(addTrimmedAudioToTemp:audioPath:startTime:endTime:audioOffset:tempFileName:isLooped:resolve:reject:)
  func addTrimmedAudioToTemp(
    _ videoPath: String,
    audioPath: String,
    startTime: Double,
    endTime: Double,
    audioOffset: Double,
    tempFileName: String,
    isLooped: Bool = false,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    print("🎵 [BGM] Starting audio addition")
    print("🎵 [BGM] Video path: \(videoPath)")
    print("🎵 [BGM] Audio path: \(audioPath)")

    // Handle video URL - support both file:// URLs and raw file paths
    let videoURL: URL
    if videoPath.hasPrefix("file://") {
      guard let url = URL(string: videoPath) else {
        reject("E_INVALID_URL", "Invalid video URL", nil)
        return
      }
      videoURL = url
    } else {
      videoURL = URL(fileURLWithPath: videoPath)
    }

    // Handle audio URL - support both file:// URLs and raw file paths
    let audioURL: URL
    if audioPath.hasPrefix("file://") {
      guard let url = URL(string: audioPath) else {
        reject("E_INVALID_URL", "Invalid audio URL", nil)
        return
      }
      audioURL = url
    } else {
      audioURL = URL(fileURLWithPath: audioPath)
    }

    print("🎵 [BGM] Video URL: \(videoURL.absoluteString)")
    print("🎵 [BGM] Audio URL: \(audioURL.absoluteString)")

    let videoAsset = AVAsset(url: videoURL)
    let audioAsset = AVAsset(url: audioURL)
    let composition = AVMutableComposition()

    guard let videoTrack = videoAsset.tracks(withMediaType: .video).first,
      let compositionVideoTrack = composition.addMutableTrack(
        withMediaType: .video, preferredTrackID: kCMPersistentTrackID_Invalid)
    else {
      reject("E_NO_VIDEO_TRACK", "No video track found", nil)
      return
    }

    do {
      try compositionVideoTrack.insertTimeRange(
        CMTimeRange(start: .zero, duration: videoAsset.duration),
        of: videoTrack, at: .zero)
    } catch {
      reject("E_INSERT_VIDEO_FAILED", "Failed to insert video track", error)
      return
    }

    // Add original video audio tracks
    for audioTrack in videoAsset.tracks(withMediaType: .audio) {
      if let compositionAudioTrack = composition.addMutableTrack(
        withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid)
      {
        try? compositionAudioTrack.insertTimeRange(
          CMTimeRange(start: .zero, duration: videoAsset.duration),
          of: audioTrack, at: .zero)
      }
    }

    guard let backgroundAudioTrack = audioAsset.tracks(withMediaType: .audio).first else {
      reject("E_NO_AUDIO_TRACK", "No audio track found in selected audio", nil)
      return
    }

    let videoDurationSeconds = CMTimeGetSeconds(videoAsset.duration)
    let overlayDurationSeconds = (endTime - startTime) / 1000.0
    let audioTrimStart = CMTime(seconds: audioOffset / 1000.0, preferredTimescale: 600)
    let videoInsertStart = CMTime(seconds: startTime / 1000.0, preferredTimescale: 600)

    // ✅ FIXED: Create a SINGLE background music track
    guard let compositionBackgroundAudioTrack = composition.addMutableTrack(
      withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid)
    else {
      reject("E_NO_AUDIO_TRACK", "Could not add audio track to composition", nil)
      return
    }

    if isLooped && overlayDurationSeconds > 0 {
      print("🔁 [BGM] Looping enabled. Video duration: \(videoDurationSeconds)s, Audio clip duration: \(overlayDurationSeconds)s")

      var currentPosition = CMTimeGetSeconds(videoInsertStart)
      var loopCount = 0
      let audioDurationSeconds = CMTimeGetSeconds(audioAsset.duration) - CMTimeGetSeconds(audioTrimStart)
      let actualLoopDuration = min(overlayDurationSeconds, audioDurationSeconds)

      // Loop until we cover the entire video duration
      while currentPosition < videoDurationSeconds {
        let remainingDuration = videoDurationSeconds - currentPosition
        let currentLoopDuration = min(actualLoopDuration, remainingDuration)
        let loopDurationTime = CMTime(seconds: currentLoopDuration, preferredTimescale: 600)
        let insertAtTime = CMTime(seconds: currentPosition, preferredTimescale: 600)

        do {
          // ✅ FIXED: Insert into the SAME track at different positions
          try compositionBackgroundAudioTrack.insertTimeRange(
            CMTimeRange(start: audioTrimStart, duration: loopDurationTime),
            of: backgroundAudioTrack,
            at: insertAtTime)  // This is correct now - inserting into the composition timeline

          print("✅ Added audio loop \(loopCount + 1): duration \(currentLoopDuration)s at position \(currentPosition)s")

          currentPosition += currentLoopDuration
          loopCount += 1
        } catch {
          print("❌ Failed to insert audio loop \(loopCount): \(error.localizedDescription)")
          reject("E_INSERT_AUDIO_FAILED", "Failed to insert background audio: \(error.localizedDescription)", error)
          return
        }
      }
      print("🔁 Audio looping complete. Total loops: \(loopCount)")
    } else {
      print("🎵 [BGM] Looping disabled. Playing audio once.")

      let overlayDuration = CMTime(seconds: overlayDurationSeconds, preferredTimescale: 600)

      do {
        try compositionBackgroundAudioTrack.insertTimeRange(
          CMTimeRange(start: audioTrimStart, duration: overlayDuration),
          of: backgroundAudioTrack,
          at: videoInsertStart)
      } catch {
        reject("E_INSERT_AUDIO_FAILED", "Failed to insert background audio track", error)
        return
      }
    }

    guard let videoComposition = createVideoComposition(for: videoAsset, composition: composition)
    else {
      reject("E_VIDEO_COMPOSITION", "Failed to create video composition.", nil)
      return
    }

    let sourceBitrate = self.originalVideoBitrate

    let outputURL = getTempDirectory().appendingPathComponent(tempFileName)
    if FileManager.default.fileExists(atPath: outputURL.path) {
      try? FileManager.default.removeItem(at: outputURL)
    }

    guard composition.tracks(withMediaType: .video).first != nil else {
      reject("E_NO_VIDEO_TRACK", "No video track found in composition before export", nil)
      return
    }

    exportWithAssetWriter(
      asset: composition,
      videoComposition: videoComposition,
      audioMix: nil,
      outputURL: outputURL,
      sourceBitrate: sourceBitrate
    ) { result in
      switch result {
      case .success(let url):
        resolve(url.absoluteString)
      case .failure(let error):
        reject("E_ADD_AUDIO_FAILED", error.localizedDescription, error)
      }
    }
  }

  private func muteVideo(videoUri: String, completion: @escaping (Result<String, Error>) -> Void) {
    guard let videoURL = URL(string: videoUri) else {
      completion(.failure(NSError(domain: "VideoEditing", code: 400, userInfo: [NSLocalizedDescriptionKey: "Invalid video URI for muting"])))
      return
    }

    let asset = AVAsset(url: videoURL)
    let composition = AVMutableComposition()
    let sourceBitrate = self.originalVideoBitrate

    // Add only video track (no audio)
    guard let videoTrack = asset.tracks(withMediaType: .video).first,
          let compositionVideoTrack = composition.addMutableTrack(withMediaType: .video, preferredTrackID: kCMPersistentTrackID_Invalid) else {
      completion(.failure(NSError(domain: "VideoEditing", code: 404, userInfo: [NSLocalizedDescriptionKey: "No video track found"])))
      return
    }

    do {
      try compositionVideoTrack.insertTimeRange(CMTimeRange(start: .zero, duration: asset.duration), of: videoTrack, at: .zero)
    } catch {
      completion(.failure(error))
      return
    }

    guard let videoComposition = createVideoComposition(for: asset, composition: composition) else {
      completion(.failure(NSError(domain: "VideoEditing", code: 500, userInfo: [NSLocalizedDescriptionKey: "Failed to create video composition for muted video"])))
      return
    }

    let tempFileName = generateTempFileName()
    let outputURL = getTempDirectory().appendingPathComponent(tempFileName)

    if FileManager.default.fileExists(atPath: outputURL.path) {
      try? FileManager.default.removeItem(at: outputURL)
    }

    exportWithAssetWriter(
        asset: composition,
        videoComposition: videoComposition,
        audioMix: nil,
        outputURL: outputURL,
        sourceBitrate: sourceBitrate
      ) { result in
        switch result {
        case .success(let url):
          print("VideoEditing: Video muted successfully: \(url.absoluteString)")
          completion(.success(url.absoluteString))
        case .failure(let error):
          completion(.failure(error))
        }
      }
  }

  @objc(addTextOverlayToTemp:overlays:outputFileName:resolve:reject:)
  func addTextOverlayToTemp(
    _ videoPath: String,
    overlays: [NSDictionary],
    outputFileName: String,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    guard let videoURL = URL(string: videoPath) else {
      reject("E_INVALID_URL", "Invalid video URL", nil)
      return
    }

    let asset = AVAsset(url: videoURL)
    let composition = AVMutableComposition()

    guard let videoTrack = asset.tracks(withMediaType: .video).first,
      let videoCompTrack = composition.addMutableTrack(withMediaType: .video, preferredTrackID: kCMPersistentTrackID_Invalid)
    else {
      reject("E_NO_VIDEO_TRACK", "No video track found", nil)
      return
    }

    do {
      try videoCompTrack.insertTimeRange(
        CMTimeRange(start: .zero, duration: asset.duration), of: videoTrack, at: .zero)
    } catch {
      reject("E_INSERT_VIDEO_FAILED", "Failed to insert video track", error)
      return
    }

    if let audioTrack = asset.tracks(withMediaType: .audio).first,
      let audioCompTrack = composition.addMutableTrack(
        withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid)
    {
      try? audioCompTrack.insertTimeRange(
        CMTimeRange(start: .zero, duration: asset.duration), of: audioTrack, at: .zero)
    }

    guard let videoComposition = createVideoComposition(for: asset, composition: composition) else {
      reject("E_VIDEO_COMPOSITION", "Failed to create video composition.", nil)
      return
    }

    let renderSize = videoComposition.renderSize

    let parentLayer = CALayer()
    parentLayer.frame = CGRect(origin: .zero, size: renderSize)
    parentLayer.isGeometryFlipped = true

    let videoLayer = CALayer()
    videoLayer.frame = CGRect(origin: .zero, size: renderSize)
    parentLayer.backgroundColor = UIColor.clear.cgColor
    videoLayer.backgroundColor = UIColor.black.cgColor
    parentLayer.addSublayer(videoLayer)

    for (index, overlay) in overlays.enumerated() {
      guard let text = overlay["text"] as? String,
        let startMs = overlay["startTimeMs"] as? Double,
        let endMs = overlay["endTimeMs"] as? Double,
        let fontSize = overlay["fontSize"] as? CGFloat,
        let colorString = overlay["color"] as? String
      else {
        print("Skipping invalid overlay at index \(index)")
        continue
      }
      let textLayer = createTextLayer(
        text: text,
        fontSize: fontSize,
        fontFamily: (overlay["fontFamily"] as? String) ?? "",
        color: colorString,
        overlayColor: (overlay["overlayColor"] as? String) ?? "#00000000",
        xNormalized: (overlay["xNormalized"] as? CGFloat) ?? 0.5,
        yNormalized: (overlay["yNormalized"] as? CGFloat) ?? 0.5,
        renderSize: renderSize,
        startMs: startMs,
        endMs: endMs
      )
      parentLayer.addSublayer(textLayer)
    }

    videoComposition.animationTool = AVVideoCompositionCoreAnimationTool(
      postProcessingAsVideoLayer: videoLayer,
      in: parentLayer
    )

    let sourceBitrate = self.originalVideoBitrate

    let outputURL = getTempDirectory().appendingPathComponent(outputFileName)
    if FileManager.default.fileExists(atPath: outputURL.path) {
      try? FileManager.default.removeItem(at: outputURL)
    }

    guard composition.tracks(withMediaType: .video).first != nil else {
      reject("E_NO_VIDEO_TRACK", "No video track found in composition before export", nil)
      return
    }

    exportWithAssetWriter(
      asset: composition,
      videoComposition: videoComposition,
      audioMix: nil,
      outputURL: outputURL,
      sourceBitrate: sourceBitrate
    ) { result in
      switch result {
      case .success(let url):
        resolve(url.absoluteString)
      case .failure(let error):
        reject("E_TEXT_OVERLAY_FAILED", error.localizedDescription, error)
      }
    }
  }

  private func createTextLayer(
    text: String,
    fontSize: CGFloat,
    fontFamily: String,
    color: String,
    overlayColor: String,
    xNormalized: CGFloat,
    yNormalized: CGFloat,
    renderSize: CGSize,
    startMs: Double,
    endMs: Double
  ) -> CATextLayer {
    let textLayer = CATextLayer()

    let fontSizeAsPercentOfHeight = fontSize / 720.0
    let scaledFontSize = fontSizeAsPercentOfHeight * renderSize.height
    let minFontSize = renderSize.height * 0.02  // 2% of video height minimum
    let maxFontSize = renderSize.height * 0.08  // 8% of video height maximum
    let finalFontSize = max(minFontSize, min(scaledFontSize, maxFontSize))

    let fontName = fontFamily.isEmpty ? "Inter-Bold" : fontFamily
//    let font = UIFont.boldSystemFont(ofSize: finalFontSize)
    let font = UIFont(name: fontName, size: finalFontSize) ?? UIFont.boldSystemFont(ofSize: finalFontSize)
    textLayer.string = NSAttributedString(string: text)
    textLayer.font = CTFontCreateWithName(fontName as CFString, finalFontSize, nil)
    textLayer.fontSize = finalFontSize
    textLayer.alignmentMode = .center
    textLayer.isWrapped = true
    textLayer.allowsFontSubpixelQuantization = true
    textLayer.contentsScale = UIScreen.main.scale

    var textColor = UIColor.white
    if let color = UIColor(hexString: color) {
      textColor = color
    }

    let horizontalPadding = finalFontSize * 0.5
    let verticalPadding = finalFontSize * 0.25

    let paragraphStyle = NSMutableParagraphStyle()
    paragraphStyle.alignment = .center

    let textAttributes: [NSAttributedString.Key: Any] = [
      .font: font,
      .foregroundColor: textColor,
      .paragraphStyle: paragraphStyle,
    ]

    let attributedString = NSAttributedString(string: text, attributes: textAttributes)

    let maxTextWidth = renderSize.width * 0.9
    let textRect = attributedString.boundingRect(
      with: CGSize(width: maxTextWidth - (horizontalPadding * 2), height: .greatestFiniteMagnitude),
      options: [.usesLineFragmentOrigin, .usesFontLeading],
      context: nil
    )

    let layerWidth = ceil(textRect.width) + (horizontalPadding * 2)
    let bottomPaddingAdjustment = font.descender * 0.5
    let layerHeight = ceil(textRect.height) + (verticalPadding * 2) + bottomPaddingAdjustment

    textLayer.string = attributedString
    textLayer.isWrapped = true
    textLayer.contentsScale = UIScreen.main.scale

    if let bgColor = UIColor(hexString: overlayColor), overlayColor.lowercased() != "#00000000" {
      textLayer.backgroundColor = bgColor.cgColor
      textLayer.cornerRadius = 8.0
    }

    var originX = xNormalized * renderSize.width
    var originY = yNormalized * renderSize.height

    let overflowMargin: CGFloat = layerWidth * 0.5 // changed at 8th october, 2025
    originX = min(max(originX, -overflowMargin), renderSize.width - layerWidth + overflowMargin) // changed at 8th october, 2025
    originY = min(max(originY, -overflowMargin), renderSize.height - layerHeight + overflowMargin) // changed at 8th october, 2025

    textLayer.frame = CGRect(x: originX, y: originY, width: layerWidth, height: layerHeight)

    textLayer.shouldRasterize = false
//    textLayer.rasterizationScale = UIScreen.main.scale * 2

//    let padding: CGFloat = finalFontSize * 0.3
//    let textWidth = ceil(textRect.width) + (padding * 2)
//    let textHeight = ceil(textRect.height) + (padding * 2)
//
//    let centerX = (xNormalized * renderSize.width) + (textWidth / 2.0)
//    let centerY = (yNormalized * renderSize.height) + (textHeight / 2.0)
//
//    let xSafeMargin: CGFloat = renderSize.width * 0.008
//    let ySafeMargin: CGFloat = renderSize.width * 0.02
//
//    let clampX = (renderSize.width - textWidth / 2.0)
//    let clampY = (renderSize.height - textHeight / 2.0)
//
//    textLayer.bounds = CGRect(x: 0, y: 0, width: textWidth, height: textHeight)
//    textLayer.position = CGPoint(
//      x: max(xSafeMargin + (textWidth/2.0), min(centerX, clampX - xSafeMargin)),
//      y: max(ySafeMargin + (textHeight/2.0), min(centerY, clampY - ySafeMargin))
//    )
//    textLayer.shouldRasterize = true
//    textLayer.rasterizationScale = UIScreen.main.scale * 2

//    let startTime = CMTime(seconds: startMs / 1000.0, preferredTimescale: 600)
//    let endTime = CMTime(seconds: endMs / 1000.0, preferredTimescale: 600)
//    let duration = CMTimeSubtract(endTime, startTime)

    let startTime = startMs / 1000.0
    let endTime = endMs / 1000.0
    let duration = endTime - startTime

    let opacityAnim = CAKeyframeAnimation(keyPath: "opacity")
    opacityAnim.values = [0.0, 1.0, 1.0, 0.0]
    opacityAnim.keyTimes = [0.0, 0.001, 0.999, 1.0]
//    opacityAnim.duration = CMTimeGetSeconds(duration)
    opacityAnim.duration = duration
//    opacityAnim.beginTime = CMTimeGetSeconds(startTime)
    opacityAnim.beginTime = AVCoreAnimationBeginTimeAtZero + startTime
    opacityAnim.isRemovedOnCompletion = false
    opacityAnim.fillMode = .both
    textLayer.add(opacityAnim, forKey: "opacity")

    return textLayer
  }

  // @objc(addSubtitlesToTemp:subtitleContent:subtitleFormat:tempFileName:verticalPosition:subtitleOverlayColor:subtitleColor:subtitleSize:resolve:reject:)
  // func addSubtitlesToTemp(
  //   _ videoPath: String,
  //   subtitleContent: String,
  //   subtitleFormat: String,
  //   tempFileName: String,
  //   verticalPosition: String,
  //   subtitleOverlayColor: String,
  //   subtitleColor: String,
  //   subtitleSize: Double,
  //   resolve: @escaping RCTPromiseResolveBlock,
  //   reject: @escaping RCTPromiseRejectBlock
  // ) {
  //   guard let videoURL = URL(string: videoPath) else {
  //     reject("E_INVALID_URL", "Invalid video URL", nil)
  //     return
  //   }

  //   recomposeVideoWithSubtitles(
  //     videoURL: videoURL,
  //     subtitleContent: subtitleContent,
  //     subtitleFormat: subtitleFormat,
  //     tempFileName: tempFileName,
  //     verticalPosition: verticalPosition,
  //     subtitleOverlayColor: subtitleOverlayColor,
  //     subtitleColor: subtitleColor,
  //     subtitleSize: subtitleSize
  //   ) { [weak self] exportedURL in
  //     if let url = exportedURL {
  //       resolve(url.absoluteString)
  //     } else {
  //       reject("E_SUBTITLE_FAILED", "Failed to add subtitles to video.", nil)
  //     }
  //   }
  // }

  // private func recomposeVideoWithSubtitles(
  //   videoURL: URL,
  //   subtitleContent: String,
  //   subtitleFormat: String,
  //   tempFileName: String,
  //   verticalPosition: String,
  //   subtitleOverlayColor: String,
  //   subtitleColor: String,
  //   subtitleSize: Double,
  //   completion: @escaping (URL?) -> Void
  // ) {
  //   let asset = AVURLAsset(url: videoURL)
  //   let composition = AVMutableComposition()

  //   guard let videoAssetTrack = asset.tracks(withMediaType: .video).first else {
  //     completion(nil)
  //     return
  //   }

  //   let timeRange = CMTimeRange(start: .zero, duration: asset.duration)

  //   guard
  //     let videoCompositionTrack = composition.addMutableTrack(
  //       withMediaType: .video, preferredTrackID: kCMPersistentTrackID_Invalid)
  //   else {
  //     completion(nil)
  //     return
  //   }

  //   do {
  //     try videoCompositionTrack.insertTimeRange(timeRange, of: videoAssetTrack, at: .zero)
  //   } catch {
  //     completion(nil)
  //     return
  //   }

  //   if let audioAssetTrack = asset.tracks(withMediaType: .audio).first,
  //     let audioCompositionTrack = composition.addMutableTrack(
  //       withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid)
  //   {
  //     try? audioCompositionTrack.insertTimeRange(timeRange, of: audioAssetTrack, at: .zero)
  //   }

  //   let subtitleCues: [SubtitleCue]
  //   switch subtitleFormat.lowercased() {
  //   case "json":
  //     subtitleCues = JsonSubtitleParser.parse(jsonString: subtitleContent)
  //   default:
  //     print("Unsupported subtitle format: \(subtitleFormat)")
  //     completion(nil)
  //     return
  //   }

  //   if subtitleCues.isEmpty {
  //     print("No valid subtitles found in content")
  //     completion(nil)
  //     return
  //   }

  //   guard let videoComposition = createVideoComposition(for: asset, composition: composition) else {
  //     completion(nil)
  //     return
  //   }

  //   let renderSize = videoComposition.renderSize

  //   let parentLayer = CALayer()
  //   parentLayer.frame = CGRect(origin: .zero, size: renderSize)
  //   parentLayer.backgroundColor = UIColor.clear.cgColor
  //   parentLayer.isGeometryFlipped = true

  //   // Create video layer
  //   let videoLayer = CALayer()
  //   videoLayer.frame = CGRect(origin: .zero, size: renderSize)
  //   videoLayer.backgroundColor = UIColor.black.cgColor
  //   parentLayer.addSublayer(videoLayer)

  //   for cue in subtitleCues {
  //     let textLayer = createSubtitleLayer(
  //       for: cue.text,
  //       within: CGRect(origin: .zero, size: renderSize),
  //       verticalPosition: verticalPosition,
  //       subtitleOverlayColor: subtitleOverlayColor,
  //       subtitleColor: subtitleColor,
  //       subtitleSize: subtitleSize
  //     )

  //     let startTime = CMTime(seconds: cue.start, preferredTimescale: 600)
  //     let endTime = CMTime(seconds: cue.end, preferredTimescale: 600)
  //     let duration = CMTimeSubtract(endTime, startTime)

  //     let opacityAnimation = CAKeyframeAnimation(keyPath: "opacity")
  //     opacityAnimation.values = [0.0, 1.0, 1.0, 0.0]
  //     opacityAnimation.keyTimes = [0.0, 0.1, 0.9, 1.0]
  //     opacityAnimation.duration = CMTimeGetSeconds(duration)
  //     opacityAnimation.beginTime = AVCoreAnimationBeginTimeAtZero + CMTimeGetSeconds(startTime)
  //     opacityAnimation.isRemovedOnCompletion = false
  //     opacityAnimation.fillMode = .both

  //     textLayer.add(opacityAnimation, forKey: "opacity")
  //     parentLayer.addSublayer(textLayer)
  //   }

  //   videoComposition.animationTool = AVVideoCompositionCoreAnimationTool(
  //     postProcessingAsVideoLayer: videoLayer,
  //     in: parentLayer
  //   )

  //   exportComposition(
  //     composition: composition,
  //     videoComposition: videoComposition,
  //     tempFileName: tempFileName,
  //     completion: completion
  //   )
  // }

  private func exportComposition(
    composition: AVMutableComposition,
    videoComposition: AVMutableVideoComposition,
    tempFileName: String,
    completion: @escaping (URL?) -> Void
  ) {
    let outputURL = getTempDirectory().appendingPathComponent(tempFileName)

    if FileManager.default.fileExists(atPath: outputURL.path) {
      try? FileManager.default.removeItem(at: outputURL)
    }

    guard composition.tracks(withMediaType: .video).first != nil else {
      print("❌ No video track found in composition before export")
      completion(nil)
      return
    }

    let sourceBitrate = self.originalVideoBitrate

    exportWithAssetWriter(
      asset: composition,
      videoComposition: videoComposition,
      audioMix: nil,
      outputURL: outputURL,
      sourceBitrate: sourceBitrate
    ) { result in
        switch result {
        case .success(let url):
          completion(url)
        case .failure(let error):
          print("Export failed: \(error.localizedDescription)")
          completion(nil)
        }
    }
  }

//   private func createSubtitleLayer(
//     for text: String,
//     within videoBounds: CGRect,
//     verticalPosition: String = "bottom",
//     subtitleOverlayColor: String = "#00000080",
//     subtitleColor: String = "#FFFFFF",
//     subtitleSize: Double
//   ) -> CATextLayer {
//     let textLayer = CATextLayer()

//     let basePointSize = CGFloat(subtitleSize)
//     let screenHeight = UIScreen.main.bounds.height
// //    let dpToPx = CGFloat(subtitleSize) * UIScreen.main.scale
//     let scaleFactor = videoBounds.height / screenHeight
//     let adjustedFontSize = basePointSize * scaleFactor
//     let dynamicFontSize = max(12.0, min(120.0, adjustedFontSize))

//     print("📏 [Subtitle] Input size: \(subtitleSize)dp, Base points: \(basePointSize), Video ratio: \(scaleFactor), Final size: \(dynamicFontSize)")

//     var resolvedTextColor = UIColor.white
//     if let colorFromConfig = UIColor(hexString: subtitleColor) {
//       resolvedTextColor = colorFromConfig
//     }

//     textLayer.string = text
//     textLayer.fontSize = dynamicFontSize
//     textLayer.foregroundColor = resolvedTextColor.cgColor
//     textLayer.alignmentMode = .center
//     textLayer.isWrapped = true
//     textLayer.truncationMode = .end

//     let fontName = "Inter-Bold"
//     textLayer.font = CTFontCreateWithName(fontName as CFString, dynamicFontSize, nil)

//     var resolvedOverlayColor = UIColor.black.withAlphaComponent(0.75)
//     if let overlayFromConfig = UIColor(hexString: subtitleOverlayColor) {
//       resolvedOverlayColor = overlayFromConfig
//     }

//     textLayer.backgroundColor = resolvedOverlayColor.cgColor
//     textLayer.cornerRadius = 8.0

//     let horizontalMargin: CGFloat = videoBounds.width * 0.06  // 6% of width
//     let bottomMargin: CGFloat = videoBounds.height * 0.08  // 8% of height
//     let topMargin: CGFloat = videoBounds.height * 0.06  // smaller top margin
//     let padding: CGFloat = dynamicFontSize * 0.25  // tighter padding
//     let maxWidth = videoBounds.width - (2 * horizontalMargin)

//     // Calculate text bounds
//     let font = UIFont(name: fontName, size: dynamicFontSize) ?? UIFont.boldSystemFont(ofSize: dynamicFontSize)
//     let textAttributes: [NSAttributedString.Key: Any] = [.font: font]

//     let textRect = (text as NSString).boundingRect(
//       with: CGSize(width: maxWidth - (padding * 2.2), height: .greatestFiniteMagnitude),
//       options: [.usesLineFragmentOrigin, .usesFontLeading],
//       attributes: textAttributes,
//       context: nil
//     )

//     let textWidth = min(ceil(textRect.width) + (padding * 2), maxWidth)
//     let textHeight = ceil(textRect.height) + (padding * 1)

//     let xPosition = videoBounds.minX + (videoBounds.width - textWidth) / 2
//     let yPosition: CGFloat

//     switch verticalPosition.lowercased() {
//     case "top":
//       yPosition = videoBounds.minY + topMargin
//     case "center":
//       yPosition = videoBounds.minY + (videoBounds.height - textHeight) / 2
//     case "bottom":
//       yPosition = videoBounds.maxY - bottomMargin - textHeight
//     default:
//       yPosition = videoBounds.maxY - bottomMargin - textHeight
//     }

//     textLayer.frame = CGRect(
//       x: xPosition,
//       y: yPosition,
//       width: textWidth,
//       height: textHeight
//     )

//     textLayer.shouldRasterize = true
//     textLayer.rasterizationScale = max(1.0, UIScreen.main.scale * scaleFactor)

//     return textLayer
//   }

//  @objc(exportVideoFromTemp:fileName:resolve:reject:)
//  func exportVideoFromTemp(
//    _ videoPath: String,
//    fileName: String,
//    resolve: @escaping RCTPromiseResolveBlock,
//    rejecter: @escaping RCTPromiseRejectBlock
//  ) {
//    print("🎬 [NATIVE] Starting export for:", videoPath)
//    print("📝 [NATIVE] Export filename:", fileName)
//
//    var videoURL: URL
//
//    if videoPath.hasPrefix("file://") {
//      guard let url = URL(string: videoPath) else {
//        rejecter("E_INVALID_URL", "Invalid video URL for export.", nil)
//        return
//      }
//      videoURL = url
//    } else {
//      videoURL = URL(fileURLWithPath: videoPath)
//    }
//
//    print("🔗 [NATIVE] Processed video URL:", videoURL.absoluteString)
//
//    guard FileManager.default.fileExists(atPath: videoURL.path) else {
//      rejecter("E_FILE_NOT_FOUND", "Video file not found at path: \(videoURL.path)", nil)
//      return
//    }
//
//    saveVideoToDownloads(url: videoURL, fileName: fileName) { [weak self] result in
//      switch result {
//      case .success(let message):
//        print("✅ [NATIVE] Export successful:", message)
//        self?.cleanupTemp()
//        resolve(message)
//      case .failure(let error):
//        print("❌ [NATIVE] Export failed:", error.localizedDescription)
//        rejecter("E_EXPORT_FAILED", error.localizedDescription, error)
//      }
//    }
//  }

  @objc func cleanupTemp() {
    let tempDir = getTempDirectory()
    try? FileManager.default.removeItem(at: tempDir)
    try? FileManager.default.createDirectory(at: tempDir, withIntermediateDirectories: true)
  }

//  private func saveVideoToDownloads(
//    url: URL,
//    fileName: String,
//    completion: @escaping (Result<String, Error>) -> Void
//  ) {
//    let documentsPath = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)
//      .first!
//    let finalURL = documentsPath.appendingPathComponent(fileName)
//
//    do {
//      if FileManager.default.fileExists(atPath: finalURL.path) {
//        try FileManager.default.removeItem(at: finalURL)
//      }
//
//      guard FileManager.default.fileExists(atPath: url.path) else {
//        throw NSError(domain: "FileManagerError", code: 404, userInfo: [
//            NSLocalizedDescriptionKey: "Source video file not found"])
//      }
//
//      try FileManager.default.copyItem(at: url, to: finalURL)
//
//      saveToPhotosLibrary(url: url) { photosResult in
//        switch photosResult {
//        case .success:
//          completion(.success("Video exported to Documents and Photos: \(finalURL.path)"))
//        case .failure(_):
//          completion(.success("Video exported to Documents: \(finalURL.path)"))
//        }
//      }
//    } catch {
//      completion(.failure(error))
//    }
//  }

//  private func saveToPhotosLibrary(url: URL, completion: @escaping (Result<Void, Error>) -> Void) {
//    let status = PHPhotoLibrary.authorizationStatus()
//    if status == .denied || status == .restricted {
//      completion(.failure(NSError(domain: "PhotosError", code: 403, userInfo: [
//              NSLocalizedDescriptionKey: "Photos access denied"])))
//      return
//    }
//
//    if status == .notDetermined {
//      PHPhotoLibrary.requestAuthorization { newStatus in
//        if newStatus == .authorized || newStatus == .limited {
//          self.performPhotosSave(url: url, completion: completion)
//        } else {
//          completion(.failure(NSError(domain: "PhotosError", code: 403, userInfo: [
//                  NSLocalizedDescriptionKey: "Photos access denied"])))
//        }
//      }
//    } else {
//      performPhotosSave(url: url, completion: completion)
//    }
//  }

//  private func performPhotosSave(url: URL, completion: @escaping (Result<Void, Error>) -> Void) {
//    PHPhotoLibrary.shared().performChanges({
//      PHAssetChangeRequest.creationRequestForAssetFromVideo(atFileURL: url)
//    }) { saved, error in
//      if saved {
//        completion(.success(()))
//      } else {
//        completion(.failure(error ?? NSError(domain: "PhotosError", code: 500, userInfo: [
//                  NSLocalizedDescriptionKey: "Unknown Photos save error"])))
//      }
//    }
//  }

  @objc
  static func requiresMainQueueSetup() -> Bool {
    return true
  }
}
