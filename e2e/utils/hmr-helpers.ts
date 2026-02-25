import fs from 'fs-extra'
import type { RuntimePlatform } from '../wevu-runtime.utils'

export type { RuntimePlatform }

/**
 * 支持的小程序平台列表
 */
export const SUPPORTED_PLATFORMS = ['weapp', 'alipay', 'tt'] as const

/**
 * 平台相关的文件扩展名映射（含模板和样式）
 */
export const PLATFORM_EXT: Record<RuntimePlatform, { template: string, style: string }> = {
  weapp: { template: 'wxml', style: 'wxss' },
  alipay: { template: 'axml', style: 'acss' },
  tt: { template: 'ttml', style: 'ttss' },
}

/**
 * 根据环境变量 E2E_PLATFORM 解析要测试的平台列表
 *
 * @returns 平台数组，未设置环境变量时返回全部平台
 */
export function resolvePlatforms(): RuntimePlatform[] {
  const selected = process.env.E2E_PLATFORM
  if (!selected) {
    return [...SUPPORTED_PLATFORMS]
  }
  if (!SUPPORTED_PLATFORMS.includes(selected as RuntimePlatform)) {
    throw new Error(`Unsupported E2E_PLATFORM: ${selected}. Supported: ${SUPPORTED_PLATFORMS.join(', ')}`)
  }
  return [selected as RuntimePlatform]
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
