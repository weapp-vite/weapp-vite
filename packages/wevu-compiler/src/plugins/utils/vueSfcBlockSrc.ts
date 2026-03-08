import type { SFCDescriptor } from 'vue/compiler-sfc'
import path from 'pathe'
import { isSkippableResolvedId, normalizeFsResolvedId } from '../../utils/resolvedId'
import { readFile as readFileCached } from './cache'

/**
 * 解析 SFC block `src` 的配置。
 */
export interface ResolveSfcBlockSrcOptions {
  resolveId?: (source: string, importer?: string) => Promise<string | undefined>
  readFile?: (id: string, options?: { checkMtime?: boolean }) => Promise<string>
  checkMtime?: boolean
}

type SfcBlockKind = 'template' | 'script' | 'script setup' | 'style'

const SCRIPT_LANG_EXT = new Map([
  ['.ts', 'ts'],
  ['.tsx', 'tsx'],
  ['.js', 'js'],
  ['.jsx', 'jsx'],
  ['.mjs', 'js'],
  ['.cjs', 'js'],
])
const STYLE_LANG_EXT = new Map([
  ['.css', 'css'],
  ['.scss', 'scss'],
  ['.sass', 'sass'],
  ['.less', 'less'],
  ['.styl', 'styl'],
  ['.stylus', 'styl'],
])
const TEMPLATE_LANG_EXT = new Map([
  ['.html', 'html'],
  ['.htm', 'html'],
  ['.pug', 'pug'],
  ['.jade', 'pug'],
])

function inferLangFromSrc(src: string, kind: SfcBlockKind) {
  const ext = path.extname(src).toLowerCase()
  if (!ext) {
    return undefined
  }
  if (kind === 'style') {
    return STYLE_LANG_EXT.get(ext)
  }
  if (kind === 'template') {
    return TEMPLATE_LANG_EXT.get(ext)
  }
  return SCRIPT_LANG_EXT.get(ext)
}

function getBlockLabel(kind: SfcBlockKind) {
  if (kind === 'script setup') {
    return 'script setup'
  }
  return kind
}

async function resolveBlockSrcPath(
  src: string,
  filename: string,
  options?: ResolveSfcBlockSrcOptions,
) {
  const normalizedSrc = normalizeFsResolvedId(src)
  if (normalizedSrc && isSkippableResolvedId(normalizedSrc)) {
    throw new Error(`解析 ${filename} 失败：不支持 <src> 引用虚拟模块 ${src}`)
  }

  let resolvedId: string | undefined
  if (options?.resolveId) {
    const resolved = await options.resolveId(src, filename)
    if (resolved) {
      const normalized = normalizeFsResolvedId(resolved)
      if (normalized && isSkippableResolvedId(normalized)) {
        throw new Error(`解析 ${filename} 失败：不支持 <src> 引用虚拟模块 ${src}`)
      }
      resolvedId = normalized || resolved
    }
  }

  if (resolvedId) {
    if (!path.isAbsolute(resolvedId)) {
      resolvedId = path.resolve(path.dirname(filename), resolvedId)
    }
    return resolvedId
  }

  if (normalizedSrc && path.isAbsolute(normalizedSrc)) {
    return normalizedSrc
  }

  return path.resolve(path.dirname(filename), normalizedSrc || src)
}

async function readBlockContent(
  resolvedId: string,
  filename: string,
  options?: ResolveSfcBlockSrcOptions,
) {
  const reader = options?.readFile ?? readFileCached
  const checkMtime = options?.checkMtime
  try {
    return await reader(resolvedId, { checkMtime })
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`解析 ${filename} 失败：读取 ${resolvedId} 失败：${message}`)
  }
}

/**
 * 解析 SFC 中带 `src` 的 block，并返回依赖列表。
 */
export async function resolveSfcBlockSrc(
  descriptor: SFCDescriptor,
  filename: string,
  options?: ResolveSfcBlockSrcOptions,
): Promise<{ descriptor: SFCDescriptor, deps: string[] }> {
  if (!options) {
    return { descriptor, deps: [] }
  }

  const deps = new Set<string>()
  const nextDescriptor: SFCDescriptor = {
    ...descriptor,
    styles: descriptor.styles.slice(),
  }

  const resolveBlock = async <T extends { content: string, src?: string | null, lang?: string }>(
    block: T | null,
    kind: SfcBlockKind,
  ): Promise<T | null> => {
    if (!block || !block.src) {
      return block
    }

    if (block.content.trim().length > 0) {
      throw new Error(`解析 ${filename} 失败：<${getBlockLabel(kind)}> 同时存在 src 与内联内容`)
    }

    const resolvedId = await resolveBlockSrcPath(block.src, filename, options)
    const content = await readBlockContent(resolvedId, filename, options)
    deps.add(resolvedId)
    const inferredLang = block.lang ?? inferLangFromSrc(resolvedId, kind)

    return {
      ...block,
      content,
      lang: inferredLang ?? block.lang,
    }
  }

  nextDescriptor.template = await resolveBlock(descriptor.template, 'template')
  nextDescriptor.script = await resolveBlock(descriptor.script, 'script')
  nextDescriptor.scriptSetup = await resolveBlock(descriptor.scriptSetup, 'script setup')
  if (nextDescriptor.styles.length) {
    nextDescriptor.styles = await Promise.all(
      nextDescriptor.styles.map(style => resolveBlock(style, 'style') as Promise<typeof style>),
    )
  }

  return { descriptor: nextDescriptor, deps: Array.from(deps) }
}
