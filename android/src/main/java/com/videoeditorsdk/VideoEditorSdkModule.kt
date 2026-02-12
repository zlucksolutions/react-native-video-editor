package com.videoeditorsdk

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.*
import android.media.MediaMetadataRetriever
import android.net.Uri
// import android.text.Layout
// import android.text.SpannableString
// import android.text.StaticLayout
// import android.text.TextPaint
import android.util.Log
import androidx.core.graphics.createBitmap
import androidx.core.graphics.toColorInt
import androidx.core.net.toUri
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.common.util.UnstableApi
import androidx.media3.effect.*
import androidx.media3.transformer.*
import com.facebook.react.bridge.*
import kotlinx.coroutines.*
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import kotlin.coroutines.suspendCoroutine
import kotlin.math.max
import androidx.media3.common.Effect
import androidx.media3.common.audio.AudioProcessor
import androidx.media3.common.audio.BaseAudioProcessor
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import java.nio.ByteBuffer
import kotlin.coroutines.Continuation
import kotlin.math.ceil


fun jsonArrayToReadableArray(jsonArray: JSONArray): ReadableArray {
  val writableArray = Arguments.createArray()
  for (i in 0 until jsonArray.length()) {
    val value = jsonArray.get(i)
    when (value) {
      is JSONObject -> writableArray.pushMap(jsonObjectToMap(value))
      is JSONArray -> writableArray.pushArray(jsonArrayToReadableArray(value))
      is Boolean -> writableArray.pushBoolean(value)
      is Int -> writableArray.pushInt(value)
      is Double -> writableArray.pushDouble(value)
      is String -> writableArray.pushString(value)
      else -> writableArray.pushNull()
    }
  }
  return writableArray
}

fun jsonObjectToMap(jsonObject: JSONObject): ReadableMap {
  val map = Arguments.createMap()
  val keys = jsonObject.keys()
  while (keys.hasNext()) {
    val key = keys.next()
    val value = jsonObject.get(key)
    when (value) {
      is JSONObject -> map.putMap(key, jsonObjectToMap(value))
      is JSONArray -> map.putArray(key, jsonArrayToReadableArray(value))
      is Boolean -> map.putBoolean(key, value)
      is Int -> map.putInt(key, value)
      is Double -> map.putDouble(key, value)
      is String -> map.putString(key, value)
      else -> map.putNull(key)
    }
  }
  return map
}


data class VoiceOverTimeRange(val startMs: Long, val endMs: Long)
@UnstableApi
class DynamicDuckingAudioProcessor(
    private val voiceOverRanges: List<VoiceOverTimeRange>,
    sampleRate: Int = 44100 // Default sample rate, will be updated in configure
) : BaseAudioProcessor() {

    private var actualSampleRate: Int = sampleRate
    private var bytesProcessed: Long = 0

    override fun onConfigure(inputAudioFormat: AudioProcessor.AudioFormat): AudioProcessor.AudioFormat {
        actualSampleRate = inputAudioFormat.sampleRate
        bytesProcessed = 0
        return inputAudioFormat
    }

    override fun onFlush() {
        bytesProcessed = 0
    }

    override fun onReset() {
        bytesProcessed = 0
    }

    override fun queueInput(inputBuffer: ByteBuffer) {
        val outputBuffer = replaceOutputBuffer(inputBuffer.remaining())

        // Calculate current position in milliseconds
        val bytesPerSample = 2
        val channels = 2
        val bytesPerFrame = bytesPerSample * channels

        while (inputBuffer.hasRemaining()) {
            val currentTimeMs = (bytesProcessed / bytesPerFrame / actualSampleRate.toFloat() * 1000).toLong()

            // Check if current time is within any voiceover range
            val isDuringVoiceOver = voiceOverRanges.any { range ->
                currentTimeMs >= range.startMs && currentTimeMs <= range.endMs
            }

            // Apply volume adjustment
            val volumeMultiplier = if (isDuringVoiceOver) 0.70f else 1.0f

            val sample = inputBuffer.short
            val adjustedSample = (sample * volumeMultiplier).toInt()
                .coerceIn(Short.MIN_VALUE.toInt(), Short.MAX_VALUE.toInt())
            outputBuffer.putShort(adjustedSample.toShort())

            bytesProcessed += bytesPerSample
        }

        outputBuffer.flip()
    }
}

@UnstableApi
class VolumeBoostAudioProcessor(private val volumeMultiplier: Float) : BaseAudioProcessor() {
    override fun onConfigure(inputAudioFormat: AudioProcessor.AudioFormat): AudioProcessor.AudioFormat {
        return inputAudioFormat
    }

    override fun queueInput(inputBuffer: ByteBuffer) {
        val outputBuffer = replaceOutputBuffer(inputBuffer.remaining())

        while (inputBuffer.hasRemaining()) {
            val sample = inputBuffer.short
            val adjustedSample = (sample * volumeMultiplier).toInt()
                .coerceIn(Short.MIN_VALUE.toInt(), Short.MAX_VALUE.toInt())
            outputBuffer.putShort(adjustedSample.toShort())
        }

        outputBuffer.flip()
    }
}

@UnstableApi
class VideoProcessingModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "VideoEditor"

    private var originalVideoUri: String? = null
    @Volatile
    private var videoWidth: Int = 0
    @Volatile
    private var videoHeight: Int = 0

    @ReactMethod
    fun setOriginalVideoPath(path: String) {
        originalVideoUri = path
        Log.d("VideoProcessing", "Original video path set: $path")
    }

    private fun getTempDir(): File {
        val tempDir = File(reactContext.cacheDir, "video_editing")
        if (!tempDir.exists()) {
            tempDir.mkdirs()
        }
        return tempDir
    }

    private fun generateTempFileName(operation: String): String {
        return "temp_${operation}_${System.currentTimeMillis()}.mp4"
    }

    @ReactMethod
    fun cleanupTempFiles() {
        try {
            val tempDir = getTempDir()
            if (tempDir.exists()) {
                tempDir.deleteRecursively()
                tempDir.mkdirs()
            }
            Log.d("VideoProcessing", "Temp files cleaned up")
        } catch (e: Exception) {
            Log.e("VideoProcessing", "Failed to cleanup temp files: ${e.message}")
        }
    }

    private fun createPromiseCallback(continuation: Continuation<String>): Promise {
        return object : Promise {
            override fun resolve(value: Any?) {
                continuation.resume(value as String)
            }

            override fun reject(code: String, message: String?) {
                continuation.resumeWithException(Exception(message ?: "Operation failed"))
            }

            override fun reject(code: String, throwable: Throwable?) {
                continuation.resumeWithException(throwable ?: Exception("Operation failed"))
            }

            override fun reject(code: String, message: String?, throwable: Throwable?) {
                continuation.resumeWithException(throwable ?: Exception(message ?: "Operation failed"))
            }

            override fun reject(throwable: Throwable) {
                continuation.resumeWithException(throwable)
            }

            override fun reject(throwable: Throwable, userInfo: WritableMap) {
                continuation.resumeWithException(throwable)
            }

            override fun reject(code: String, userInfo: WritableMap) {
                continuation.resumeWithException(Exception(code))
            }

            override fun reject(code: String, throwable: Throwable?, userInfo: WritableMap) {
                continuation.resumeWithException(throwable ?: Exception(code))
            }

            override fun reject(code: String, message: String?, userInfo: WritableMap) {
                continuation.resumeWithException(Exception(message ?: code))
            }

            override fun reject(
                code: String?,
                message: String?,
                throwable: Throwable?,
                userInfo: WritableMap?
            ) {
                continuation.resumeWithException(throwable ?: Exception(message ?: code ?: "Operation failed"))
            }

            @Deprecated("Prefer passing a module-specific error code to JS. Using this method will pass the\n error code UNSPECIFIED",
                replaceWith = ReplaceWith("reject(code, message)")
            )
            override fun reject(message: String) {
                continuation.resumeWithException(Exception(message))
            }
        }
    }

    private fun updateVideoDimensions(videoUri: String): Pair<Int, Int> {
        val retriever = MediaMetadataRetriever()
        try {
            retriever.setDataSource(reactContext, videoUri.toUri())
            val widthStr = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_WIDTH)
            val heightStr = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_HEIGHT)
            val rotationStr = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_ROTATION) ?: "0"
            var width = widthStr?.toInt() ?: 0
            var height = heightStr?.toInt() ?: 0
            val rotation = rotationStr.toInt()

            if (rotation == 90 || rotation == 270) {
                val temp = width
                width = height
                height = temp
            }
            this.videoWidth = width
            this.videoHeight = height
            Log.d("VideoProcessing", "Updated video dimensions: ${width}x${height}")
            return Pair(width, height)
        } catch (e: Exception) {
            Log.e("VideoProcessing", "Failed to update video dimensions for URI: $videoUri", e)
            return Pair(0, 0)
        } finally {
            retriever.release()
        }
    }

    @Suppress("DEPRECATION")
    @ReactMethod
    fun applyPortraitFrameToTemp(videoUriString: String, tempFileName: String,targetBitrate: Int, promise: Promise) {
        val uri = try {
            videoUriString.toUri()
        } catch (e: Exception) {
            promise.reject("E_INVALID_URI", "Invalid video URI: ${e.message}")
            return
        }

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val outputFile = File(getTempDir(), tempFileName)

                // Use context-aware setDataSource to handle both file and asset URIs
                val retriever = MediaMetadataRetriever()
                retriever.setDataSource(reactContext, uri)
                val widthStr = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_WIDTH)
                val heightStr = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_HEIGHT)
                val rotationStr = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_ROTATION) ?: "0"
                retriever.release()

                if (widthStr == null || heightStr == null) {
                    promise.reject("E_METADATA_ERROR", "Could not extract video dimensions")
                    return@launch
                }

                var width = widthStr.toInt()
                var height = heightStr.toInt()
                val rotation = rotationStr.toInt()

                if (rotation == 90 || rotation == 270) {
                    val temp = width
                    width = height
                    height = temp
                }

                // Use URI directly instead of converting to File (handles assets properly)
                val mediaItem = MediaItem.Builder()
                    .setUri(uri)
                    .build()

                // Apply portrait frame (9:16) using Presentation
                val portraitFrame = Presentation.createForAspectRatio(9f / 16f, Presentation.LAYOUT_SCALE_TO_FIT)
                val effects = Effects(emptyList(), listOf(portraitFrame))

                val editedMediaItem = EditedMediaItem.Builder(mediaItem)
                    .setEffects(effects)
                    .build()

                val sequence = EditedMediaItemSequence(editedMediaItem)
                val composition = Composition.Builder(listOf(sequence)).build()

                withContext(Dispatchers.Main) {
                    val transformer = createTransformerWithBitrate(
                        reactContext,
                        targetBitrate,
                        object : Transformer.Listener {
                            override fun onCompleted(composition: Composition, exportResult: ExportResult) {
                                promise.resolve(Uri.fromFile(outputFile).toString())
                            }

                            override fun onError(
                                composition: Composition,
                                exportResult: ExportResult,
                                exportException: ExportException
                            ) {
                                promise.reject("E_PORTRAIT_FRAME_FAILED", "Portrait frame failed: ${exportException.message}")
                            }
                        },
                        enablePortrait = true
                    )

                    transformer.start(composition, outputFile.absolutePath)
                }

            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    promise.reject("E_PORTRAIT_FRAME_ERROR", "Portrait frame error: ${e.message}")
                }
            }
        }
    }

    private fun getOriginalBitrate(videoUri: String): Int {
        val retriever = MediaMetadataRetriever()
        try {
            retriever.setDataSource(reactContext, videoUri.toUri())
            val bitrate = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_BITRATE)
            val originalBitrate = bitrate?.toInt() ?: 3_000_000

            val targetBitrate = (originalBitrate * 0.9).toInt()

            Log.d("VideoProcessing", "Original bitrate: $originalBitrate, Target bitrate: $targetBitrate")
            return targetBitrate
        } catch (e: Exception) {
            Log.e("VideoProcessing", "Failed to get bitrate, using default", e)
            return 3_000_000 // Default fallback
        } finally {
            retriever.release()
        }
    }

    private fun createTransformerWithBitrate(
        context: Context,
        videoBitrate: Int,
        listener: Transformer.Listener,
        enablePortrait: Boolean = false
    ): Transformer {
        val transformerBuilder = Transformer.Builder(context)
            .addListener(listener)
            .setVideoMimeType(MimeTypes.VIDEO_H264)
            .setAudioMimeType(MimeTypes.AUDIO_AAC)
            .setEncoderFactory(
                DefaultEncoderFactory.Builder(context)
                    .setRequestedVideoEncoderSettings(
                        VideoEncoderSettings.Builder()
                            .setBitrate(videoBitrate)
                            .build()
                    )
                    .setRequestedAudioEncoderSettings(
                        AudioEncoderSettings.Builder()
                            .setBitrate(128_000) // 128 kbps for audio
                            .build()
                    )
                    .build()
            )

        if (enablePortrait) {
            transformerBuilder.setPortraitEncodingEnabled(true)
        }

        return transformerBuilder.build()
    }

    // Bridge method to match iOS interface - accepts ReadableMap and converts to JSON string
    @ReactMethod
    fun applyEdits(config: ReadableMap, promise: Promise) {
        try {
            // Convert ReadableMap to JSON string
            val jsonObject = JSONObject()
            val videoElementsArray = config.getArray("videoElements")

            if (videoElementsArray == null) {
                promise.reject("E_INVALID_CONFIG", "videoElements array is missing from config")
                return
            }

            val jsonArray = JSONArray()
            for (i in 0 until videoElementsArray.size()) {
                val element = videoElementsArray.getMap(i)
                if (element != null) {
                    jsonArray.put(convertMapToJson(element))
                }
            }

            jsonObject.put("videoElements", jsonArray)
            val payload = jsonObject.toString()

            // Call the existing processVideoEditing method
            processVideoEditing(payload, promise)
        } catch (e: Exception) {
            Log.e("VideoProcessing", "Failed to convert config to JSON", e)
            promise.reject("E_CONFIG_CONVERSION", "Failed to convert config: ${e.message}", e)
        }
    }

    // Helper method to convert ReadableMap to JSONObject
    private fun convertMapToJson(readableMap: ReadableMap): JSONObject {
        val jsonObject = JSONObject()
        val iterator = readableMap.keySetIterator()

        while (iterator.hasNextKey()) {
            val key = iterator.nextKey()
            when (readableMap.getType(key)) {
                com.facebook.react.bridge.ReadableType.Null -> jsonObject.put(key, null)
                com.facebook.react.bridge.ReadableType.Boolean -> jsonObject.put(key, readableMap.getBoolean(key))
                com.facebook.react.bridge.ReadableType.Number -> jsonObject.put(key, readableMap.getDouble(key))
                com.facebook.react.bridge.ReadableType.String -> jsonObject.put(key, readableMap.getString(key))
                com.facebook.react.bridge.ReadableType.Map -> {
                    val nestedMap = readableMap.getMap(key)
                    if (nestedMap != null) {
                        jsonObject.put(key, convertMapToJson(nestedMap))
                    }
                }
                com.facebook.react.bridge.ReadableType.Array -> {
                    val array = readableMap.getArray(key)
                    if (array != null) {
                        jsonObject.put(key, convertArrayToJson(array))
                    }
                }
            }
        }

        return jsonObject
    }

    // Helper method to convert ReadableArray to JSONArray
    private fun convertArrayToJson(readableArray: com.facebook.react.bridge.ReadableArray): JSONArray {
        val jsonArray = JSONArray()

        for (i in 0 until readableArray.size()) {
            when (readableArray.getType(i)) {
                com.facebook.react.bridge.ReadableType.Null -> jsonArray.put(null)
                com.facebook.react.bridge.ReadableType.Boolean -> jsonArray.put(readableArray.getBoolean(i))
                com.facebook.react.bridge.ReadableType.Number -> jsonArray.put(readableArray.getDouble(i))
                com.facebook.react.bridge.ReadableType.String -> jsonArray.put(readableArray.getString(i))
                com.facebook.react.bridge.ReadableType.Map -> {
                    val map = readableArray.getMap(i)
                    if (map != null) {
                        jsonArray.put(convertMapToJson(map))
                    }
                }
                com.facebook.react.bridge.ReadableType.Array -> {
                    val array = readableArray.getArray(i)
                    if (array != null) {
                        jsonArray.put(convertArrayToJson(array))
                    }
                }
            }
        }

        return jsonArray
    }

    @ReactMethod
    fun processVideoEditing(payload: String, promise: Promise) {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val jsonObject = JSONObject(payload)
                val videoElements = jsonObject.getJSONArray("videoElements")

                if (videoElements.length() == 0) {
                    promise.reject("E_NO_ELEMENTS", "Video elements array is empty.")
                    return@launch
                }

                var sourceVideoUri: String? = null
                var shouldMuteVideo = false

                for (i in 0 until videoElements.length()) {
                    val element = videoElements.getJSONObject(i)
                    if (element.getString("type") == "videoUri") {
                        sourceVideoUri = element.getString("uri")
                        shouldMuteVideo = element.optBoolean("muted", false)
                        break
                    }
                }

                if (sourceVideoUri == null) {
                    promise.reject("E_NO_SOURCE_VIDEO", "No source video URI found in configuration")
                    return@launch
                }

                var currentVideoUri = sourceVideoUri
                Log.d("VideoProcessing", "Starting processing with source URI: $currentVideoUri")

                val targetBitrate = getOriginalBitrate(currentVideoUri)

                val (width, height) = updateVideoDimensions(currentVideoUri)

                val hasCropOperation = (0 until videoElements.length()).any {
                    videoElements.getJSONObject(it).getString("type") == "crop"
                }

                val isLandscape = width >= height

                if (isLandscape && !hasCropOperation) {
                    Log.d("VideoProcessing", "Landscape video detected without crop. Applying portrait frame.")
                    val tempFileName = generateTempFileName("portrait_frame")
                    currentVideoUri = suspendCoroutine { cont ->
                        applyPortraitFrameToTemp(currentVideoUri!!, tempFileName, targetBitrate, createPromiseCallback(cont))
                    }
                    updateVideoDimensions(currentVideoUri!!)
                }

                if (shouldMuteVideo) {
                    Log.d("VideoProcessing", "Applying mute to source video")
                    val muteFileName = generateTempFileName("mute")
                    currentVideoUri = suspendCoroutine { cont ->
                        muteVideoAudio(currentVideoUri!!, muteFileName, targetBitrate, createPromiseCallback(cont))
                    }
                }

                val priorityOperations = mutableListOf<JSONObject>()
                val otherOperations = mutableListOf<JSONObject>()

                for (i in 0 until videoElements.length()) {
                    val element = videoElements.getJSONObject(i)
                    when (element.getString("type")) {
                        "trim", "crop" -> priorityOperations.add(element)
                        "videoUri" -> { }
                        else -> otherOperations.add(element)
                    }
                }

                val allOperations = priorityOperations + otherOperations

                var i = 0
                while (i < allOperations.size) {
                    val element = allOperations[i]
                    val type = element.getString("type")
                    Log.d("VideoProcessing", "Processing element of type: $type")

                    when (type) {
                        "trim" -> {
                            if (!element.has("startTime") || !element.has("endTime")) {
                                Log.w("VideoProcessing", "Skipping trim: startTime or endTime is missing")
                                continue
                            }
                            val startTime = element.getDouble("startTime") * 1000
                            val endTime = element.getDouble("endTime") * 1000
                            val tempFileName = generateTempFileName("trim")
                            Log.d("VideoProcessing", "✂️ Applying Trim: ${startTime}ms to ${endTime}ms")
                            Log.d("VideoProcessing", "   Input URI: $currentVideoUri")

                            currentVideoUri = suspendCoroutine { cont ->
                                trimVideoToTemp(currentVideoUri!!, startTime, endTime, tempFileName, targetBitrate, createPromiseCallback(cont))
                            }
                            Log.d("VideoProcessing", "   Output URI: $currentVideoUri")
                            updateVideoDimensions(currentVideoUri!!)
                        }

                        "crop" -> {
                            val aspectRatio = element.optString("selection_params", "original")
                            if (aspectRatio == "original" || aspectRatio.isEmpty()) {
                                Log.d("VideoProcessing", "Skipping crop: original ratio selected or empty")
                                continue
                            }
                            val tempFileName = generateTempFileName("crop")
                            Log.d("VideoProcessing", "✂️ Applying Crop: $aspectRatio")
                            Log.d("VideoProcessing", "   Input URI: $currentVideoUri")

                            currentVideoUri = suspendCoroutine { cont ->
                                cropVideoToTemp(currentVideoUri!!, aspectRatio, tempFileName, targetBitrate, createPromiseCallback(cont))
                            }
                            Log.d("VideoProcessing", "   Output URI: $currentVideoUri")
                            updateVideoDimensions(currentVideoUri!!)
                        }

                        "audio" -> {
                            val musicUri = element.optString("musicUri", null)
                            if (musicUri.isNullOrEmpty()) {
                                Log.w("VideoProcessing", "Skipping audio: musicUri is null or empty")
                                continue
                            }
                            val audioOffset = element.optDouble("audioOffset", 0.0) * 1000
                            val isLooped = element.optBoolean("isLooped", false)
                            val tempFileName = generateTempFileName("bgm")

                            val videoRetriever = MediaMetadataRetriever()
                            videoRetriever.setDataSource(reactContext, currentVideoUri!!.toUri())
                            val videoDurationMs =
                              videoRetriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)?.toLong() ?: 0L
                            videoRetriever.release()

                            val audioRetriever = MediaMetadataRetriever()
                            audioRetriever.setDataSource(reactContext, musicUri.toUri())
                            val audioDurationMs = audioRetriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)?.toLong() ?: 0L
                            audioRetriever.release()

                            val startTime = 0.0
                            val endTime = if (isLooped) audioDurationMs.toDouble() else videoDurationMs.toDouble()

                            Log.d("VideoProcessing", "🎵 Applying BGM: $musicUri")
                            Log.d("VideoProcessing", "   Audio duration: ${audioDurationMs}ms, Video duration: ${videoDurationMs}ms, Loop: $isLooped")
                            Log.d("VideoProcessing", "   Input URI: $currentVideoUri")

                            currentVideoUri = suspendCoroutine { cont ->
                                addTrimmedAudioToTemp(currentVideoUri!!, musicUri, startTime, endTime, audioOffset, tempFileName, targetBitrate, isLooped, createPromiseCallback(cont))
                            }
                            Log.d("VideoProcessing", "   Output URI: $currentVideoUri")
                        }

                        "addTextOverlay" -> {
                            val textOverlays = mutableListOf<JSONObject>()
                            while (i < allOperations.size && allOperations[i].getString("type") == "addTextOverlay") {
                                textOverlays.add(allOperations[i])
                                i++
                            }
                            i--

                            if (textOverlays.isNotEmpty()) {
                                Log.d("VideoProcessing", "📝 Applying a batch of ${textOverlays.size} text overlays")
                                Log.d("VideoProcessing", "   Input URI: $currentVideoUri")
                                currentVideoUri = processTextOverlays(currentVideoUri!!, textOverlays, videoWidth, videoHeight, targetBitrate)
                                Log.d("VideoProcessing", "   Output URI: $currentVideoUri")
                            }
                        }

                        // "subtitle" -> {
                        //     val subtitleJson = element.getJSONArray("subtitleJson").toString()
                        //     val subtitleSize = element.optDouble("subtitleSize", 26.0)
                        //     val subtitlePosition = element.optString("subtitlePosition", "bottom")
                        //     val subtitleColor = element.optString("subtitleColor", "#FFFFFF")
                        //     val subtitleOverlayColor = element.optString("subtitleOverlayColor", "#80000000")
                        //     val tempFileName = generateTempFileName("subtitle")
                        //     Log.d("VideoProcessing", "Applying Subtitles")

                        //     currentVideoUri = suspendCoroutine { cont ->
                        //         addSubtitlesToTemp(currentVideoUri!!, subtitleJson, "json", tempFileName,
                        //             subtitlePosition, subtitleOverlayColor, subtitleColor, subtitleSize, targetBitrate, createPromiseCallback(cont))
                        //     }
                        // }

                        "addVoiceOver" -> {
                            val voiceOvers = mutableListOf<JSONObject>()
                            while (i < allOperations.size && allOperations[i].getString("type") == "addVoiceOver") {
                                voiceOvers.add(allOperations[i])
                                i++
                            }
                            i--

                            if (voiceOvers.isNotEmpty()) {
                                Log.d("VideoProcessing", "🎤 Applying a batch of ${voiceOvers.size} voice overs")
                                Log.d("VideoProcessing", "   Input URI: $currentVideoUri")
                                currentVideoUri = processVoiceOvers(currentVideoUri!!, voiceOvers, targetBitrate)
                                Log.d("VideoProcessing", "   Output URI: $currentVideoUri")
                            }
                        }
                    }
                    i++
                }

                Log.d("VideoProcessing", "🎬 All operations completed")
                Log.d("VideoProcessing", "   Final URI before export: $currentVideoUri")
                Log.d("VideoProcessing", "   URI scheme: ${currentVideoUri?.toUri()?.scheme}")

                if (currentVideoUri == null) {
                    throw IllegalStateException("Current video URI is null after processing")
                }

                val finalFileName = "QueryLoom_${System.currentTimeMillis()}.mp4"
                Log.d("VideoProcessing", "📤 Exporting final video: $finalFileName")
                exportVideoFromTemp(currentVideoUri, finalFileName, promise)

            } catch (e: Exception) {
                Log.e("VideoProcessing", "Processing failed", e)
                withContext(Dispatchers.Main) {
                    promise.reject("E_PROCESSING_FAILED", "Video processing failed: ${e.message}")
                }
            }
        }
    }

    private suspend fun processTextOverlays(
        videoUri: String,
        textOverlays: List<JSONObject>,
        videoWidth: Int,
        videoHeight: Int,
        targetBitrate: Int
    ): String {
        return suspendCoroutine { cont ->
            try {
                Log.d("VideoProcessing", "📝 processTextOverlays called with ${textOverlays.size} overlays")
                Log.d("VideoProcessing", "   Video dimensions: ${videoWidth}x${videoHeight}")

                val overlaysArray = JSONArray()

                textOverlays.forEach { element ->
                    Log.d("VideoProcessing", "   Raw overlay data: $element")
                    val text = element.optString("text", "")
                    if (text.isEmpty()) {
                        Log.w("VideoProcessing", "Skipping text overlay: text is empty")
                        return@forEach
                    }

                    if (!element.has("textPosition") || element.isNull("textPosition")) {
                        Log.w("VideoProcessing", "Skipping text overlay: textPosition is missing")
                        return@forEach
                    }

                    if (!element.has("startTime") || !element.has("endTime")) {
                        Log.w("VideoProcessing", "Skipping text overlay: startTime or endTime is missing")
                        return@forEach
                    }

                    val overlayObj = JSONObject().apply {
                        put("text", text)
                        put("startTimeMs", element.getDouble("startTime") * 1000)
                        put("endTimeMs", element.getDouble("endTime") * 1000)
                        put("fontSize", element.optDouble("fontSize", 24.0))
                        put("color", element.optString("textColor", "#FFFFFF"))
                        put("backgroundColor", element.optString("textOverlayColor", null.toString()))

                        val position = element.getJSONObject("textPosition")

                        val screenWidth = element.optDouble("screenWidth", videoWidth.toDouble())
                        val screenHeight = element.optDouble("screenHeight", videoHeight.toDouble())
                        val xAxis = position.getDouble("xAxis")
                        val yAxis = position.getDouble("yAxis")

//                        val xOffsetPercent = 0.05f
//                        val xOffset = videoWidth * xOffsetPercent

//                        val xPosVideo = (xAxis / screenWidth) * videoWidth
//                        val yPosVideo = (yAxis / screenHeight) * videoHeight

                        put("xPos", xAxis)
                        put("yPos", yAxis)
                        put("screenWidth", screenWidth)
                        put("screenHeight", screenHeight)
                    }
                    overlaysArray.put(overlayObj)
                }

                val tempFileName = generateTempFileName("text_batch")
                Log.d("VideoProcessing", "Processing ${textOverlays.size} text overlays")

                addTextOverlayToTemp(videoUri, jsonArrayToReadableArray(overlaysArray), tempFileName, targetBitrate, createPromiseCallback(cont))

            } catch (e: Exception) {
                cont.resumeWithException(e)
            }
        }
    }

    private suspend fun processVoiceOvers(videoUri: String, voiceOvers: List<JSONObject>, targetBitrate: Int): String {
        if (voiceOvers.isEmpty()) return videoUri
        val tempFileName = generateTempFileName("voiceover_batch")
        val readableArray = Arguments.createArray()
        voiceOvers.forEach { obj ->
            readableArray.pushMap(jsonObjectToMap(obj))
        }
        return suspendCoroutine { cont ->
            addVoiceOversToTemp(videoUri, readableArray, tempFileName, targetBitrate, createPromiseCallback(cont))
        }
    }

    @Suppress("DEPRECATION")
    @ReactMethod
    fun trimVideoToTemp(videoUriString: String, startTimeMs: Double, endTimeMs: Double, tempFileName: String, targetBitrate: Int, promise: Promise) {
        val uri = try {
            videoUriString.toUri()
        } catch (e: Exception) {
            promise.reject("E_INVALID_URI", "Invalid video URI: ${e.message}")
            return
        }

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val outputFile = File(getTempDir(), tempFileName)

                // Use URI directly to handle both file and asset URIs
                val mediaItem = MediaItem.Builder()
                    .setUri(uri)
                    .setClippingConfiguration(
                        MediaItem.ClippingConfiguration.Builder()
                            .setStartPositionMs(startTimeMs.toLong())
                            .setEndPositionMs(endTimeMs.toLong())
                            .build()
                    )
                    .build()

                val editedMediaItem = EditedMediaItem.Builder(mediaItem).build()
                val sequence = EditedMediaItemSequence(editedMediaItem)
                val composition = Composition.Builder(listOf(sequence)).build()

                withContext(Dispatchers.Main) {
                    val transformer = createTransformerWithBitrate(
                        reactContext,
                        targetBitrate,
                        object : Transformer.Listener {
                            override fun onCompleted(composition: Composition, exportResult: ExportResult) {
                                promise.resolve(Uri.fromFile(outputFile).toString())
                            }

                            override fun onError(
                                composition: Composition,
                                exportResult: ExportResult,
                                exportException: ExportException
                            ) {
                                promise.reject("E_TRIM_FAILED", "Trim failed: ${exportException.message}")
                            }
                        }
                    )
                    transformer.start(composition, outputFile.absolutePath)
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    promise.reject("E_TRIM_ERROR", "Trim error: ${e.message}")
                }
            }
        }
    }

    @Suppress("DEPRECATION")
    @ReactMethod
    fun muteVideoAudio(videoUriString: String, tempFileName: String,targetBitrate: Int, promise: Promise) {
        val uri = try {
            videoUriString.toUri()
        } catch (e: Exception) {
            promise.reject("E_INVALID_URI", "Invalid video URI: ${e.message}")
            return
        }

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val outputFile = File(getTempDir(), tempFileName)

                // Use URI directly to handle both file and asset URIs
                val mediaItem = MediaItem.Builder()
                    .setUri(uri)
                    .build()

                val editedMediaItem = EditedMediaItem.Builder(mediaItem)
                    .setRemoveAudio(true)
                    .build()

                val sequence = EditedMediaItemSequence(editedMediaItem)
                val composition = Composition.Builder(listOf(sequence)).build()

                withContext(Dispatchers.Main) {
                    val transformer = createTransformerWithBitrate(
                        reactContext,
                        targetBitrate,
                        object : Transformer.Listener {
                            override fun onCompleted(composition: Composition, exportResult: ExportResult) {
                                promise.resolve(Uri.fromFile(outputFile).toString())
                            }

                            override fun onError(
                                composition: Composition,
                                exportResult: ExportResult,
                                exportException: ExportException
                            ) {
                                promise.reject("E_MUTE_FAILED", "Mute failed: ${exportException.message}")
                            }
                        }
                    )

                    transformer.start(composition, outputFile.absolutePath)
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    promise.reject("E_MUTE_ERROR", "Mute error: ${e.message}")
                }
            }
        }
    }

    @Suppress("DEPRECATION")
    @ReactMethod
    fun cropVideoToTemp(videoUriString: String, aspectRatio: String, tempFileName: String, targetBitrate: Int, promise: Promise) {
        val uri = try {
            videoUriString.toUri()
        } catch (e: Exception) {
            promise.reject("E_INVALID_URI", "Invalid video URI: ${e.message}")
            return
        }

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val outputFile = File(getTempDir(), tempFileName)

                // Use context-aware setDataSource to handle both file and asset URIs
                val retriever = MediaMetadataRetriever()
                retriever.setDataSource(reactContext, uri)
                val widthStr = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_WIDTH)
                val heightStr = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_HEIGHT)
                val rotationStr = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_ROTATION) ?: "0"
                retriever.release()

                if (widthStr == null || heightStr == null) {
                    promise.reject("E_METADATA_ERROR", "Could not extract video dimensions")
                    return@launch
                }

                var width = widthStr.toInt()
                var height = heightStr.toInt()
                val rotation = rotationStr.toInt()

                if (rotation == 90 || rotation == 270) {
                    val temp = width
                    width = height
                    height = temp
                }

                // Use URI directly to handle both file and asset URIs
                val mediaItem = MediaItem.Builder()
                    .setUri(uri)
                    .build()

                val cropEffect = createCropEffect(aspectRatio, width, height)
                val videoEffects = mutableListOf<Effect>(cropEffect)

                if (aspectRatio != "9:16") {
                    val portraitFrame = Presentation.createForAspectRatio(9f / 16f, Presentation.LAYOUT_SCALE_TO_FIT)
                    videoEffects.add(portraitFrame)
                }
                val effects = Effects(emptyList(), videoEffects)

                val editedMediaItem = EditedMediaItem.Builder(mediaItem)
                    .setEffects(effects)
                    .build()

                val sequence = EditedMediaItemSequence(editedMediaItem)
                val composition = Composition.Builder(listOf(sequence)).build()

                withContext(Dispatchers.Main) {
                    val transformer = createTransformerWithBitrate(
                        reactContext,
                        targetBitrate,
                        object : Transformer.Listener {
                            override fun onCompleted(composition: Composition, exportResult: ExportResult) {
                                promise.resolve(Uri.fromFile(outputFile).toString())
                            }

                            override fun onError(
                                composition: Composition,
                                exportResult: ExportResult,
                                exportException: ExportException
                            ) {
                                promise.reject("E_CROP_FAILED", "Crop failed: ${exportException.message}")
                            }
                        },
                        enablePortrait = true
                    )

                    transformer.start(composition, outputFile.absolutePath)
                }

            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    promise.reject("E_CROP_ERROR", "Crop error: ${e.message}")
                }
            }
        }
    }

    @Suppress("DEPRECATION")
    @ReactMethod
    fun addTrimmedAudioToTemp(
        videoUriString: String,
        audioUriString: String,
        audioStartMs: Double,
        audioEndMs: Double,
        audioOffset: Double,
        tempFileName: String,
        targetBitrate: Int,
        isLooped: Boolean = false,
        promise: Promise
    ) {
        val videoUri = try {
            videoUriString.toUri()
        } catch (e: Exception) {
            promise.reject("E_INVALID_URI", "Invalid video URI: ${e.message}")
            return
        }

        val audioUri = try {
            audioUriString.toUri()
        } catch (e: Exception) {
            promise.reject("E_INVALID_AUDIO_URI", "Invalid audio URI: ${e.message}")
            return
        }

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val outputFile = File(getTempDir(), tempFileName)

                // Get video duration - use context-aware setDataSource for asset support
                val videoRetriever = MediaMetadataRetriever()
                videoRetriever.setDataSource(reactContext, videoUri)
                val videoDurationStr = videoRetriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)
                val videoDurationMs = videoDurationStr?.toLong() ?: 0L
                videoRetriever.release()

                // Use URI directly to handle both file and asset URIs
                val videoMediaItem = MediaItem.Builder()
                    .setUri(videoUri)
                    .build()

                val editedVideoItem = EditedMediaItem.Builder(videoMediaItem).build()

                val videoSequence = EditedMediaItemSequence(editedVideoItem)

                val audioClipDurationMs = audioEndMs - audioStartMs
                val audioSequenceBuilder = EditedMediaItemSequence.Builder()

                if (isLooped && audioClipDurationMs > 0) {
                    Log.d("VideoProcessing", "Audio looping enabled. Video duration: ${videoDurationMs}ms, Audio clip duration: ${audioClipDurationMs}ms")

                    var currentPositionMs = 0L
                    var loopCount = 0

                    // Calculate how many times we need to loop
                    val requiredLoops = ceil(videoDurationMs.toDouble() / audioClipDurationMs).toInt()

                    while (currentPositionMs < videoDurationMs && loopCount < requiredLoops) {
                        val remainingDurationMs = videoDurationMs - currentPositionMs
                        val currentLoopDurationMs = minOf(audioClipDurationMs.toLong(), remainingDurationMs)

                        // Use audioUri directly to handle both file and asset URIs
                        val audioMediaItem = MediaItem.Builder()
                            .setUri(audioUri)
                            .setClippingConfiguration(
                                MediaItem.ClippingConfiguration.Builder()
                                    .setStartPositionMs(audioOffset.toLong())
                                    .setEndPositionMs((audioOffset + currentLoopDurationMs).toLong())
                                    .build()
                            )
                            .build()
                        val editedAudioItem = EditedMediaItem.Builder(audioMediaItem).build()
                        audioSequenceBuilder.addItem(editedAudioItem)

                        currentPositionMs += currentLoopDurationMs
                        loopCount++

                        Log.d("VideoProcessing", "Added audio loop ${loopCount}: duration ${currentLoopDurationMs}ms, total position: ${currentPositionMs}ms")
                    }
                    Log.d("VideoProcessing", "Audio looping complete. Total loops: $loopCount")
                } else {
                    // Original non-looped behavior
                    Log.d("VideoProcessing", "Audio looping disabled. Playing audio once.")

                    // Use audioUri directly to handle both file and asset URIs
                    val audioMediaItem = MediaItem.Builder()
                        .setUri(audioUri)
                        .setClippingConfiguration(
                            MediaItem.ClippingConfiguration.Builder()
                                .setStartPositionMs(audioOffset.toLong())
                                .setEndPositionMs((audioOffset + (audioEndMs - audioStartMs)).toLong())
                                .build()
                        )
                        .build()

                    val editedAudioItem = EditedMediaItem.Builder(audioMediaItem).build()
                    audioSequenceBuilder.addItem(editedAudioItem)
                }

                val audioSequence = audioSequenceBuilder.build()
                val composition = Composition.Builder(listOf(videoSequence, audioSequence)).build()

                withContext(Dispatchers.Main) {
                    val transformer = createTransformerWithBitrate(
                        reactContext,
                        targetBitrate,
                        object : Transformer.Listener {
                            override fun onCompleted(composition: Composition, exportResult: ExportResult) {
                                promise.resolve(Uri.fromFile(outputFile).toString())
                            }

                            override fun onError(
                                composition: Composition,
                                exportResult: ExportResult,
                                exportException: ExportException
                            ) {
                                promise.reject("E_AUDIO_ADD_FAILED", "Audio addition failed: ${exportException.message}")
                            }
                        }
                    )

                    transformer.start(composition, outputFile.absolutePath)
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    promise.reject("E_AUDIO_ADD_ERROR", "Audio addition error: ${e.message}")
                }
            }
        }
    }

    @Suppress("DEPRECATION")
    @ReactMethod
    fun addTextOverlayToTemp(
        videoUriString: String,
        overlays: ReadableArray,
        outputFileName: String,
        targetBitrate: Int,
        promise: Promise
    ) {
        val uri = try {
            videoUriString.toUri()
        } catch (e: Exception) {
            promise.reject("E_INVALID_URI", "Invalid video URI: ${e.message}")
            return
        }

        CoroutineScope(Dispatchers.IO).launch {
            try {
                Log.d("VideoProcessing", "📝 addTextOverlayToTemp called")
                Log.d("VideoProcessing", "   Video URI: $videoUriString")
                Log.d("VideoProcessing", "   Number of overlays: ${overlays.size()}")

                val outputFile = File(getTempDir(), outputFileName)

                // Use context-aware setDataSource to handle both file and content URIs
                val retriever = MediaMetadataRetriever()
                try {
                    retriever.setDataSource(reactContext, uri)
                    Log.d("VideoProcessing", "✅ Successfully set data source for text overlay")
                } catch (e: Exception) {
                    Log.e("VideoProcessing", "❌ Failed to set data source: ${e.message}")
                    throw e
                }

                val widthStr = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_WIDTH)
                val heightStr = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_HEIGHT)
                val rotationStr = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_ROTATION) ?: "0"
                retriever.release()

                Log.d("VideoProcessing", "   Video dimensions: ${widthStr}x${heightStr}, rotation: $rotationStr")

                if (widthStr == null || heightStr == null) {
                    promise.reject("E_METADATA_ERROR", "Could not extract video dimensions")
                    return@launch
                }

                var videoWidth = widthStr.toInt()
                var videoHeight = heightStr.toInt()
                val rotation = rotationStr.toInt()

                if (rotation == 90 || rotation == 270) {
                    val temp = videoWidth
                    videoWidth = videoHeight
                    videoHeight = temp
                }

                val timedOverlays = mutableListOf<TimedBitmapOverlay>()

                for (i in 0 until overlays.size()) {
                    val overlay = overlays.getMap(i) ?: continue

                    Log.d("VideoProcessing", "   Processing overlay #$i")

                    val text = overlay.getString("text") ?: ""
                    val startTimeMs = overlay.getDouble("startTimeMs").toLong()
                    val endTimeMs = overlay.getDouble("endTimeMs").toLong()

                    Log.d("VideoProcessing", "      Text: '$text'")
                    Log.d("VideoProcessing", "      Time: ${startTimeMs}ms - ${endTimeMs}ms")
                    val fontSizeLogical = try {
                        overlay.getDouble("fontSize").toFloat()
                    } catch (e: Exception) {
                        24f
                    }
                    val colorString = overlay.getString("color") ?: "#FFFFFF"
//                    val backgroundColorString = overlay.getString("backgroundColor")
                    val backgroundColorString = if (overlay.hasKey("backgroundColor") && !overlay.isNull("backgroundColor")) {
                        val bgColor = overlay.getString("backgroundColor")
                        if (bgColor.isNullOrEmpty() || bgColor == "null" || bgColor == "undefined") {
                            null
                        } else {
                            bgColor
                        }
                    } else {
                        null
                    }

                    val androidX = overlay.getDouble("xPos").toFloat()
                    val androidY = overlay.getDouble("yPos").toFloat()

                    val screenWidth = try {
                        overlay.getDouble("screenWidth")
                    } catch (e: Exception) {
                        videoWidth.toDouble()
                    }
                    val screenHeight = try {
                        overlay.getDouble("screenHeight")
                    } catch (e: Exception) {
                        videoHeight.toDouble()
                    }

                    Log.d("VideoProcessing", "      Position: x=$androidX, y=$androidY")
                    Log.d("VideoProcessing", "      Screen: ${screenWidth}x${screenHeight}")
                    Log.d("VideoProcessing", "      Video: ${videoWidth}x${videoHeight}")

                    val timedOverlay = TimedBitmapOverlay(
                        text = text,
                        startTimeMs = startTimeMs,
                        endTimeMs = endTimeMs,
                        xPos = androidX,
                        yPos = androidY,
                        fontSizePixels = fontSizeLogical,
                        color = colorString,
                        backgroundColor = backgroundColorString,
                        videoWidth = videoWidth,
                        videoHeight = videoHeight,
                        screenWidth = screenWidth,
                        screenHeight = screenHeight
                    )
                    timedOverlays.add(timedOverlay)
                }

                Log.d("VideoProcessing", "   Creating media item with ${timedOverlays.size} overlays")

                // Use URI directly to handle both file and asset URIs
                val mediaItem = MediaItem.Builder()
                    .setUri(uri)
                    .build()

                val effects = if (timedOverlays.isNotEmpty()) {
                    Log.d("VideoProcessing", "   Creating overlay effects")
                    Effects(
                        emptyList(),
                        listOf(OverlayEffect(timedOverlays.map { it.asBitmapOverlay() }))
                    )
                } else {
                    Log.d("VideoProcessing", "   No overlays to apply")
                    Effects.EMPTY
                }

                val editedMediaItem = EditedMediaItem.Builder(mediaItem)
                    .setEffects(effects)
                    .build()

                val sequence = EditedMediaItemSequence(editedMediaItem)
                val composition = Composition.Builder(listOf(sequence)).build()

                withContext(Dispatchers.Main) {
                    Log.d("VideoProcessing", "   Starting transformer for text overlay")
                    val transformer = createTransformerWithBitrate(
                        reactContext,
                        targetBitrate,
                        object : Transformer.Listener {
                            override fun onCompleted(composition: Composition, exportResult: ExportResult) {
                                Log.d("VideoProcessing", "✅ Text overlay completed successfully")
                                promise.resolve(Uri.fromFile(outputFile).toString())
                            }

                            override fun onError(
                                composition: Composition,
                                exportResult: ExportResult,
                                exportException: ExportException
                            ) {
                                Log.e("VideoProcessing", "❌ Text overlay transformer failed: ${exportException.message}")
                                Log.e("VideoProcessing", "   Error cause: ${exportException.cause}")
                                promise.reject("E_TEXT_OVERLAY_FAILED", "Text overlay failed: ${exportException.message}")
                            }
                        }
                    )

                    transformer.start(composition, outputFile.absolutePath)
                }

            } catch (e: Exception) {
                Log.e("VideoProcessing", "❌ Text overlay exception: ${e.message}")
                Log.e("VideoProcessing", "   Stack trace: ${e.stackTraceToString()}")
                withContext(Dispatchers.Main) {
                    promise.reject("E_TEXT_OVERLAY_ERROR", "Text overlay error: ${e.message}")
                }
            }
        }
    }

    // @Suppress("DEPRECATION")
    // @ReactMethod
    // fun addSubtitlesToTemp(
    //     videoUriString: String,
    //     subtitleContent: String,
    //     subtitleFormat: String,
    //     tempFileName: String,
    //     verticalPosition: String,
    //     subtitleOverlayColor: String,
    //     subtitleColor: String,
    //     subtitleSize: Double,
    //     targetBitrate: Int,
    //     promise: Promise
    // ) {
    //     val uri = try {
    //         videoUriString.toUri()
    //     } catch (e: Exception) {
    //         promise.reject("E_INVALID_URI", "Invalid video URI: ${e.message}")
    //         return
    //     }

    //     CoroutineScope(Dispatchers.IO).launch {
    //         try {
    //             val inputFile = File(uri.path!!)
    //             val outputFile = File(getTempDir(), tempFileName)

    //             val retriever = MediaMetadataRetriever()
    //             retriever.setDataSource(inputFile.absolutePath)
    //             val widthStr = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_WIDTH)
    //             val heightStr = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_HEIGHT)
    //             retriever.release()

    //             if (widthStr == null || heightStr == null) {
    //                 promise.reject("E_METADATA_ERROR", "Could not extract video dimensions")
    //                 return@launch
    //             }

    //             videoWidth = widthStr.toInt()
    //             videoHeight = heightStr.toInt()

    //             val subtitleCues = when (subtitleFormat.lowercase()) {
    //                 "json" -> JsonSubtitleParser.parse(subtitleContent)
    //                 else -> {
    //                     promise.reject("E_INVALID_FORMAT", "Unsupported subtitle format: $subtitleFormat")
    //                     return@launch
    //                 }
    //             }

    //             if (subtitleCues.isEmpty()) {
    //                 promise.reject("E_NO_SUBTITLES", "No valid subtitles found in content")
    //                 return@launch
    //             }

    //             val mediaItem = MediaItem.Builder()
    //                 .setUri(Uri.fromFile(inputFile))
    //                 .build()

    //             val textOverlay = TimedTextOverlay(
    //                 subtitleCues,
    //                 videoWidth,
    //                 videoHeight,
    //                 verticalPosition,
    //                 subtitleColor,
    //                 subtitleOverlayColor,
    //                 subtitleSize.toFloat(),
    //                 reactContext
    //             )
    //             val overlayEffect = OverlayEffect(listOf(textOverlay))
    //             val effects = Effects(emptyList(), listOf(overlayEffect))

    //             val editedMediaItem = EditedMediaItem.Builder(mediaItem)
    //                 .setEffects(effects)
    //                 .build()

    //             val sequence = EditedMediaItemSequence(editedMediaItem)
    //             val composition = Composition.Builder(listOf(sequence)).build()

    //             withContext(Dispatchers.Main) {
    //                 val transformer = createTransformerWithBitrate(
    //                     reactContext,
    //                     targetBitrate,
    //                     object : Transformer.Listener {
    //                         override fun onCompleted(composition: Composition, exportResult: ExportResult) {
    //                             promise.resolve(Uri.fromFile(outputFile).toString())
    //                         }

    //                         override fun onError(
    //                             composition: Composition,
    //                             exportResult: ExportResult,
    //                             exportException: ExportException
    //                         ) {
    //                             promise.reject("E_ADD_SUBTITLES_FAILED", "Add subtitles failed: ${exportException.message}")
    //                         }
    //                     }
    //                 )

    //                 transformer.start(composition, outputFile.absolutePath)
    //             }

    //         } catch (e: Exception) {
    //             withContext(Dispatchers.Main) {
    //                 promise.reject("E_ADD_SUBTITLES_ERROR", "Add subtitles error: ${e.message}")
    //             }
    //         }
    //     }
    // }

    @Suppress("DEPRECATION")
    @ReactMethod
    fun addVoiceOversToTemp(
        videoUriString: String,
        voiceOvers: ReadableArray,
        tempFileName: String,
        targetBitrate: Int,
        promise: Promise
    ) {
        val videoUri = try {
            videoUriString.toUri()
        } catch (e: Exception) {
            promise.reject("E_INVALID_URI", "Invalid video URI: ${e.message}")
            return
        }

        val voiceOverList = mutableListOf<ReadableMap>()

        for (i in 0 until voiceOvers.size()) {
            val map = voiceOvers.getMap(i)
            if (map != null) {
                voiceOverList.add(map)
            }
        }

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val outputFile = File(getTempDir(), tempFileName)

                // Extract voiceover time ranges for dynamic ducking
                val voiceOverRanges = voiceOverList.map { vo ->
                    val startTimeMs = (vo.getDouble("startTime") * 1000).toLong()
                    val endTimeMs = (vo.getDouble("endTime") * 1000).toLong()
                    VoiceOverTimeRange(startTimeMs, endTimeMs)
                }

                Log.d("VideoProcessing", "Creating dynamic ducking for ${voiceOverRanges.size} voiceover segments")
                voiceOverRanges.forEachIndexed { index, range ->
                    Log.d("VideoProcessing", "Voiceover $index: ${range.startMs}ms - ${range.endMs}ms")
                }

                // Use URI directly to handle both file and asset URIs
                val videoMediaItem = MediaItem.Builder()
                    .setUri(videoUri)
                    .build()

                val dynamicDuckingProcessor = DynamicDuckingAudioProcessor(voiceOverRanges)

                val videoEffects = Effects(
                    listOf(dynamicDuckingProcessor),
                    emptyList()
                )

                val editedVideoItem = EditedMediaItem.Builder(videoMediaItem)
                    .setEffects(videoEffects)
                    .build()

                val videoSequence = EditedMediaItemSequence(editedVideoItem)

                val audioSeqBuilder = EditedMediaItemSequence.Builder()
                var currentUs = 0L
                var needForceAudioTrack = false

                val sortedVoiceOvers = voiceOverList.sortedBy {
                  it.getDouble("startTime")
                }

                for (vo in sortedVoiceOvers) {
                    val startTimeMs = (vo.getDouble("startTime") * 1000).toLong()
                    val endTimeMs = (vo.getDouble("endTime") * 1000).toLong()
                    val durationMs = endTimeMs - startTimeMs

                    val startUs = startTimeMs * 1000L
                    val durationUs = durationMs * 1000L

                    val gapUs = startUs - currentUs
                    if (gapUs > 0L) {
                        audioSeqBuilder.addGap(gapUs)
                        if (currentUs == 0L) needForceAudioTrack = true
                        currentUs += gapUs
                    }

                    val voiceOverUri = vo.getString("voiceOverUri")
                        ?: return@launch promise.reject("INVALID_INPUT", "voiceOverUri is required")

                    val voiceUri = voiceOverUri.toUri()
                    // Use URI directly to handle both file and asset URIs
                    val voiceMediaItem = MediaItem.Builder()
                        .setUri(voiceUri)
                        .setClippingConfiguration(
                            MediaItem.ClippingConfiguration.Builder()
                                .setStartPositionMs(0)
                                .setEndPositionMs(durationMs)
                                .build()
                        )
                        .build()

                    val voiceVolumeBoost = VolumeBoostAudioProcessor(1.5f)

                    val voiceEffects = Effects(
                        listOf(voiceVolumeBoost),
                        emptyList()
                    )

                    val editedVoice = EditedMediaItem.Builder(voiceMediaItem)
                        .setRemoveVideo(true)
                        .setEffects(voiceEffects)
                        .build()

                    audioSeqBuilder.addItem(editedVoice)
                    currentUs += durationUs
                }

                if (needForceAudioTrack) {
                    audioSeqBuilder.experimentalSetForceAudioTrack(true)
                }

                val audioSequence = audioSeqBuilder.build()
                val composition = Composition.Builder(listOf(videoSequence, audioSequence)).build()

                withContext(Dispatchers.Main) {
                    val transformer = createTransformerWithBitrate(
                        reactContext,
                        targetBitrate,
                        object : Transformer.Listener {
                            override fun onCompleted(composition: Composition, exportResult: ExportResult) {
                                promise.resolve(Uri.fromFile(outputFile).toString())
                            }

                            override fun onError(
                                composition: Composition,
                                exportResult: ExportResult,
                                exportException: ExportException
                            ) {
                                promise.reject("E_VOICEOVER_ADD_FAILED", "Voiceover addition failed: ${exportException.message}")
                            }
                        }
                    )

                    transformer.start(composition, outputFile.absolutePath)
                }

            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    promise.reject("E_VOICEOVER_ADD_ERROR", "Voiceover addition error: ${e.message}")
                }
            }
        }
    }


    @ReactMethod
    fun exportVideoFromTemp(tempVideoUriString: String, finalFileName: String, promise: Promise) {
        Log.d("VideoProcessing", "📤 exportVideoFromTemp called")
        Log.d("VideoProcessing", "   Temp URI: $tempVideoUriString")
        Log.d("VideoProcessing", "   Final filename: $finalFileName")

        val tempUri = try {
            tempVideoUriString.toUri()
        } catch (e: Exception) {
            Log.e("VideoProcessing", "❌ Invalid URI: ${e.message}")
            promise.reject("E_INVALID_URI", "Invalid video URI: ${e.message}")
            return
        }

        CoroutineScope(Dispatchers.IO).launch {
            try {
                // Handle different URI schemes
                val tempFile = when (tempUri.scheme) {
                    "file" -> {
                        // file:// URIs - extract path
                        val path = tempUri.path
                        if (path == null) {
                            throw IllegalArgumentException("File URI has no path: $tempVideoUriString")
                        }
                        File(path)
                    }
                    "content" -> {
                        // content:// URIs - copy to temp file
                        Log.w("VideoProcessing", "⚠️ Received content:// URI, copying to temp file")
                        val tempOutputFile = File(getTempDir(), "export_${System.currentTimeMillis()}.mp4")
                        reactContext.contentResolver.openInputStream(tempUri)?.use { input ->
                            tempOutputFile.outputStream().use { output ->
                                input.copyTo(output)
                            }
                        }
                        tempOutputFile
                    }
                    else -> {
                        // Try direct path conversion as fallback
                        val path = tempUri.path
                        if (path != null) {
                            File(path)
                        } else {
                            throw IllegalArgumentException("Unsupported URI scheme: ${tempUri.scheme}")
                        }
                    }
                }

                Log.d("VideoProcessing", "   Resolved file path: ${tempFile.absolutePath}")

                if (!tempFile.exists()) {
                    Log.e("VideoProcessing", "❌ File not found at: ${tempFile.absolutePath}")
                    throw IllegalArgumentException("Temporary video file not found at: ${tempFile.absolutePath}")
                }

                Log.d("VideoProcessing", "✅ Export successful: ${tempFile.absolutePath}")
                withContext(Dispatchers.Main) {
                    promise.resolve(tempFile.absolutePath)
                }

            } catch (e: Exception) {
                Log.e("VideoProcessing", "❌ Export failed: ${e.message}")
                Log.e("VideoProcessing", "   Stack trace: ${e.stackTraceToString()}")
                withContext(Dispatchers.Main) {
                    promise.reject("E_EXPORT_FAILED", "Export failed: ${e.message}")
                }
            }
        }
    }

    @SuppressLint("NewApi")
    private data class TimedBitmapOverlay(
        val text: String,
        val startTimeMs: Long,
        val endTimeMs: Long,
        val xPos: Float,
        val yPos: Float,
        val fontSizePixels: Float,
        val color: String,
        val backgroundColor: String?,
        val videoWidth: Int,
        val videoHeight: Int,
        val screenWidth: Double,
        val screenHeight: Double
    ) {
        private fun createTextBitmap(targetTextPx: Float, colorString: String): Bitmap {
            val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = try {
                    colorString.toColorInt()
                } catch (e: IllegalArgumentException) {
                    Color.WHITE
                }
                textSize = targetTextPx
                typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
                textAlign = Paint.Align.LEFT
            }

            val textBounds = Rect()
            paint.getTextBounds(text, 0, text.length, textBounds)

            val paddingPx = (targetTextPx * 0.4f).toInt()
            val bitmapWidth = textBounds.width() + 2 * paddingPx
            val bitmapHeight = textBounds.height() + 2 * paddingPx

            val finalWidth = max(1, bitmapWidth)
            val finalHeight = max(1, bitmapHeight)

            val bitmap = createBitmap(finalWidth, finalHeight, Bitmap.Config.ARGB_8888)
            val canvas = Canvas(bitmap)

            if (!backgroundColor.isNullOrEmpty() && backgroundColor != "null") {
                try {
                    val backgroundPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                        color = backgroundColor.toColorInt()
                    }

                    val cornerRadius = targetTextPx * 0.2f
                    val rect = RectF(0f, 0f, finalWidth.toFloat(), finalHeight.toFloat())
                    canvas.drawRoundRect(rect, cornerRadius, cornerRadius, backgroundPaint)
                } catch (e: IllegalArgumentException) {
                    // Invalid color string, skip background
                }
            }

            val x = paddingPx.toFloat()
            val baseline = paddingPx - textBounds.top.toFloat()
            canvas.drawText(text, x, baseline, paint)

            return bitmap
        }

        fun asBitmapOverlay(): BitmapOverlay {
            val textBitmap = createTextBitmap(fontSizePixels, color)
            val textWidthInVideo = textBitmap.width.toFloat()
            val textHeightInVideo = textBitmap.height.toFloat()

            return object : BitmapOverlay() {
                override fun getBitmap(presentationTimeUs: Long): Bitmap {
                    val timeMs = presentationTimeUs / 1000
                    return if (timeMs in startTimeMs..endTimeMs) textBitmap else emptyBitmap()
                }

                override fun getOverlaySettings(presentationTimeUs: Long): StaticOverlaySettings {
                    // Convert screen coordinates to video coordinates
                    // React Native gives us TOP-LEFT corner position (xPos, yPos)
                    // We need to convert to CENTER position for proper alignment

                    // Step 1: Convert top-left position from screen space to video space
                    val xTopLeftInVideo = (xPos / screenWidth.toFloat()) * videoWidth.toFloat()
                    val yTopLeftInVideo = (yPos / screenHeight.toFloat()) * videoHeight.toFloat()

                    // Step 2: Calculate the CENTER position of the text in video space
                    // Add half of text dimensions to get center from top-left
                    val xCenterInVideo = xTopLeftInVideo + (textWidthInVideo / 2f)
                    val yCenterInVideo = yTopLeftInVideo + (textHeightInVideo / 2f)

                    // Step 3: Normalize center position to [-1, 1] range
                    // Media3 uses center origin with normalized coords:
                    // X: -1 = left edge, 0 = center, 1 = right edge
                    // Y: 1 = top edge, 0 = center, -1 = bottom edge
                    val xNormalized = (xCenterInVideo / videoWidth.toFloat() * 2f) - 1f
                    val yNormalized = 1f - (yCenterInVideo / videoHeight.toFloat() * 2f)

                    // Clamp to valid range
                    val clampedX = xNormalized.coerceIn(-1f, 1f)
                    val clampedY = yNormalized.coerceIn(-1f, 1f)

                    return StaticOverlaySettings.Builder()
                        .setBackgroundFrameAnchor(clampedX, clampedY)
                        .setOverlayFrameAnchor(0.5f, 0.5f)  // Anchor at CENTER of text for proper alignment
                        .build()
                }
            }
        }

        @SuppressLint("UseKtx")
        private fun emptyBitmap(): Bitmap =
            Bitmap.createBitmap(1, 1, Bitmap.Config.ARGB_8888).apply {
                eraseColor(Color.TRANSPARENT)
            }
    }

    // @UnstableApi
    // class TimedTextOverlay(
    //     private val subtitleCues: List<SubtitleCue>,
    //     private val videoWidth: Int,
    //     private val videoHeight: Int,
    //     private val verticalPosition: String = "bottom",
    //     private val subtitleColor: String = "#FFFFFF",
    //     private val subtitleOverlayColor: String = "#80000000",
    //     private val subtitleSize: Float = 26f,
    //     private val context: Context
    // ) : TextOverlay() {

    //     override fun getText(presentationTimeUs: Long): SpannableString {
    //         for (cue in subtitleCues) {
    //             if (presentationTimeUs in cue.startTimeUs..cue.endTimeUs) {
    //                 return SpannableString(cue.text)
    //             }
    //         }
    //         return SpannableString("")
    //     }

    //     override fun getBitmap(presentationTimeUs: Long): Bitmap {
    //         val text = getText(presentationTimeUs)
    //         if (text.isEmpty()) {
    //             return createEmptyBitmap()
    //         }
    //         val textSize = subtitleSize
    //         Log.d("VideoProcessing", "Subtitle size - RN: $subtitleSize, Video: $textSize, Video dimensions: ${videoWidth}x${videoHeight}"
    //         )

    //         val portraitFrameWidth = (videoHeight * 9f / 16f).toInt()
    //         val maxWidth = (portraitFrameWidth * 1.5f).toInt()

    //         val textPaint = createTextPaint(textSize)
    //         val layout = createLayout(text, textPaint, maxWidth)

    //         val textBoxPadding = (textSize * 0.5f).toInt()
    //         val bitmapWidth = layout.width + (2 * textBoxPadding)
    //         val bitmapHeight = layout.height + (2 * textBoxPadding)

    //         return createStyledBitmap(layout, bitmapWidth, bitmapHeight, textPaint, textBoxPadding)
    //     }

    //     override fun getOverlaySettings(presentationTimeUs: Long): StaticOverlaySettings {
    //         val verticalAnchor = when (verticalPosition.lowercase()) {
    //             "top" -> 0.85f
    //             "center" -> 0.0f
    //             "bottom" -> -0.75f
    //             else -> -0.75f
    //         }

    //         val overlayAnchorY = when (verticalPosition.lowercase()) {
    //             "top" -> 1.0f
    //             "center" -> 0.5f
    //             "bottom" -> 0.0f
    //             else -> 0.0f
    //         }

    //         return StaticOverlaySettings.Builder()
    //             .setBackgroundFrameAnchor(0.0f, verticalAnchor)
    //             .setOverlayFrameAnchor(0.0f, overlayAnchorY)
    //             .setAlphaScale(1f)
    //             .setScale(1f, 1f)
    //             .build()
    //     }

    //     private fun createTextPaint(textSize: Float): TextPaint {
    //         val textPaint = TextPaint(Paint.ANTI_ALIAS_FLAG)

    //         textPaint.color = try {
    //             val color = subtitleColor.toColorInt()
    //             Log.d("VideoProcessing", "Subtitle text color applied: $subtitleColor -> $color")
    //             color
    //         } catch (e: Exception) {
    //             Log.e("VideoProcessing", "Failed to parse subtitle color: $subtitleColor, using white", e)
    //             Color.WHITE
    //         }

    //         textPaint.textSize = textSize
    //         textPaint.typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
    //         return textPaint
    //     }

    //     private fun createLayout(text: CharSequence, textPaint: TextPaint, width: Int): StaticLayout {
    //         return StaticLayout.Builder.obtain(text, 0, text.length, textPaint, width)
    //             .setAlignment(Layout.Alignment.ALIGN_CENTER)
    //             .setLineSpacing(0.15f, 1.15f)
    //             .setIncludePad(true)
    //             .build()
    //     }

    //     @SuppressLint("UseKtx")
    //     private fun createEmptyBitmap(): Bitmap {
    //         return Bitmap.createBitmap(1, 1, Bitmap.Config.ARGB_8888)
    //     }

    //     @SuppressLint("UseKtx")
    //     private fun createStyledBitmap(
    //         layout: StaticLayout,
    //         width: Int,
    //         height: Int,
    //         textPaint: TextPaint,
    //         verticalPadding: Int
    //     ): Bitmap {
    //         val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
    //         val canvas = Canvas(bitmap)

    //         val backgroundPaint = Paint()
    //         backgroundPaint.color = try {
    //             val overlayColor = if (subtitleOverlayColor.startsWith("#") && subtitleOverlayColor.length == 9) {
    //                 if (subtitleOverlayColor == "#00000080") {
    //                     "#80000000".toColorInt()
    //                 } else {
    //                     try {
    //                         subtitleOverlayColor.toColorInt()
    //                     } catch (e: Exception) {
    //                         val rgb = subtitleOverlayColor.substring(1, 7)
    //                         val alpha = subtitleOverlayColor.substring(7, 9)
    //                         "#$alpha$rgb".toColorInt()
    //                     }
    //                 }
    //             } else {
    //                 subtitleOverlayColor.toColorInt()
    //             }

    //             Log.d("VideoProcessing", "Subtitle overlay color applied: $subtitleOverlayColor -> $overlayColor")
    //             overlayColor
    //         } catch (e: Exception) {
    //             Log.e("VideoProcessing", "Failed to parse overlay color: $subtitleOverlayColor, using default", e)
    //             "#80000000".toColorInt()
    //         }
    //         val cornerRadius = verticalPadding * 0.5f
    //         val rect = RectF(0f, 0f, width.toFloat(), height.toFloat())
    //         canvas.drawRoundRect(rect, cornerRadius, cornerRadius, backgroundPaint)

    //         canvas.withSave {
    //             val textX = (width - layout.width) / 2f
    //             val textY = verticalPadding.toFloat()
    //             translate(textX, textY)
    //             layout.draw(this)
    //         }

    //         return bitmap
    //     }
    // }

    private fun createCropEffect(aspectRatio: String, videoWidth: Int, videoHeight: Int): Crop {
        val inputAspectRatio = videoWidth.toFloat() / videoHeight.toFloat()
        return when (aspectRatio) {
            "1:1" -> {
                val targetAspectRatio = 1f
                if (inputAspectRatio > targetAspectRatio) {
                    val cropWidth = (videoWidth - videoHeight) / 2f
                    val cropRatio = cropWidth / videoWidth
                    Crop(-1f + cropRatio * 2, 1f - cropRatio * 2, -1f, 1f)
                } else {
                    val cropHeight = (videoHeight - videoWidth) / 2f
                    val cropRatio = cropHeight / videoHeight
                    Crop(-1f, 1f, -1f + cropRatio * 2, 1f - cropRatio * 2)
                }
            }
            "9:16" -> {
                val targetAspectRatio = 9f / 16f
                if (inputAspectRatio > targetAspectRatio) {
                    val targetWidth = videoHeight * targetAspectRatio
                    val cropWidth = (videoWidth - targetWidth) / 2f
                    val cropRatio = cropWidth / videoWidth
                    Crop(-1f + cropRatio * 2, 1f - cropRatio * 2, -1f, 1f)
                } else {
                    val targetHeight = videoWidth / targetAspectRatio
                    val cropHeight = (videoHeight - targetHeight) / 2f
                    val cropRatio = cropHeight / videoHeight
                    Crop(-1f, 1f, -1f + cropRatio * 2, 1f - cropRatio * 2)
                }
            }
            "16:9" -> {
                val targetAspectRatio = 16f / 9f
                if (inputAspectRatio > targetAspectRatio) {
                    val targetWidth = videoHeight * targetAspectRatio
                    val cropWidth = (videoWidth - targetWidth) / 2f
                    val cropRatio = cropWidth / videoWidth
                    Crop(-1f + cropRatio * 2, 1f - cropRatio * 2, -1f, 1f)
                } else {
                    val targetHeight = videoWidth / targetAspectRatio
                    val cropHeight = (videoHeight - targetHeight) / 2f
                    val cropRatio = cropHeight / videoHeight
                    Crop(-1f, 1f, -1f + cropRatio * 2, 1f - cropRatio * 2)
                }
            }
            else -> Crop(-1f, 1f, -1f, 1f)
        }
    }
}
