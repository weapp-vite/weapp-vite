import type { SFCDescriptor, SFCScriptBlock } from 'vue/compiler-sfc'
import type { ResolveSfcBlockSrcOptions } from '../plugins/utils/vueSfc'
import type { EncodedSourceMapLike } from '../utils/sourcemap'
import type { StaticPageDeclaration } from './public'
import type { PageDeclarationAnalysis, PageDeclarationScriptBlock, PageDeclarationScriptBlockKind } from './types'
import { WEVU_DEFINE_PAGE_MACRO, WEVU_DEFINE_PAGE_META_MACRO } from '@weapp-core/constants'
import MagicString, { Bundle } from 'magic-string'
import { createSfcParseError, parseVueSfc, resolveSfcBlockSrc } from '../plugins/utils/vueSfc'
import { analyzePageCompileTimeMacroBlocks, analyzePageDeclarationBlocks } from './analyze'
import { rebaseExternalScriptImports } from './rewrite'

const PAGE_DECLARATION_MACRO_HINT_RE = new RegExp(
  `(?:^|[^\\p{ID_Continue}$\\u200C\\u200D])${WEVU_DEFINE_PAGE_MACRO}(?![\\p{ID_Continue}$\\u200C\\u200D])`,
  'u',
)

export { collectPageMetaCallsFromPrograms } from './analyze'
export type { StaticPageDeclaration, StaticRouteValue } from './public'

interface ResolvedScriptSourceIds {
  scriptResolvedId?: string
  scriptSetupResolvedId?: string
}

interface SourceTransform {
  code: MagicString
  source: string
}

interface StripPageDeclarationResult {
  code: string
  map?: EncodedSourceMapLike
}

export interface StripSfcPageDeclarationResult extends StripPageDeclarationResult {
  descriptor: SFCDescriptor
  descriptorForCompile?: SFCDescriptor
  scriptMap?: EncodedSourceMapLike
}

export interface ExtractPageDeclarationWithDependenciesResult {
  declaration?: StaticPageDeclaration
  declarationSourceFile?: string
  dependencies: string[]
}

function isOriginalVueSfc(filename: string) {
  return !filename.includes('?') && !filename.includes('#') && /\.vue$/i.test(filename)
}

function parsePageDeclarationSfc(source: string, filename: string, ignoreEmpty = true) {
  // 页面声明只读取脚本块；模板表达式由后续平台预处理与模板编译负责解析。
  const parsed = parseVueSfc(source, { filename, ignoreEmpty, templateParseOptions: { prefixIdentifiers: false } })
  if (parsed.errors.length) {
    throw createSfcParseError(parsed.errors[0], {
      filename,
      source,
      formatMessage: (message, location) => `${filename}:${location?.start.line ?? 1}:${location?.start.column ?? 1} 解析页面声明 SFC 失败：${message}`,
    })
  }
  return parsed.descriptor
}

function collectSfcScriptBlocks(
  source: string,
  filename: string,
  descriptor: SFCDescriptor,
  resolvedIds: ResolvedScriptSourceIds = {},
) {
  const blocks: PageDeclarationScriptBlock[] = []
  const appendBlock = (
    block: SFCScriptBlock | null,
    kind: PageDeclarationScriptBlockKind,
    resolvedId: string | undefined,
  ) => {
    if (!block) {
      return
    }
    const external = Boolean(block.src && resolvedId)
    blocks.push({
      content: block.content,
      filename: external ? resolvedId! : filename,
      kind,
      offset: external ? 0 : block.loc.start.offset,
      order: block.loc.start.offset,
      source: external ? block.content : source,
    })
  }

  appendBlock(descriptor.script, 'script', resolvedIds.scriptResolvedId)
  appendBlock(descriptor.scriptSetup, 'scriptSetup', resolvedIds.scriptSetupResolvedId)
  blocks.sort((left, right) => left.order - right.order)
  return blocks
}

function createSourceTransforms(
  filename: string,
  source: string,
  blocks: PageDeclarationScriptBlock[],
  analysis: PageDeclarationAnalysis,
) {
  const transforms = new Map<string, SourceTransform>()
  for (const block of blocks) {
    const current = transforms.get(block.filename)
    if (current && current.source !== block.source) {
      throw new Error(`${block.filename}:1:1 页面声明源文件内容不一致。`)
    }
    if (!current) {
      transforms.set(block.filename, {
        code: new MagicString(block.source),
        source: block.source,
      })
    }
  }

  for (const [sourceFile, transform] of transforms) {
    const edits = analysis.edits
      .filter(edit => edit.block.filename === sourceFile)
      .map(edit => ({
        end: edit.block.offset + edit.end,
        start: edit.block.offset + edit.start,
      }))
      .sort((left, right) => left.start - right.start)
    for (let index = 0; index < edits.length; index += 1) {
      const edit = edits[index]!
      if (edit.start < 0 || edit.end > transform.source.length || edit.start > edit.end) {
        throw new Error(`${sourceFile}:1:1 页面声明擦除范围无效。`)
      }
      if (index > 0 && edit.start < edits[index - 1]!.end) {
        throw new Error(`${sourceFile}:1:1 页面声明擦除范围发生重叠。`)
      }
      const replacement = transform.source.slice(edit.start, edit.end).replace(/[^\r\n\u2028\u2029]/g, ' ')
      transform.code.overwrite(edit.start, edit.end, replacement)
    }
  }

  if (!transforms.has(filename)) {
    transforms.set(filename, { code: new MagicString(source), source })
  }
  return transforms
}

function updateScriptBlockSource(
  block: SFCScriptBlock | null,
  info: PageDeclarationScriptBlock | undefined,
  transform: SourceTransform | undefined,
  sourceMap: boolean,
): SFCScriptBlock | null {
  if (!block || !info || !transform) {
    return block
  }
  const content = transform.code.slice(info.offset, info.offset + info.content.length)
  return {
    ...block,
    content,
    // 两库使用相同的 source map 格式，仅 version 字段的类型声明不同。
    map: block.src && sourceMap
      ? transform.code.generateMap({
        hires: true,
        includeContent: true,
        source: info.filename,
      }) as unknown as SFCScriptBlock['map']
      : block.map,
  }
}

function resolveSourcePosition(source: string, offset: number) {
  let line = 1
  let lineStart = 0
  for (let index = 0; index < offset; index += 1) {
    const char = source.charCodeAt(index)
    if (char === 10 || char === 0x2028 || char === 0x2029) {
      line += 1
      lineStart = index + 1
    }
    else if (char === 13) {
      line += 1
      if (source.charCodeAt(index + 1) === 10) {
        index += 1
      }
      lineStart = index + 1
    }
  }
  return { column: offset - lineStart + 1, line, offset }
}

function createDescriptorForExternalScriptCompile(
  descriptor: SFCDescriptor,
  blocks: PageDeclarationScriptBlock[],
  transforms: Map<string, SourceTransform>,
  sourceMap: boolean,
) {
  if (!descriptor.scriptSetup || !blocks.some(block => block.filename !== descriptor.filename)) {
    return undefined
  }

  const bundle = new Bundle({ separator: '' })
  let source = ''
  let script: SFCScriptBlock | null = null
  let scriptSetup: SFCScriptBlock | null = null
  for (const block of blocks) {
    const original = block.kind === 'script' ? descriptor.script : descriptor.scriptSetup
    const transform = transforms.get(block.filename)!
    const chunk = transform.code.clone().snip(block.offset, block.offset + block.content.length)
    const content = chunk.toString()
    // compileScript 会把 import 提升到 SFC 起点，外部脚本也必须保留真实的块边界。
    const openingTag = `<script${block.kind === 'scriptSetup' ? ' setup' : ''}${original?.lang ? ` lang=${JSON.stringify(original.lang)}` : ''}>\n`
    bundle.append(openingTag)
    bundle.addSource({ content: chunk, filename: block.filename })
    bundle.append('\n</script>\n')
    source += openingTag
    const startOffset = source.length
    source += `${content}\n</script>\n`
    const attrs = { ...original!.attrs }
    delete attrs.src
    const nextBlock = {
      ...original!,
      // 编译副本已内联脚本；移除 src 让 Vue 保留普通脚本 AST，原描述符仍保留来源。
      attrs,
      src: undefined,
      content,
      loc: {
        source: content,
        start: resolveSourcePosition(source, startOffset),
        end: resolveSourcePosition(source, startOffset + content.length),
      },
    }
    if (block.kind === 'script') {
      script = nextBlock
    }
    else {
      scriptSetup = nextBlock
    }
  }

  return {
    descriptor: {
      ...descriptor,
      source,
      script,
      scriptSetup,
    },
    map: sourceMap
      ? bundle.generateMap({ hires: true, includeContent: true }) as EncodedSourceMapLike
      : undefined,
  }
}

/**
 * 源码是否可能包含页面路由声明宏。
 */
export function mayContainPageDeclaration(source: string) {
  // 转义的导入标识符必须交给 AST 绑定分析，不能因原始文本不匹配而遗漏。
  return source.includes('\\') || PAGE_DECLARATION_MACRO_HINT_RE.test(source)
}

/**
 * 源码是否可能包含页面元信息宏。
 */
export function mayContainPageMeta(source: string) {
  // 页面布局的预筛选独立于路由声明，保留转义标识符的保守解析路径。
  return source.includes('\\') || source.includes(WEVU_DEFINE_PAGE_META_MACRO)
}

function stripAnalyzedPageMacrosFromSfcDescriptor(
  source: string,
  filename: string,
  descriptor: SFCDescriptor,
  sourceMap: boolean,
  blocks: PageDeclarationScriptBlock[],
  analysis: PageDeclarationAnalysis,
): StripSfcPageDeclarationResult | undefined {
  if (!analysis.edits.length && !blocks.some(block => block.filename !== filename)) {
    return undefined
  }

  const transforms = createSourceTransforms(filename, source, blocks, analysis)
  for (const parsed of analysis.parsedBlocks) {
    if (parsed.block.filename !== filename) {
      rebaseExternalScriptImports(
        parsed,
        filename,
        transforms.get(parsed.block.filename)!.code,
        analysis.parsedBlocks,
      )
    }
  }
  const scriptBlock = blocks.find(block => block.kind === 'script')
  const scriptSetupBlock = blocks.find(block => block.kind === 'scriptSetup')
  const descriptorWithStrippedScripts: SFCDescriptor = {
    ...descriptor,
    source: transforms.get(filename)!.code.toString(),
    script: updateScriptBlockSource(
      descriptor.script,
      scriptBlock,
      scriptBlock ? transforms.get(scriptBlock.filename) : undefined,
      sourceMap,
    ),
    scriptSetup: updateScriptBlockSource(
      descriptor.scriptSetup,
      scriptSetupBlock,
      scriptSetupBlock ? transforms.get(scriptSetupBlock.filename) : undefined,
      sourceMap,
    ),
  }
  const externalCompile = createDescriptorForExternalScriptCompile(
    descriptorWithStrippedScripts,
    blocks,
    transforms,
    sourceMap,
  )
  const mainTransform = transforms.get(filename)!
  const hasMainEdits = analysis.edits.some(edit => edit.block.filename === filename)
  return {
    code: mainTransform.code.toString(),
    descriptor: descriptorWithStrippedScripts,
    descriptorForCompile: externalCompile?.descriptor,
    map: sourceMap && hasMainEdits
      ? mainTransform.code.generateMap({
        hires: true,
        includeContent: true,
        source: filename,
      }) as EncodedSourceMapLike
      : undefined,
    scriptMap: externalCompile?.map,
  }
}

export function stripPageDeclarationFromSfcDescriptor(
  source: string,
  filename: string,
  descriptor: SFCDescriptor,
  sourceMap = true,
  resolvedIds: ResolvedScriptSourceIds = {},
) {
  const blocks = collectSfcScriptBlocks(source, filename, descriptor, resolvedIds)
  return stripAnalyzedPageMacrosFromSfcDescriptor(
    source,
    filename,
    descriptor,
    sourceMap,
    blocks,
    analyzePageDeclarationBlocks(blocks),
  )
}

/**
 * 在 Vue 收集 setup 暴露绑定前移除页面编译宏，避免已擦除的导入残留在返回对象中。
 *
 * 该入口只服务 SFC 编译；公开的页面路由擦除入口仍仅处理 `definePage`。
 *
 * @internal
 */
export function stripPageCompileTimeMacrosFromSfcDescriptor(
  source: string,
  filename: string,
  descriptor: SFCDescriptor,
  sourceMap = true,
  resolvedIds: ResolvedScriptSourceIds = {},
) {
  const blocks = collectSfcScriptBlocks(source, filename, descriptor, resolvedIds)
  return stripAnalyzedPageMacrosFromSfcDescriptor(
    source,
    filename,
    descriptor,
    sourceMap,
    blocks,
    analyzePageCompileTimeMacroBlocks(blocks),
  )
}

/**
 * 解析页面声明，并返回由现有 SFC `src` 规则解析出的脚本依赖。
 */
export async function extractPageDeclarationWithDependencies(
  source: string,
  filename: string,
  options?: ResolveSfcBlockSrcOptions,
): Promise<ExtractPageDeclarationWithDependenciesResult> {
  if (!isOriginalVueSfc(filename)) {
    if (!mayContainPageDeclaration(source)) {
      return { dependencies: [] }
    }
    const analysis = analyzePageDeclarationBlocks([{
      content: source,
      filename,
      kind: 'script',
      offset: 0,
      order: 0,
      source,
    }])
    return {
      declaration: analysis.declaration,
      declarationSourceFile: analysis.declarationSourceFile,
      dependencies: [],
    }
  }
  if (!mayContainPageDeclaration(source) && (!source.includes('<script') || !source.includes('src'))) {
    return { dependencies: [] }
  }

  const descriptor = parsePageDeclarationSfc(source, filename)
  const inlineBlocks = collectSfcScriptBlocks(source, filename, descriptor)
  const hasExternalScript = Boolean(descriptor.script?.src || descriptor.scriptSetup?.src)
  if (!hasExternalScript && !inlineBlocks.some(block => mayContainPageDeclaration(block.content))) {
    return { dependencies: [] }
  }
  const resolved = await resolveSfcBlockSrc(descriptor, filename, options ?? {})
  const resolvedIds = {
    scriptResolvedId: resolved.scriptResolvedId,
    scriptSetupResolvedId: resolved.scriptSetupResolvedId,
  }
  const dependencies = [...new Set([
    resolved.scriptResolvedId,
    resolved.scriptSetupResolvedId,
  ].filter((dependency): dependency is string => Boolean(dependency)))]
  const blocks = collectSfcScriptBlocks(
    source,
    filename,
    resolved.descriptor,
    resolvedIds,
  )
  if (!blocks.some(block => mayContainPageDeclaration(block.content))) {
    return { dependencies }
  }
  const analysis = analyzePageDeclarationBlocks(blocks)
  return {
    declaration: analysis.declaration,
    declarationSourceFile: analysis.declarationSourceFile,
    dependencies,
  }
}

export function extractPageDeclaration(source: string, filename: string) {
  if (isOriginalVueSfc(filename)) {
    const descriptor = parsePageDeclarationSfc(source, filename)
    return analyzePageDeclarationBlocks(collectSfcScriptBlocks(source, filename, descriptor)).declaration
  }
  return analyzePageDeclarationBlocks([{
    content: source,
    filename,
    kind: 'script',
    offset: 0,
    order: 0,
    source,
  }]).declaration
}

export function stripPageDeclaration(
  source: string,
  filename: string,
): StripPageDeclarationResult | undefined {
  if (isOriginalVueSfc(filename)) {
    const descriptor = parsePageDeclarationSfc(source, filename)
    const result = stripPageDeclarationFromSfcDescriptor(source, filename, descriptor)
    return result ? { code: result.code, map: result.map } : undefined
  }
  const block: PageDeclarationScriptBlock = {
    content: source,
    filename,
    kind: 'script',
    offset: 0,
    order: 0,
    source,
  }
  const analysis = analyzePageDeclarationBlocks([block])
  if (!analysis.edits.length) {
    return undefined
  }
  const transform = createSourceTransforms(filename, source, [block], analysis).get(filename)!
  return {
    code: transform.code.toString(),
    map: transform.code.generateMap({
      hires: true,
      includeContent: true,
      source: filename,
    }) as EncodedSourceMapLike,
  }
}
