const PIXEL_LENGTH = /^-?(?:\d+(?:\.\d+)?|\.\d+)px$/

export function assertResponsiveStyle(actual: string | undefined, rpx: number, windowWidth: number | undefined, label: string) {
  if (!Number.isFinite(windowWidth) || !windowWidth || windowWidth <= 0 || !Number.isFinite(rpx)
    || typeof actual !== 'string' || !PIXEL_LENGTH.test(actual)) {
    throw new Error(`Invalid responsive style evidence: ${label}`)
  }
  // 微信会按宿主像素取整，允许最多一个逻辑像素的换算误差。
  const expectedPixels = rpx * windowWidth / 750
  if (Math.abs(Number.parseFloat(actual) - expectedPixels) > 1) {
    throw new Error(`${label}: expected ${rpx}rpx (${expectedPixels}px), received ${actual}`)
  }
}
