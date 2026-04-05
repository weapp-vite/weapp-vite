import { Buffer } from 'node:buffer'
import { PNG } from 'pngjs'

interface MiniProgramLike {
  pageScrollTo: (scrollTop: number) => Promise<void>
  screenshot: () => Promise<string | Buffer>
  currentPage: () => Promise<PageLike>
  systemInfo: () => Promise<Record<string, unknown>>
}

interface PageLike {
  size: () => Promise<{ width: number, height: number }>
  waitFor: (condition: number) => Promise<void>
}

interface FullPageCaptureOptions {
  miniProgram: MiniProgramLike
  timeoutMs: number
  runWithTimeout: <T>(task: Promise<T>, timeoutMs: number, message: string, code: string) => Promise<T>
  screenshotTimeoutMessage: string
}

function decodeScreenshotBuffer(raw: string | Buffer) {
  const buffer = typeof raw === 'string'
    ? Buffer.from(raw, 'base64')
    : Buffer.from(raw)

  if (buffer.length === 0) {
    throw new Error('Failed to capture screenshot')
  }

  return buffer
}

function toPositiveNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : undefined
}

function createScrollPositions(totalHeight: number, viewportHeight: number) {
  if (totalHeight <= viewportHeight) {
    return [0]
  }

  const positions: number[] = []
  const lastStart = Math.max(totalHeight - viewportHeight, 0)

  for (let scrollTop = 0; scrollTop < lastStart; scrollTop += viewportHeight) {
    positions.push(scrollTop)
  }

  if (positions.at(-1) !== lastStart) {
    positions.push(lastStart)
  }

  return positions
}

function cropPngRows(source: PNG, startRow: number, rowCount: number) {
  const cropped = new PNG({ width: source.width, height: rowCount })
  const bytesPerRow = source.width * 4

  for (let row = 0; row < rowCount; row += 1) {
    const sourceStart = (startRow + row) * bytesPerRow
    const sourceEnd = sourceStart + bytesPerRow
    source.data.copy(cropped.data, row * bytesPerRow, sourceStart, sourceEnd)
  }

  return cropped
}

/**
 * @description 通过多次滚动和拼接生成整页长截图。
 */
export async function captureFullPageScreenshotBuffer(options: FullPageCaptureOptions) {
  const { miniProgram, timeoutMs, runWithTimeout, screenshotTimeoutMessage } = options
  const page = await miniProgram.currentPage()
  const pageSize = await page.size()
  const systemInfo = await miniProgram.systemInfo()
  const pageHeight = toPositiveNumber(pageSize.height)
  const viewportHeight = toPositiveNumber(systemInfo.windowHeight)

  if (!pageHeight || !viewportHeight) {
    const screenshot = await runWithTimeout(
      miniProgram.screenshot(),
      timeoutMs,
      screenshotTimeoutMessage,
      'DEVTOOLS_SCREENSHOT_TIMEOUT',
    )
    return decodeScreenshotBuffer(screenshot)
  }

  const segments: PNG[] = []
  const positions = createScrollPositions(pageHeight, viewportHeight)
  let coveredUntil = 0
  let scale = 1

  for (const scrollTop of positions) {
    await miniProgram.pageScrollTo(scrollTop)
    await page.waitFor(150)

    const rawScreenshot = await runWithTimeout(
      miniProgram.screenshot(),
      timeoutMs,
      screenshotTimeoutMessage,
      'DEVTOOLS_SCREENSHOT_TIMEOUT',
    )
    const png = PNG.sync.read(decodeScreenshotBuffer(rawScreenshot))

    if (viewportHeight > 0) {
      scale = png.height / viewportHeight
    }

    const visibleEnd = Math.min(scrollTop + viewportHeight, pageHeight)
    const cropTopCss = Math.max(coveredUntil - scrollTop, 0)
    const segmentHeightCss = Math.max(visibleEnd - scrollTop - cropTopCss, 0)

    if (segmentHeightCss <= 0) {
      continue
    }

    const cropTopRows = Math.min(Math.max(Math.round(cropTopCss * scale), 0), png.height)
    const segmentRows = Math.min(
      Math.max(Math.round(segmentHeightCss * scale), 1),
      png.height - cropTopRows,
    )

    segments.push(cropPngRows(png, cropTopRows, segmentRows))
    coveredUntil = visibleEnd
  }

  if (segments.length === 0) {
    throw new Error('Failed to capture screenshot')
  }

  const width = segments[0].width
  const height = segments.reduce((sum, segment) => sum + segment.height, 0)
  const merged = new PNG({ width, height })
  const bytesPerRow = width * 4
  let offsetY = 0

  for (const segment of segments) {
    if (segment.width !== width) {
      throw new Error('Full-page screenshots have inconsistent widths')
    }

    for (let row = 0; row < segment.height; row += 1) {
      const sourceStart = row * bytesPerRow
      const sourceEnd = sourceStart + bytesPerRow
      segment.data.copy(merged.data, (offsetY + row) * bytesPerRow, sourceStart, sourceEnd)
    }
    offsetY += segment.height
  }

  return PNG.sync.write(merged)
}
