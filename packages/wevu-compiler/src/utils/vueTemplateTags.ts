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

/**
 * 判断模板标签是否可能需要自动导入。
 */
export function isAutoImportCandidateTag(tag: string) {
  // 小程序自定义组件通常是 kebab-case（如 t-button），
  // 但用户也可能在 Vue 模板里用 PascalCase（如 TButton）。
  return tag.includes('-') || /^[A-Z][\w$]*$/.test(tag)
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

/**
 * 收集 Vue 模板中的自定义组件标签。
 */
export function collectVueTemplateTags(
  template: string,
  options: CollectVueTemplateTagsOptions,
) {
  const tags = new Set<string>()

  const warn = options.warn
  const warnLabel = options.warnLabel || '模板标签收集'
  const filename = options.filename || '<未知文件>'

  try {
    const ast = parseTemplate(template, { onError: () => {} })
    const visit = (node: any) => {
      if (!node) {
        return
      }
      if (Array.isArray(node)) {
        node.forEach(visit)
        return
      }
      if (node.type === NodeTypes.ELEMENT) {
        const tag = node.tag
        if (typeof tag === 'string' && options.shouldCollect(tag)) {
          if (!RESERVED_VUE_COMPONENT_TAGS.has(tag) && !isBuiltinComponent(tag)) {
            tags.add(tag)
          }
        }
      }
      if (node.children) {
        visit(node.children)
      }
      if (node.branches) {
        visit(node.branches)
      }
      if (node.consequent) {
        visit(node.consequent)
      }
      if (node.alternate) {
        visit(node.alternate)
      }
    }
    visit(ast.children)
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    warn?.(`[Vue 模板] 解析失败：${warnLabel}（${filename}）：${message}`)
  }

  return tags
}
