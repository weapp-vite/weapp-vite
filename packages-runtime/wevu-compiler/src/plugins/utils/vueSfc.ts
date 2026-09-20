import type { AttributeNode, ElementNode, ParserOptions } from '@vue/compiler-core'
import type { SFCDescriptor, SFCParseOptions, SFCParseResult, SFCScriptBlock, TemplateCompiler } from 'vue/compiler-sfc'
import type { ResolveSfcBlockSrcOptions } from './vueSfcBlockSrc'
import { NodeTypes } from '@vue/compiler-core'
import * as compilerDom from '@vue/compiler-dom'
import { LRUCache } from 'lru-cache'
import MagicString from 'magic-string'
import { parse as parseCompilerSfc } from 'vue/compiler-sfc'
import { getReadFileCheckMtime } from '../../utils/cachePolicy'
import { normalizeLineEndings } from '../../utils/text'
import { readFile as readFileCached } from './cache'
import { resolveSfcBlockSrc } from './vueSfcBlockSrc'

/**
 * 读取并解析 SFC 的配置。
 */
export interface ReadAndParseSfcOptions {
  /**
   * 直接传入源码以跳过文件读取。
   */
  source?: string
  /**
   * 已完成其他 parser 预处理的源码。
   */
  preprocessedSource?: string
  /**
   * 是否忽略空 SFC block。
   */
  ignoreEmpty?: boolean
  /**
   * 是否按 mtime+size 检查文件变更（dev 推荐开启）。
   */
  checkMtime?: boolean
  /**
   * 解析 <template>/<script>/<style> 的 src 引用。
   */
  resolveSrc?: ResolveSfcBlockSrcOptions
}

const sfcParseCache = new LRUCache<
  string,
  {
    parserSource: string
    ignoreEmpty: boolean
    descriptor: SFCDescriptor
    errors: SFCParseResult['errors']
  }
>({
  max: 512,
})

const SCRIPT_SETUP_SRC_ATTR = 'data-weapp-vite-src'
const SCRIPT_SRC_ATTR = 'data-weapp-vite-script-src'
const INTERNAL_SCRIPT_SRC_ATTR = '\0wevu-script-src'
// compiler-sfc 会在 createBlock 前按 AST children 判空；该哨兵只影响判空，不改变源码和 loc。
const EXTERNAL_SCRIPT_CONTENT_SENTINEL = '\0wevu-external-script'

interface SfcScriptSrcAttribute {
  attribute: AttributeNode
  node: ElementNode
  setup: boolean
}

function parseSfcAst(
  source: string,
  options: ParserOptions,
  onScriptSrc: (owned: SfcScriptSrcAttribute) => void,
) {
  const ast = compilerDom.parse(source, options)
  for (const child of ast.children) {
    if (child.type !== NodeTypes.ELEMENT || child.tag !== 'script') {
      continue
    }
    let src: AttributeNode | undefined
    let setup = false
    for (const attribute of child.props) {
      if (attribute.type !== NodeTypes.ATTRIBUTE) {
        continue
      }
      if (attribute.name === 'src') {
        src = attribute
      }
      else if (attribute.name === 'setup') {
        setup = true
      }
    }
    if (src) {
      onScriptSrc({ attribute: src, node: child, setup })
    }
  }
  return ast
}

function collectSfcScriptSrcAttributes(source: string) {
  const attributes: SfcScriptSrcAttribute[] = []
  try {
    parseSfcAst(source, {
      parseMode: 'sfc',
      onError() {},
    }, owned => attributes.push(owned))
  }
  catch {
    // 兼容旧预处理 API：不完整源码保持原样，正式解析仍负责报告错误。
  }
  return attributes
}

const sfcSrcCompiler: TemplateCompiler = {
  compile: compilerDom.compile,
  parse(source, options) {
    return parseSfcAst(source, options, ({ attribute, node }) => {
      attribute.name = INTERNAL_SCRIPT_SRC_ATTR
      const isEmpty = node.children.every(child =>
        child.type === NodeTypes.TEXT && child.content.trim() === '',
      )
      if (isEmpty) {
        node.children.push({
          type: NodeTypes.TEXT,
          content: EXTERNAL_SCRIPT_CONTENT_SENTINEL,
          loc: node.innerLoc ?? node.loc,
        })
      }
    })
  },
}

function restoreScriptBlockSrc(block: SFCScriptBlock | null, marker: string) {
  if (!block || !(marker in block.attrs)) {
    return
  }
  const raw = block.attrs[marker]!
  delete block.attrs[marker]
  block.attrs.src = raw
  block.src = typeof raw === 'string' ? raw : undefined
}

/**
 * 解析 SFC，并在 Vue 完成块归属与校验后恢复外部脚本来源。
 */
export function parseVueSfc(
  source: string,
  options: Omit<SFCParseOptions, 'compiler'> = {},
) {
  const parsed = parseCompilerSfc(source, {
    ...options,
    compiler: sfcSrcCompiler,
  })
  restoreScriptBlockSrc(parsed.descriptor.script, INTERNAL_SCRIPT_SRC_ATTR)
  restoreScriptBlockSrc(parsed.descriptor.scriptSetup, INTERNAL_SCRIPT_SRC_ATTR)
  return parsed
}

function preprocessScriptSource(source: string, setup: boolean) {
  if (!source.includes('<script') || !source.includes('src')) {
    return source
  }
  let transformed: MagicString | undefined
  const marker = setup ? SCRIPT_SETUP_SRC_ATTR : SCRIPT_SRC_ATTR
  for (const owned of collectSfcScriptSrcAttributes(source)) {
    if (owned.setup !== setup) {
      continue
    }
    transformed ??= new MagicString(source)
    transformed.overwrite(
      owned.attribute.nameLoc.start.offset,
      owned.attribute.nameLoc.end.offset,
      marker,
    )
  }
  return transformed?.toString() ?? source
}

/**
 * 预处理 `<script setup src>`，避免编译器丢失 src。
 */
export function preprocessScriptSetupSrc(source: string) {
  return preprocessScriptSource(source, true)
}

/**
 * 预处理普通 `<script src>`，避免编译器丢失 src。
 */
export function preprocessScriptSrc(source: string) {
  return preprocessScriptSource(source, false)
}

/**
 * 将预处理的 `<script setup src>` 恢复为真实 src。
 */
export function restoreScriptSetupSrc(descriptor: SFCDescriptor) {
  restoreScriptBlockSrc(descriptor.scriptSetup, SCRIPT_SETUP_SRC_ATTR)
}

/**
 * 将预处理的 `<script src>` 恢复为真实 src。
 */
export function restoreScriptSrc(descriptor: SFCDescriptor) {
  restoreScriptBlockSrc(descriptor.script, SCRIPT_SRC_ATTR)
}

export { resolveSfcBlockSrc }
export type { ResolveSfcBlockSrcOptions }

/**
 * 读取并解析 SFC，支持缓存与 src 解析。
 */
export async function readAndParseSfc(
  filename: string,
  options?: ReadAndParseSfcOptions,
): Promise<{ source: string, descriptor: SFCDescriptor, errors: SFCParseResult['errors'] }> {
  const checkMtime = options?.checkMtime ?? true
  const source = normalizeLineEndings(options?.source ?? await readFileCached(filename, { checkMtime }))
  const parserSource = options?.preprocessedSource ?? source
  const ignoreEmpty = options?.ignoreEmpty ?? true

  const cached = sfcParseCache.get(filename)
  if (cached) {
    // 描述符只属于本次解析输入；文件签名观察与并发读取不能替代源码和解析选项。
    const hit = cached.parserSource === parserSource && cached.ignoreEmpty === ignoreEmpty
    if (hit) {
      if (options?.resolveSrc) {
        const resolved = await resolveSfcBlockSrc(cached.descriptor, filename, options.resolveSrc)
        return {
          source,
          descriptor: resolved.descriptor,
          errors: cached.errors,
        }
      }
      return {
        source,
        descriptor: cached.descriptor,
        errors: cached.errors,
      }
    }
  }

  const parsed = parseVueSfc(parserSource, {
    filename,
    ignoreEmpty,
  })
  sfcParseCache.set(filename, {
    parserSource,
    ignoreEmpty,
    descriptor: parsed.descriptor,
    errors: parsed.errors,
  })

  if (options?.resolveSrc) {
    const resolved = await resolveSfcBlockSrc(parsed.descriptor, filename, options.resolveSrc)
    return { source, descriptor: resolved.descriptor, errors: parsed.errors }
  }

  return { source, descriptor: parsed.descriptor, errors: parsed.errors }
}

/**
 * 获取 SFC 读取时是否检查 mtime 的策略。
 */
export function getSfcCheckMtime(config?: { isDev?: boolean }) {
  return getReadFileCheckMtime(config)
}
