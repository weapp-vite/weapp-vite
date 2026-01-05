import type { AttributeNode } from '@vue/compiler-core'
import type { TransformContext } from './types'
import { NodeTypes } from '@vue/compiler-core'

export function renderClassAttribute(staticClass: string | undefined, classExpressions: string[] | undefined): string {
  const parts: string[] = []
  if (staticClass?.trim()) {
    parts.push(staticClass.trim())
  }
  for (const exp of (classExpressions ?? [])) {
    if (!exp) {
      continue
    }
    parts.push(`{{${exp}}}`)
  }
  return `class="${parts.join(' ')}"`
}

export function renderStyleAttribute(
  staticStyle: string | undefined,
  dynamicStyleExp: string | undefined,
  vShowExp: string | undefined,
): string {
  let merged = ''

  if (staticStyle?.trim()) {
    merged += staticStyle.trim()
  }

  if (merged && !/;\s*$/.test(merged)) {
    merged += ';'
  }

  if (dynamicStyleExp) {
    merged += `{{${dynamicStyleExp}}}`
  }

  if (vShowExp) {
    const hiddenStyle = merged ? ';display: none' : 'display: none'
    merged += `{{${vShowExp} ? '' : '${hiddenStyle}'}}`
  }

  return `style="${merged}"`
}

export function transformAttribute(node: AttributeNode, _context: TransformContext): string {
  const { name, value } = node

  if (!value) {
    return name
  }

  // 处理静态属性
  if (value.type === NodeTypes.TEXT) {
    return `${name}="${value.content}"`
  }

  return `${name}=""`
}
