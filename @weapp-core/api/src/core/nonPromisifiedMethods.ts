/**
 * @description `wpi` 中需要保留原始同步返回值的方法名单。
 *
 * 这些方法虽然不一定带有 `Sync` 后缀，但本质上属于以下几类：
 * - 宿主能力探测与同步工具方法
 * - 各类上下文 / manager / socket / observer 工厂
 * - 同步返回句柄的调度与分析方法
 */
export const WEAPI_NON_PROMISIFIED_METHOD_NAMES = [
  'arrayBufferToBase64',
  'base64ToArrayBuffer',
  'canIUse',
  'cancelIdleCallback',
  'createAnimation',
  'createAudioContext',
  'createCameraContext',
  'createCanvasContext',
  'createEditorContext',
  'createInnerAudioContext',
  'createIntersectionObserver',
  'createInterstitialAd',
  'createLivePlayerContext',
  'createLivePusherContext',
  'createMapContext',
  'createMediaAudioPlayer',
  'createMediaContainer',
  'createMediaRecorder',
  'createOffscreenCanvas',
  'createRewardedVideoAd',
  'createSelectorQuery',
  'createTCPSocket',
  'createUDPSocket',
  'createVKSession',
  'createVideoContext',
  'createWebAudioContext',
  'createWorker',
  'getBackgroundAudioManager',
  'getFileSystemManager',
  'getLogManager',
  'getMenuButtonBoundingClientRect',
  'getNFCAdapter',
  'getOpenDataContext',
  'getPerformance',
  'getRealtimeLogManager',
  'getRecorderManager',
  'getUpdateManager',
  'getUserCryptoManager',
  'getXrFrameSystem',
  'nextTick',
  'reportAnalytics',
  'requestIdleCallback',
] as const

export type WeapiNonPromisifiedMethodName = typeof WEAPI_NON_PROMISIFIED_METHOD_NAMES[number]

const WEAPI_NON_PROMISIFIED_METHOD_NAME_SET = new Set<string>(WEAPI_NON_PROMISIFIED_METHOD_NAMES)

/**
 * @description 判断方法是否应保留原始同步返回值，而不是包装为 Promise。
 */
export function isNonPromisifiedMethod(name: string): name is WeapiNonPromisifiedMethodName {
  return WEAPI_NON_PROMISIFIED_METHOD_NAME_SET.has(name)
}
