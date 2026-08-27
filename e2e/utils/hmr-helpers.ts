import type { RuntimePlatform } from '../wevu-runtime.utils'
import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { WEAPP_VITE_STATEFUL_HMR_CONTROL_KEY } from '../../@weapp-core/constants/src'
import { resolvePlatformMatrix } from './platform-matrix'

export type { RuntimePlatform }

/**
 * 支持的小程序平台列表
 */
export const SUPPORTED_PLATFORMS = [
  'weapp',
  'alipay',
  'tt',
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
 * 在隔离测试项目中关闭微信开发者工具热重载，使磁盘产物回归固定使用 classic watcher。
 *
 * @param projectRoot - 隔离测试项目根目录
 * @returns 恢复原始私有配置的函数
 */
export async function disableProjectCompileHotReload(projectRoot: string): Promise<() => Promise<void>> {
  const configPath = path.join(projectRoot, 'project.private.config.json')
  const original = await fs.readFile(configPath, 'utf8')
  const loaded = JSON.parse(original) as { setting?: Record<string, unknown>, [key: string]: unknown }
  await fs.writeJSON(configPath, {
    ...loaded,
    setting: {
      ...loaded.setting,
      compileHotReLoad: false,
    },
  }, { spaces: 2 })
  return async () => {
    await fs.writeFile(configPath, original, 'utf8')
  }
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

interface StatefulHmrControlPayload {
  url: string
}

const STATEFUL_HMR_CONTROL_ASSIGNMENT = `globalThis[${JSON.stringify(WEAPP_VITE_STATEFUL_HMR_CONTROL_KEY)}] = `
const STATEFUL_HMR_CONTROL_ENDPOINT = '/__weapp_vite_stateful_hmr__'
const LOOPBACK_HOSTNAMES = new Set(['127.0.0.1', '[::1]', '::1', 'localhost'])

/**
 * 从生成的控制脚本中解析状态保持 HMR 连接信息。
 *
 * @param source - 控制脚本源码
 * @returns 合法的 loopback HMR 控制信息；格式或地址不符合契约时返回 undefined
 */
export function parseStatefulHmrControlSource(source: string): StatefulHmrControlPayload | undefined {
  const assignmentStart = source.indexOf(STATEFUL_HMR_CONTROL_ASSIGNMENT)
  if (assignmentStart === -1) {
    return undefined
  }

  const jsonStart = assignmentStart + STATEFUL_HMR_CONTROL_ASSIGNMENT.length
  const jsonEnd = source.indexOf(';', jsonStart)
  if (jsonEnd === -1) {
    return undefined
  }

  try {
    const parsed: unknown = JSON.parse(source.slice(jsonStart, jsonEnd))
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return undefined
    }
    const url = (parsed as Record<string, unknown>).url
    if (typeof url !== 'string') {
      return undefined
    }
    const resolvedUrl = new URL(url)
    if (
      resolvedUrl.protocol !== 'http:'
      || !resolvedUrl.port
      || !LOOPBACK_HOSTNAMES.has(resolvedUrl.hostname)
      || resolvedUrl.pathname !== STATEFUL_HMR_CONTROL_ENDPOINT
    ) {
      return undefined
    }
    return { url }
  }
  catch {
    return undefined
  }
}

/**
 * 等待状态保持 HMR 控制文件写入合法的 loopback 连接信息。
 *
 * @param filePath - 控制文件路径
 * @param timeoutMs - 超时时间（毫秒），默认 90 秒
 * @returns 解析后的 HMR 控制信息
 */
export async function waitForStatefulHmrControl(
  filePath: string,
  timeoutMs = 90_000,
): Promise<StatefulHmrControlPayload> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (await fs.pathExists(filePath)) {
      const control = parseStatefulHmrControlSource(await fs.readFile(filePath, 'utf8'))
      if (control) {
        return control
      }
    }
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  throw new Error(`Timed out waiting for ${filePath} to contain a valid stateful HMR control payload`)
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

const HMR_SFC_TITLE_RE = /(<view\s+class="title">\s*)(HMR-SFC)(\s*<\/view>)/
const HMR_SCRIPT_NAME_RE = /(const\s+hmrScriptName\s*=\s*)['"][^'"]+['"]/
const SETUP_STORE_INITIAL_NAME_RE = /(export\s+const\s+setupStoreInitialName\s*=\s*)['"][^'"]+['"]/

/**
 * 替换 Vue SFC 标题节点中的 HMR 文案，兼容多行模板格式。
 *
 * @param source - 原始 SFC 源码
 * @param marker - 新的标记内容
 * @returns 替换后的源码；若未命中标题节点则返回原文
 */
export function replaceSfcTitleMarker(source: string, marker: string) {
  return source.replace(HMR_SFC_TITLE_RE, `$1${marker}$3`)
}

/**
 * 替换 HMR SFC 页面标题内容，避免测试依赖模板中的具体换行或缩进格式。
 *
 * @param source - 原始 SFC 源码
 * @param nextTitle - 替换后的标题内容
 * @returns 替换后的 SFC 源码
 */
export function replaceHmrSfcTitle(source: string, nextTitle: string) {
  const openTag = '<view class="title">'
  const closeTag = '</view>'
  const start = source.indexOf(openTag)
  if (start === -1) {
    return source
  }

  const contentStart = start + openTag.length
  const end = source.indexOf(closeTag, contentStart)
  if (end === -1) {
    return source
  }

  const leadingWhitespace = source.slice(contentStart).match(/^\s*/)?.[0] ?? ''
  const trailingWhitespace = source.slice(contentStart, end).match(/\s*$/)?.[0] ?? ''

  return `${source.slice(0, contentStart)}${leadingWhitespace}${nextTitle}${trailingWhitespace}${source.slice(end)}`
}

/**
 * 替换 HMR 页面脚本的用例名称常量，避免测试依赖 buildResult 调用点格式。
 *
 * @param source - 原始页面脚本源码
 * @param marker - 新的 HMR 标记
 * @returns 替换后的源码；若未命中常量则返回原文
 */
export function replaceHmrScriptName(source: string, marker: string) {
  return source.replace(HMR_SCRIPT_NAME_RE, `$1'${marker}'`)
}

/**
 * 替换共享 store 的初始名称常量，避免测试依赖 ref 初始化表达式格式。
 *
 * @param source - 原始共享 store 源码
 * @param marker - 新的 HMR 标记
 * @returns 替换后的源码；若未命中常量则返回原文
 */
export function replaceSharedStoreInitialName(source: string, marker: string) {
  return source.replace(SETUP_STORE_INITIAL_NAME_RE, `$1'${marker}'`)
}

/**
 * 通过“先重命名旧文件，再写回同名新文件”的方式模拟 Windows 常见的原子保存流程。
 *
 * @param filePath - 目标文件路径
 * @param content - 写入的新内容
 */
export async function replaceFileByRename(filePath: string, content: string) {
  const dir = path.dirname(filePath)
  const base = path.basename(filePath)
  const backupPath = path.join(dir, `.${base}.hmr-backup-${Date.now()}-${Math.random().toString(36).slice(2)}`)

  if (await fs.pathExists(filePath)) {
    await fs.move(filePath, backupPath, { overwrite: true })
  }

  try {
    await fs.writeFile(filePath, content, 'utf8')
  }
  finally {
    await fs.remove(backupPath)
  }
}
