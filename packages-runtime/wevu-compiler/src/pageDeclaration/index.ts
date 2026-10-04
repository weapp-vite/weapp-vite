import type { SFCDescriptor } from 'vue/compiler-sfc'
import type { ResolveSfcBlockSrcOptions } from '../plugins/utils/vueSfc'
import type { EncodedSourceMapLike } from '../utils/sourcemap'
import type { StaticPageDeclaration, StaticPageMeta } from './public'
import type { ResolvedScriptSourceIds } from './sfc'
import type { PageDeclarationAnalysis, PageDeclarationScriptBlock } from './types'
import { WEVU_DEFINE_PAGE_MACRO, WEVU_DEFINE_PAGE_META_MACRO } from '@weapp-core/constants'
import { createSfcParseError, parseVueSfc, resolveSfcBlockSrc } from '../plugins/utils/vueSfc'
import { analyzePageCompileTimeMacroBlocks, analyzePageDeclarationBlocks } from './analyze'
import { parsePageDeclarationBlock } from './program'
import { rebaseExternalScriptImports } from './rewrite'
import { collectSfcScriptBlocks, createDescriptorForExternalScriptCompile, createSourceTransforms, updateScriptBlockSource } from './sfc'

const PAGE_DECLARATION_MACRO_HINT_RE = new RegExp(
  `(?:^|[^\\p{ID_Continue}$\\u200C\\u200D])${WEVU_DEFINE_PAGE_MACRO}(?![\\p{ID_Continue}$\\u200C\\u200D])`,
  'u',
)

export { collectPageMetaCallsFromPrograms } from './analyze'
export type { StaticPageDeclaration, StaticPageMeta, StaticRouteValue } from './public'

interface StripPageDeclarationResult {
  code: string
  map?: EncodedSourceMapLike
}

export interface StripSfcPageDeclarationResult extends StripPageDeclarationResult {
  routeConfig?: StaticPageDeclaration
  pageMeta?: StaticPageMeta
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
    routeConfig: analysis.declaration,
    pageMeta: analysis.pageMeta,
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
 * 统一准备外部脚本源码、位置与映射；仅页面在 Vue 收集 setup 绑定前擦除页面编译宏。
 *
 * 公开的页面路由擦除入口仍仅处理 `definePage`。
 *
 * @internal
 */
export function prepareSfcScriptCompile(
  source: string,
  filename: string,
  descriptor: SFCDescriptor,
  sourceMap = true,
  resolvedIds: ResolvedScriptSourceIds = {},
  isPage = true,
) {
  const blocks = collectSfcScriptBlocks(source, filename, descriptor, resolvedIds)
  return stripAnalyzedPageMacrosFromSfcDescriptor(
    source,
    filename,
    descriptor,
    sourceMap,
    blocks,
    isPage
      ? analyzePageCompileTimeMacroBlocks(blocks)
      : { edits: [], parsedBlocks: blocks.map(parsePageDeclarationBlock) },
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
