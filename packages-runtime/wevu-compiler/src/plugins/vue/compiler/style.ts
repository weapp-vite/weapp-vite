import type { SFCStyleBlock, SFCStyleCompileOptions } from 'vue/compiler-sfc'
import postcss from 'postcss'
import selectorParser from 'postcss-selector-parser'
import { compileStyleAsync } from 'vue/compiler-sfc'
import { DEFAULT_HTML_TO_WXML_TAG_MAP } from './template/htmlTagMapping'

export { transformNestedWxssVars } from './wxss'

/**
 * 样式编译结果。
 */
export interface StyleCompileResult {
  code: string
  map?: string
  scopedId?: string
  usesSlotted?: boolean
  modules?: Record<string, Record<string, string>>
  dependencies?: string[]
}

/**
 * 样式编译选项。
 */
export interface StyleCompileOptions {
  id: string
  filename?: string
  scoped?: boolean
  transformScoped?: boolean
  modules?: boolean | string
  preprocessOptions?: Record<string, unknown>
  preserveDeepSelectors?: boolean
}

function normalizeStyleError(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function hasSlottedScopeSelector(source: string, slottedScopeId: string) {
  let found = false
  const processor = selectorParser((selectors) => {
    selectors.walkAttributes((attribute) => {
      if (attribute.attribute === slottedScopeId) {
        found = true
      }
    })
  })
  const root = postcss.parse(source)
  root.walkRules((rule) => {
    if (!found) {
      processor.processSync(rule.selector)
    }
  })
  return found
}

/**
 * compiler-sfc 已在 scoped 插件中处理 deep 选择器，此函数保留为兼容入口。
 */
export function transformVueDeepSelectors(source: string) {
  const root = postcss.parse(source)
  const processor = selectorParser((selectors) => {
    selectors.walkTags((tag) => {
      const mapped = DEFAULT_HTML_TO_WXML_TAG_MAP[tag.value.toLowerCase()]
      if (mapped && mapped !== tag.value.toLowerCase()) {
        tag.replaceWith(selectorParser.className({ value: tag.value.toLowerCase() }))
      }
    })
    selectors.walkPseudos((pseudo) => {
      if (![':deep', '::v-deep'].includes(pseudo.value)) {
        return
      }
      const replacement = pseudo.nodes?.[0]?.nodes.map(node => node.clone()) ?? []
      replacement.length ? pseudo.replaceWith(...replacement) : pseudo.remove()
    })
  })
  root.walkRules((rule) => {
    rule.selector = processor.processSync(rule.selector).replace(/\s{2,}/g, ' ').trim()
  })
  return root.toString()
}

/**
 * 将 Vue SFC style 块编译为可交给 Vite CSS 管线的内容。
 */
export async function compileVueStyleToWxss(
  styleBlock: SFCStyleBlock,
  options: StyleCompileOptions,
): Promise<StyleCompileResult> {
  const filename = options.filename ?? `style-${options.id}.${styleBlock.lang || 'css'}`
  const moduleName = typeof styleBlock.module === 'string'
    ? styleBlock.module
    : typeof options.modules === 'string'
      ? options.modules
      : '$style'
  const modules = Boolean(options.modules || styleBlock.module)
  const result = await compileStyleAsync({
    filename,
    id: `data-v-${options.id}`,
    source: styleBlock.content,
    scoped: options.transformScoped !== false && Boolean(options.scoped || styleBlock.scoped),
    modules,
    modulesOptions: modules
      ? { generateScopedName: (name: string) => `${name}_${options.id}` }
      : undefined,
    preprocessLang: styleBlock.lang as SFCStyleCompileOptions['preprocessLang'],
    preprocessOptions: options.preprocessOptions,
  })

  if (result.errors.length) {
    throw new Error(`SFC 样式编译失败（${filename}）：${result.errors.map(normalizeStyleError).join('; ')}`)
  }

  return {
    code: options.preserveDeepSelectors ? result.code : transformVueDeepSelectors(result.code),
    map: result.map ? JSON.stringify(result.map) : undefined,
    scopedId: options.scoped || styleBlock.scoped ? `data-v-${options.id}` : undefined,
    usesSlotted: hasSlottedScopeSelector(result.code, `data-v-${options.id}-s`),
    modules: result.modules ? { [moduleName]: result.modules } : undefined,
    dependencies: [...result.dependencies],
  }
}
