#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(VideoEditorSdk, NSObject)

RCT_EXTERN_METHOD(
  applyEdits:(NSDictionary *)config
  resolve:(RCTPromiseResolveBlock)resolve
  reject:(RCTPromiseRejectBlock)reject
)

RCT_EXTERN_METHOD(
  cleanupTempFiles
)

@end
