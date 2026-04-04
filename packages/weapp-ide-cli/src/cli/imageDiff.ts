import type { Buffer } from 'node:buffer'
import fs from 'node:fs/promises'
import pixelmatch from 'pixelmatch'
import { PNG } from 'pngjs'
import { i18nText } from '../i18n'

export interface ComparePngWithBaselineOptions {
  baselinePath: string
  currentPngBuffer: Buffer
  currentOutputPath?: string
  diffOutputPath?: string
  threshold: number
}

export interface ComparePngWithBaselineResult {
  baselinePath: string
  currentPath?: string
  diffPath?: string
  width: number
  height: number
  diffPixels: number
  diffRatio: number
}

function readPng(buffer: Buffer, label: string) {
  try {
    return PNG.sync.read(buffer)
  }
  catch (error) {
    throw new Error(i18nText(
      `${label} 不是有效的 PNG 文件`,
      `${label} is not a valid PNG file`,
    ), { cause: error })
  }
}

/**
 * @description 将当前截图与基准图做像素对比，并按需输出当前图与 diff 图。
 */
export async function comparePngWithBaseline(
  options: ComparePngWithBaselineOptions,
): Promise<ComparePngWithBaselineResult> {
  let baselineBuffer: Buffer
  try {
    baselineBuffer = await fs.readFile(options.baselinePath)
  }
  catch (error) {
    throw new Error(i18nText(
      `无法读取基准图: ${options.baselinePath}`,
      `Failed to read baseline image: ${options.baselinePath}`,
    ), { cause: error })
  }

  const baselinePng = readPng(baselineBuffer, i18nText('基准图', 'Baseline image'))
  const currentPng = readPng(options.currentPngBuffer, i18nText('当前截图', 'Current screenshot'))

  if (baselinePng.width !== currentPng.width || baselinePng.height !== currentPng.height) {
    throw new Error(i18nText(
      '基准图与当前截图尺寸不一致',
      'Baseline image size does not match current screenshot',
    ))
  }

  if (options.currentOutputPath) {
    await fs.writeFile(options.currentOutputPath, options.currentPngBuffer)
  }

  const diffPng = new PNG({ width: currentPng.width, height: currentPng.height })
  const diffPixels = pixelmatch(
    baselinePng.data,
    currentPng.data,
    diffPng.data,
    currentPng.width,
    currentPng.height,
    { threshold: options.threshold },
  )

  if (options.diffOutputPath) {
    await fs.writeFile(options.diffOutputPath, PNG.sync.write(diffPng))
  }

  return {
    baselinePath: options.baselinePath,
    currentPath: options.currentOutputPath,
    diffPath: options.diffOutputPath,
    width: currentPng.width,
    height: currentPng.height,
    diffPixels,
    diffRatio: diffPixels / (currentPng.width * currentPng.height),
  }
}
