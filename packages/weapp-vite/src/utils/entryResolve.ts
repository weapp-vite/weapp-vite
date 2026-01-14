import fs from 'fs-extra'
import path from 'pathe'
import { jsExtensions, vueExtensions } from '../constants'
import { changeFileExtension } from './file'

export type ImportSpecifierKind = 'default' | 'named'

export interface ResolveEntryPathOptions {
  /**
   * import specifier 类型，用于调整优先级。
   * - named：优先解析到 js/ts（常见 barrel 场景）
   * - default：无扩展名时优先解析到 .vue（常见 SFC 省略后缀）
   * @default 'default'
   */
  kind?: ImportSpecifierKind
  /**
   * 文件存在性判断（可注入缓存版本）。
   * @default fs.pathExists
   */
  exists?: (filePath: string) => Promise<boolean>
  /**
   * stat（可注入缓存版本）。
   * @default fs.stat
   */
  stat?: (filePath: string) => Promise<{ isDirectory: () => boolean }>
  /**
   * 目录入口文件名（不含扩展名）。
   * @default 'index'
   */
  indexBaseName?: string
}

function buildCandidates(base: string, extensions: string[]) {
  return extensions.map(ext => changeFileExtension(base, ext))
}

/**
 * 用于处理 resolver 返回“目录路径”或“无扩展名路径”的场景。
 *
 * - 如果 `input` 是目录：尝试 `${dir}/${indexBaseName}.{js/ts..}`（必要时再尝试 .vue）
 * - 如果 `input` 没扩展名：尝试补全 `{.vue, .ts, .js...}`（default 优先 .vue，named 优先 js/ts）
 *
 * 如果 `input` 已带扩展名，则返回 `undefined`（表示无需补全）。
 */
export async function resolveEntryPath(input: string, options?: ResolveEntryPathOptions): Promise<string | undefined> {
  if (!input || typeof input !== 'string') {
    return undefined
  }
  if (path.extname(input)) {
    return undefined
  }

  const kind = options?.kind ?? 'default'
  const exists = options?.exists ?? (async (p: string) => fs.pathExists(p))
  const stat = options?.stat ?? (async (p: string) => fs.stat(p))
  const indexBaseName = options?.indexBaseName ?? 'index'

  let base = input
  let isDir = false
  try {
    isDir = Boolean((await stat(input))?.isDirectory?.())
  }
  catch {
    isDir = false
  }

  // 目录：优先按 js/ts 的 index.* 解析（与 node/vite 行为更接近，也利于桶文件）。
  if (isDir) {
    base = path.join(input, indexBaseName)
  }

  const jsFirst = kind === 'named' || isDir
  const extensions = jsFirst
    ? [...jsExtensions, ...vueExtensions]
    : [...vueExtensions, ...jsExtensions]

  for (const candidate of buildCandidates(base, extensions)) {
    if (await exists(candidate)) {
      return candidate
    }
  }

  return undefined
}
