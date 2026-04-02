export type WeapiRenamedPlatform = 'my' | 'tt'

/**
 * @description 严格等价异名映射白名单（按平台区分，使用 `wxMethod->targetMethod` 形式）。
 */
export const STRICT_RENAMED_ALLOWLIST: Readonly<Record<WeapiRenamedPlatform, readonly string[]>> = {
  my: [
    'checkIsSoterEnrolledInDevice->checkIsIfaaEnrolledInDevice',
    'checkIsSupportSoterAuthentication->checkIsSupportIfaaAuthentication',
    'closeBLEConnection->disconnectBLEDevice',
    'createBLEConnection->connectBLEDevice',
    'createRewardedVideoAd->createRewardedAd',
    'getClipboardData->getClipboard',
    'getSystemInfoAsync->getSystemInfo',
    'hideHomeButton->hideBackHome',
    'offBLEConnectionStateChange->offBLEConnectionStateChanged',
    'onBLEConnectionStateChange->onBLEConnectionStateChanged',
    'setClipboardData->setClipboard',
    'showModal->confirm',
  ].sort(),
  tt: [
    'getSystemInfoAsync->getSystemInfo',
  ].sort(),
}

interface WeapiRenamedCompatibilityLike {
  method: string
  alipayTarget: string
  douyinTarget: string
}

/**
 * @description 从兼容矩阵提取指定平台的异名映射（仅 `target !== method`）。
 */
export function collectRenamedMappings(
  matrix: readonly WeapiRenamedCompatibilityLike[],
  platform: WeapiRenamedPlatform,
) {
  return matrix
    .filter(item => platform === 'my' ? item.alipayTarget !== item.method : item.douyinTarget !== item.method)
    .map(item => platform === 'my'
      ? `${item.method}->${item.alipayTarget}`
      : `${item.method}->${item.douyinTarget}`)
    .sort()
}

/**
 * @description 对比异名映射集合，输出缺失项与意外项。
 */
export function diffRenamedMappings(actual: readonly string[], expected: readonly string[]) {
  const actualSet = new Set(actual)
  const expectedSet = new Set(expected)
  const missing = expected.filter(item => !actualSet.has(item))
  const unexpected = actual.filter(item => !expectedSet.has(item))
  return {
    missing,
    unexpected,
  }
}
