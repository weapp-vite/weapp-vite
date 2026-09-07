import type { DomRpxCalculation } from './types'

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

export function assertResponsiveCalcStyle(actual: string | undefined, calculation: DomRpxCalculation, windowWidth: number | undefined, label: string) {
  const { value, multiply } = calculation
  if (!Number.isFinite(windowWidth) || !windowWidth || windowWidth <= 0
    || !Number.isFinite(value) || value < 8 || !Number.isFinite(multiply) || multiply <= 0
    || typeof actual !== 'string' || !PIXEL_LENGTH.test(actual)) {
    throw new Error(`Invalid responsive calculation evidence: ${label}`)
  }
  // 真实 IDE 先把正 rpx 原子向下取整，再计算倍数；小于一像素的宿主特例不在本契约内。
  const atomicPixels = Math.floor(value * windowWidth / 750)
  const multipliedPixels = atomicPixels * multiply
  if (atomicPixels < 1 || !Number.isFinite(multipliedPixels)) {
    throw new Error(`Unsupported responsive calculation: ${label}`)
  }
  // 只消除 JS 乘法的浮点尾数（例如 31 * 1.2），不增加布局容差。
  const expectedPixels = Number(multipliedPixels.toFixed(12))
  if (Number.parseFloat(actual) !== expectedPixels) {
    throw new Error(`${label}: expected floor(${value}rpx * ${windowWidth} / 750) * ${multiply} = ${atomicPixels}px * ${multiply} = ${expectedPixels}px, received ${actual}`)
  }
}
