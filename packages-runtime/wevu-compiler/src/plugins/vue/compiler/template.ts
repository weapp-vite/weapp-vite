import type { TemplateCompileOptions, TemplateCompileResult, TransformContext } from './template/types'
import {
  parse,
} from '@vue/compiler-dom'
import { buildClassStyleWxsTag } from './template/classStyleRuntime'
import { resolveHtmlTagToWxmlMap } from './template/htmlTagMapping'
import { transformNode } from './template/nodes'
import { getMiniProgramTemplatePlatform } from './template/platforms'

const HTML_VOID_TAGS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
])

export type { MiniProgramPlatform } from './template/platform'
export {
  alipayPlatform,
  defaultMiniProgramPlatform,
  defaultMiniProgramTemplatePlatform,
  defaultPlatform,
  getDefaultMiniProgramPlatform,
  getDefaultMiniProgramTemplatePlatform,
  getMiniProgramTemplatePlatform,
  swanPlatform,
  ttPlatform,
} from './template/platforms'
export { wechatPlatform } from './template/platforms/wechat'
export type { TemplateCompileResult } from './template/types'
export type { TemplateCompileOptions } from './template/types'

/**
 * 将 Vue 模板编译为 WXML。
 */
export function compileVueTemplateToWxml(
  template: string,
  filename: string,
  options?: TemplateCompileOptions,
): TemplateCompileResult {
  const warnings: string[] = []
  const runtimeMode = options?.classStyleRuntime ?? 'js'
  // 这里是模板编译入口对 class/style 运行时的“第一层决策”：
  // - auto：有 wxsExtension 时优先 wxs，否则用 js。
  // - wxs：若缺少 wxsExtension（平台不支持或未配置），回退为 js。
  // - js：始终使用 js。
  // 说明：即使最终模式是 wxs，单个复杂表达式在后续 attributes.ts 里仍可能回退到 js 计算。
  const resolvedRuntime = runtimeMode === 'auto'
    ? (options?.wxsExtension ? 'wxs' : 'js')
    : (runtimeMode === 'wxs' && !options?.wxsExtension ? 'js' : runtimeMode)
  const wxsExtension = options?.wxsExtension
  const scopedSlotsRequireProps = options?.scopedSlotsRequireProps
    ?? (options?.scopedSlotsCompiler !== 'augmented')
  const htmlTagToWxmlMap = resolveHtmlTagToWxmlMap(options?.htmlTagToWxml)

  try {
    // 使用 compiler-dom 解析模板，确保浏览器环境自带 decodeEntities 解析能力。
    const ast = parse(template, {
      isVoidTag: tag => HTML_VOID_TAGS.has(tag),
      onError: (error) => {
        warnings.push(`模板解析失败：${error.message}`)
      },
    })

    const context: TransformContext = {
      source: template,
      filename,
      warnings,
      platform: options?.platform ?? getMiniProgramTemplatePlatform(),
      htmlTagToWxmlMap,
      htmlTagToWxmlTagClass: options?.htmlTagToWxmlTagClass ?? true,
      scopedSlotsCompiler: options?.scopedSlotsCompiler ?? 'auto',
      scopedSlotsRequireProps,
      slotMultipleInstance: options?.slotMultipleInstance ?? true,
      scopedSlotComponents: [],
      componentGenerics: {},
      scopeStack: [],
      slotPropStack: [],
      rewriteScopedSlot: false,
      classStyleRuntime: resolvedRuntime === 'wxs' ? 'wxs' : 'js',
      objectLiteralBindMode: options?.objectLiteralBindMode ?? 'runtime',
      mustacheInterpolation: options?.mustacheInterpolation ?? 'compact',
      classStyleBindings: [],
      classStyleWxs: false,
      classStyleWxsExtension: wxsExtension,
      classStyleWxsSrc: options?.classStyleWxsSrc,
      forStack: [],
      forIndexSeed: 0,
      templateRefs: [],
      templateRefIndexSeed: 0,
      layoutHosts: [],
      layoutHostIndexSeed: 0,
      inlineExpressions: [],
      inlineExpressionSeed: 0,
    }

    // 转换 AST 到 WXML
    let wxml = ast.children
      .map(child => transformNode(child, context))
      .join('')

    if (context.classStyleWxs) {
      const ext = context.classStyleWxsExtension || 'wxs'
      const helperTag = buildClassStyleWxsTag(ext, context.classStyleWxsSrc)
      wxml = `${helperTag}\n${wxml}`
    }

    const result: TemplateCompileResult = {
      code: wxml,
      warnings,
    }

    if (context.scopedSlotComponents.length) {
      result.scopedSlotComponents = context.scopedSlotComponents
    }
    if (Object.keys(context.componentGenerics).length) {
      result.componentGenerics = context.componentGenerics
    }
    if (context.classStyleWxs) {
      result.classStyleWxs = true
    }
    if (context.classStyleBindings.length) {
      result.classStyleBindings = context.classStyleBindings
      result.classStyleRuntime = context.classStyleRuntime
    }
    if (context.templateRefs.length) {
      result.templateRefs = context.templateRefs
    }
    if (context.layoutHosts.length) {
      result.layoutHosts = context.layoutHosts
    }
    if (context.inlineExpressions.length) {
      result.inlineExpressions = context.inlineExpressions
    }

    return result
  }
  catch (error) {
    warnings.push(`模板编译失败：${error}`)
    return {
      code: template,
      warnings,
    }
  }
}
