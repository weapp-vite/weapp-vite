import type { Buffer } from 'node:buffer'
import sharp from 'sharp'

interface WechatViewportMetrics {
  screenHeight?: number
  screenWidth?: number
  windowHeight?: number
  windowWidth?: number
}

interface NormalizeWechatViewportScreenshotOptions {
  screenshot: Buffer
  systemInfo: WechatViewportMetrics
  targetHeight: number
  targetWidth: number
}

const DIMENSION_TOLERANCE = 0.02

function isPositiveNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

function assertSimilarRatio(actual: number, expected: number, label: string) {
  const difference = Math.abs(actual - expected) / expected
  if (difference > DIMENSION_TOLERANCE) {
    throw new Error(`${label}宽高比与运行时 viewport 不一致`)
  }
}

/**
 * 将 DevTools 整机截图裁剪为小程序页面 viewport，并归一化到视觉基线尺寸。
 */
export async function normalizeWechatViewportScreenshot(
  options: NormalizeWechatViewportScreenshotOptions,
) {
  const { screenHeight, screenWidth, windowHeight, windowWidth } = options.systemInfo
  if (
    !isPositiveNumber(screenHeight)
    || !isPositiveNumber(screenWidth)
    || !isPositiveNumber(windowHeight)
    || !isPositiveNumber(windowWidth)
  ) {
    throw new Error('微信运行时未返回完整的 screen/window 尺寸')
  }
  if (windowHeight > screenHeight || windowWidth > screenWidth) {
    throw new Error('微信运行时 window 尺寸超出 screen 尺寸')
  }

  const image = sharp(options.screenshot)
  const metadata = await image.metadata()
  if (!metadata.width || !metadata.height) {
    throw new Error('微信截图未返回有效尺寸')
  }

  assertSimilarRatio(metadata.width / metadata.height, screenWidth / screenHeight, '微信整机截图')
  assertSimilarRatio(options.targetWidth / options.targetHeight, windowWidth / windowHeight, '微信视觉基线')

  const scaleX = metadata.width / screenWidth
  const scaleY = metadata.height / screenHeight
  const left = Math.max(0, Math.round((screenWidth - windowWidth) * scaleX / 2))
  const top = Math.max(0, Math.round((screenHeight - windowHeight) * scaleY))
  const width = Math.min(metadata.width - left, Math.round(windowWidth * scaleX))
  const height = Math.min(metadata.height - top, Math.round(windowHeight * scaleY))

  if (width <= 0 || height <= 0) {
    throw new Error('无法从微信整机截图解析页面 viewport')
  }

  return await image
    .extract({ height, left, top, width })
    .resize(options.targetWidth, options.targetHeight, { fit: 'fill' })
    .png()
    .toBuffer()
}
