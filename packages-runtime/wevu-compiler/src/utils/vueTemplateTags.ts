import type { TemplateChildNode } from '@vue/compiler-core'
import { NodeTypes, baseParse as parseTemplate } from '@vue/compiler-core'
import { isBuiltinComponent } from '../auto-import-components/builtin'

export const RESERVED_VUE_COMPONENT_TAGS = new Set([
  'template',
  'slot',
  'component',
  'transition',
  'keep-alive',
  'teleport',
  'suspense',
])

export const VUE_COMPONENT_TAG_RE = /^[A-Z_$][\w$]*$/i

const PASCAL_CASE_TAG_RE = /^[A-Z][\w$]*$/

/**
 * 判断模板标签是否可能需要自动导入。
 */
export function isAutoImportCandidateTag(tag: string) {
  // 小程序自定义组件通常是 kebab-case（如 t-button），
  // 但用户也可能在 Vue 模板里用 PascalCase（如 TButton）。
  return tag.includes('-') || PASCAL_CASE_TAG_RE.test(tag)
}

/**
 * 模板标签收集配置。
 */
export interface CollectVueTemplateTagsOptions {
  filename?: string
  warnLabel?: string
  warn?: (message: string) => void
  shouldCollect: (tag: string) => boolean
}

interface VueTemplateTagAnalysis {
  tags: Set<string>
  errorMessage?: string
}

/**
 * 仅在本次分析内持有 AST，保留标签顺序及自定义筛选器的逐节点语义。
 */
export function analyzeVueTemplateTags(
  template: string,
  options?: Pick<CollectVueTemplateTagsOptions, 'shouldCollect'>,
): VueTemplateTagAnalysis {
  const tags = new Set<string>()
  try {
    const ast = parseTemplate(template, { onError: () => {} })
    const visit = (node: TemplateChildNode) => {
      // baseParse 尚未执行结构指令转换，分支和循环仍是元素节点。
      if (node.type === NodeTypes.ELEMENT) {
        const tag = node.tag
        if ((!options || options.shouldCollect(tag)) && !RESERVED_VUE_COMPONENT_TAGS.has(tag) && !isBuiltinComponent(tag)) {
          tags.add(tag)
        }
        node.children.forEach(visit)
      }
    }
    ast.children.forEach(visit)
    return { tags }
  }
  catch (error) {
    return {
      tags,
      errorMessage: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * 为标签分析的各个消费视图保留原有告警上下文。
 */
export function warnVueTemplateTagAnalysis(
  errorMessage: string | undefined,
  options: Pick<CollectVueTemplateTagsOptions, 'filename' | 'warnLabel' | 'warn'>,
) {
  if (errorMessage !== undefined) {
    const warn = options.warn
    const warnLabel = options.warnLabel || '模板标签收集'
    const filename = options.filename || '<未知文件>'
    warn?.(`[Vue 模板] 解析失败：${warnLabel}（${filename}）：${errorMessage}`)
  }
}

/**
 * 收集 Vue 模板中的自定义组件标签。
 */
export function collectVueTemplateTags(
  template: string,
  options: CollectVueTemplateTagsOptions,
) {
  const { warn, warnLabel, filename } = options
  const analysis = analyzeVueTemplateTags(template, options)
  if (analysis.errorMessage !== undefined) {
    warnVueTemplateTagAnalysis(analysis.errorMessage, { warn, warnLabel, filename })
  }
  return analysis.tags
}
