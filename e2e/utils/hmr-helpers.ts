import type { RuntimePlatform } from '../wevu-runtime.utils'
import fs from 'fs-extra'
import { resolvePlatformMatrix } from './platform-matrix'

export type { RuntimePlatform }

/**
 * 支持的小程序平台列表
 */
export const SUPPORTED_PLATFORMS = [
  'weapp',
  // 'alipay',
  // 'tt',
] as const

/**
 * 平台相关的文件扩展名映射（含模板和样式）
 */
export const PLATFORM_EXT: Record<RuntimePlatform, { template: string, style: string }> = {
  weapp: { template: 'wxml', style: 'wxss' },
  alipay: { template: 'axml', style: 'acss' },
  tt: { template: 'ttml', style: 'ttss' },
}

/**
 * 解析要测试的平台列表：
 * 1) 指定 E2E_PLATFORM 时仅测试单平台；
 * 2) CI 或 E2E_FULL_MATRIX=1 时测试全部平台；
 * 3) 本地默认仅测试 weapp。
 *
 * @returns 平台数组
 */
export function resolvePlatforms(): RuntimePlatform[] {
  return resolvePlatformMatrix(SUPPORTED_PLATFORMS, {
    localDefault: 'weapp',
  })
}

/**
 * 轮询等待文件包含指定标记内容
 *
 * @param filePath - 目标文件路径
 * @param marker - 期望包含的标记字符串
 * @param timeoutMs - 超时时间（毫秒），默认 90 秒
 * @returns 文件内容
 */
export async function waitForFileContains(filePath: string, marker: string, timeoutMs = 90_000): Promise<string> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (await fs.pathExists(filePath)) {
      const content = await fs.readFile(filePath, 'utf8')
      if (content.includes(marker)) {
        return content
      }
    }
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  throw new Error(`Timed out waiting for ${filePath} to contain marker: ${marker}`)
}

/**
 * 轮询等待文件从文件系统中被移除
 *
 * @param filePath - 目标文件路径
 * @param timeoutMs - 超时时间（毫秒），默认 90 秒
 */
export async function waitForFileRemoved(filePath: string, timeoutMs = 90_000): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (!(await fs.pathExists(filePath))) {
      return
    }
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  throw new Error(`Timed out waiting for ${filePath} to be removed`)
}

/**
 * 生成唯一的 HMR 标记字符串
 *
 * @param prefix - 标记前缀（如 MODIFY-TEMPLATE）
 * @param platform - 目标平台名称
 * @returns 格式为 `HMR-{prefix}-{PLATFORM}` 的标记
 */
export function createHmrMarker(prefix: string, platform: string): string {
  return `HMR-${prefix}-${platform.toUpperCase()}`
}
