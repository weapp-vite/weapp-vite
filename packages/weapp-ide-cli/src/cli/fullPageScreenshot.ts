import type { MiniProgramLike, MiniProgramPage } from './automator-session'
import { Buffer } from 'node:buffer'
import { PNG } from 'pngjs'

interface FullPageCaptureOptions {
  miniProgram: MiniProgramLike
  timeoutMs: number
  runWithTimeout: <T>(task: Promise<T>, timeoutMs: number, message: string, code: string) => Promise<T>
  screenshotTimeoutMessage: string
}

interface CapturedPng {
  pageHeight: number | undefined
  png: PNG
  scrollTop: number
}

const MAX_FULL_PAGE_CAPTURES = 200

function decodeScreenshotBuffer(raw: string | Buffer | undefined) {
  if (raw === undefined) {
    throw new Error('Failed to capture screenshot')
  }

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

function resolveScale(pageWidth: number | undefined, viewportHeight: number, png: PNG) {
  if (pageWidth && pageWidth > 0) {
    return png.width / pageWidth
  }
  return png.height / viewportHeight
}

function cropPngRows(source: PNG, startRow: number, rowCount: number) {
  const cropped = new PNG({ width: source.width, height: rowCount })
  const bytesPerRow = source.width * 4

  for (let row = 0; row < rowCount; row += 1) {
    const sourceStart = (startRow + row) * bytesPerRow
    const sourceEnd = sourceStart + bytesPerRow
    cropped.data.set(source.data.subarray(sourceStart, sourceEnd), row * bytesPerRow)
  }

  return cropped
}

function areRowsVisuallyEqual(first: PNG, second: PNG, firstRow: number, secondRow: number) {
  const tolerance = 6
  const requiredEqualRatio = 0.98
  let equalPixels = 0

  for (let column = 0; column < first.width; column += 1) {
    const firstIndex = (firstRow * first.width + column) * 4
    const secondIndex = (secondRow * second.width + column) * 4
    if (
      Math.abs(first.data[firstIndex] - second.data[secondIndex]) <= tolerance
      && Math.abs(first.data[firstIndex + 1] - second.data[secondIndex + 1]) <= tolerance
      && Math.abs(first.data[firstIndex + 2] - second.data[secondIndex + 2]) <= tolerance
      && Math.abs(first.data[firstIndex + 3] - second.data[secondIndex + 3]) <= tolerance
    ) {
      equalPixels += 1
    }
  }

  return equalPixels / first.width >= requiredEqualRatio
}

function detectFixedBottomRows(first: PNG, second: PNG, scale: number) {
  if (first.width !== second.width || first.height !== second.height) {
    return 0
  }

  const maxFixedRows = Math.floor(first.height * 0.45)
  const minFixedRows = Math.max(8, Math.round(8 * scale))
  let fixedRows = 0

  for (let offset = 0; offset < maxFixedRows; offset += 1) {
    const firstRow = first.height - 1 - offset
    const secondRow = second.height - 1 - offset
    if (!areRowsVisuallyEqual(first, second, firstRow, secondRow)) {
      break
    }
    fixedRows += 1
  }

  return fixedRows >= minFixedRows ? fixedRows : 0
}

async function restoreScrollPosition(miniProgram: MiniProgramLike, page: MiniProgramPage, scrollTop: number) {
  await miniProgram.pageScrollTo(scrollTop)
  await page.waitFor(150)
}

async function captureScrolledPng(
  miniProgram: MiniProgramLike,
  page: MiniProgramPage,
  scrollTop: number,
  timeoutMs: number,
  runWithTimeout: FullPageCaptureOptions['runWithTimeout'],
  screenshotTimeoutMessage: string,
): Promise<CapturedPng> {
  await miniProgram.pageScrollTo(scrollTop)
  await page.waitFor(150)

  const rawScreenshot = await runWithTimeout(
    miniProgram.screenshot({ timeout: timeoutMs }),
    timeoutMs,
    screenshotTimeoutMessage,
    'DEVTOOLS_SCREENSHOT_TIMEOUT',
  )
  const actualScrollTop = typeof page.scrollTop === 'function'
    ? toPositiveNumber(await page.scrollTop()) ?? 0
    : scrollTop
  const pageSize = await page.size().catch(() => null)
  return {
    pageHeight: toPositiveNumber(pageSize?.height),
    png: PNG.sync.read(decodeScreenshotBuffer(rawScreenshot)),
    scrollTop: actualScrollTop,
  }
}

/**
 * @description 通过多次滚动和拼接生成整页长截图。
 */
export async function captureFullPageScreenshotBuffer(options: FullPageCaptureOptions) {
  const { miniProgram, timeoutMs, runWithTimeout, screenshotTimeoutMessage } = options
  const page = await miniProgram.currentPage()
  const pageSize = await page.size()
  const systemInfo = await miniProgram.systemInfo()
  const initialScrollTop = typeof page.scrollTop === 'function'
    ? await page.scrollTop()
    : 0
  const pageWidth = toPositiveNumber(pageSize.width)
  const pageHeight = toPositiveNumber(pageSize.height)
  const viewportHeight = toPositiveNumber(systemInfo.windowHeight)

  if (!pageHeight || !viewportHeight) {
    const screenshot = await runWithTimeout(
      miniProgram.screenshot({ timeout: timeoutMs }),
      timeoutMs,
      screenshotTimeoutMessage,
      'DEVTOOLS_SCREENSHOT_TIMEOUT',
    )
    return decodeScreenshotBuffer(screenshot)
  }

  const segments: PNG[] = []
  const capturesByRequestedScrollTop = new Map<number, CapturedPng>()
  let coveredUntil = 0
  let scale = 1
  let fixedBottomRows = 0
  let contentViewportHeight = viewportHeight
  let latestPageHeight = pageHeight

  try {
    const firstCapture = await captureScrolledPng(
      miniProgram,
      page,
      0,
      timeoutMs,
      runWithTimeout,
      screenshotTimeoutMessage,
    )
    const firstPng = firstCapture.png
    capturesByRequestedScrollTop.set(0, firstCapture)
    scale = resolveScale(pageWidth, viewportHeight, firstPng)
    latestPageHeight = firstCapture.pageHeight ?? latestPageHeight

    if (pageHeight > viewportHeight) {
      const probeScrollTop = Math.min(viewportHeight, Math.max(pageHeight - viewportHeight, 1))
      const probeCapture = await captureScrolledPng(
        miniProgram,
        page,
        probeScrollTop,
        timeoutMs,
        runWithTimeout,
        screenshotTimeoutMessage,
      )
      const probePng = probeCapture.png
      capturesByRequestedScrollTop.set(probeScrollTop, probeCapture)
      latestPageHeight = probeCapture.pageHeight ?? latestPageHeight

      fixedBottomRows = detectFixedBottomRows(firstPng, probePng, scale)
      if (fixedBottomRows > 0) {
        const screenshotCssHeight = firstPng.height / scale
        const fixedBottomCss = fixedBottomRows / scale
        const fixedRowsOutsideViewportCss = Math.max(screenshotCssHeight - viewportHeight, 0)
        const fixedRowsInsideViewportCss = Math.max(fixedBottomCss - fixedRowsOutsideViewportCss, 0)
        contentViewportHeight = Math.max(1, viewportHeight - fixedRowsInsideViewportCss)
      }
    }

    let requestedScrollTop = 0

    for (let captureIndex = 0; captureIndex < MAX_FULL_PAGE_CAPTURES; captureIndex += 1) {
      const capture = capturesByRequestedScrollTop.get(requestedScrollTop) ?? await captureScrolledPng(
        miniProgram,
        page,
        requestedScrollTop,
        timeoutMs,
        runWithTimeout,
        screenshotTimeoutMessage,
      )
      capturesByRequestedScrollTop.set(requestedScrollTop, capture)
      const { png, scrollTop } = capture
      latestPageHeight = capture.pageHeight ?? latestPageHeight

      const visibleEnd = Math.min(scrollTop + contentViewportHeight, latestPageHeight)
      const cropTopCss = Math.max(coveredUntil - scrollTop, 0)
      const segmentHeightCss = Math.max(visibleEnd - scrollTop - cropTopCss, 0)
      const isAtBottom = visibleEnd >= latestPageHeight - 1

      if (segmentHeightCss > 0) {
        const contentRows = Math.max(png.height - fixedBottomRows, 1)
        const cropTopRows = Math.min(Math.max(Math.round(cropTopCss * scale), 0), contentRows)
        const segmentRows = Math.min(
          Math.max(Math.round(segmentHeightCss * scale), 1),
          contentRows - cropTopRows,
        )

        if (segmentRows > 0) {
          segments.push(cropPngRows(png, cropTopRows, segmentRows))
        }
      }

      coveredUntil = Math.max(coveredUntil, visibleEnd)

      if (isAtBottom) {
        if (fixedBottomRows > 0) {
          segments.push(cropPngRows(png, png.height - fixedBottomRows, fixedBottomRows))
        }
        break
      }

      if (visibleEnd <= scrollTop || coveredUntil <= requestedScrollTop) {
        if (fixedBottomRows > 0) {
          segments.push(cropPngRows(png, png.height - fixedBottomRows, fixedBottomRows))
        }
        break
      }

      requestedScrollTop = coveredUntil
    }
  }
  finally {
    await restoreScrollPosition(miniProgram, page, initialScrollTop)
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
      merged.data.set(segment.data.subarray(sourceStart, sourceEnd), (offsetY + row) * bytesPerRow)
    }
    offsetY += segment.height
  }

  return PNG.sync.write(merged)
}
