import type { DirectiveTransform } from '@vue/compiler-core'
import { createSimpleExpression, NodeTypes, transformModel } from '@vue/compiler-core'

/** SFC model 沿用 Vue 组件契约，平台元素保留 Wevu 的 value/checked 与 detail.value。 */
export const transformNativeModel: DirectiveTransform = (directive, node, context) => {
  const result = transformModel(directive, node, context)
  if (node.tagType === 1 || result.props.length < 2) {
    return result
  }
  const nativeModel = ['input', 'textarea', 'select', 'switch', 'checkbox', 'slider', 'picker'].includes(node.tag)
  if (directive.arg && nativeModel) {
    throw new Error('[wevu] 原生元素的 v-model 不支持参数')
  }
  const type = node.props.find(prop => prop.type === NodeTypes.ATTRIBUTE && prop.name === 'type')
  const inputType = type?.type === NodeTypes.ATTRIBUTE ? type.value?.content : undefined
  const checked = node.tag === 'switch' || node.tag === 'checkbox' || (node.tag === 'input' && inputType === 'checkbox')
  const change = checked || ['select', 'slider', 'picker'].includes(node.tag) || inputType === 'radio' || directive.modifiers.some(mod => mod.content === 'lazy')
  if (nativeModel) {
    result.props[0]!.key = createSimpleExpression(checked ? 'checked' : 'value', true)
    result.props[1]!.key = createSimpleExpression(change ? 'onChange' : 'onInput', true)
  }
  const assignment = result.props[1]!.value
  let value = nativeModel ? '$event.detail.value' : '$event.detail'
  if (directive.modifiers.some(mod => mod.content === 'trim')) {
    value = `(typeof ${value} === 'string' ? ${value}.trim() : ${value})`
  }
  if (directive.modifiers.some(mod => mod.content === 'number')) {
    value = `Number(${value})`
  }
  if (assignment.type === NodeTypes.COMPOUND_EXPRESSION) {
    assignment.children = assignment.children.map(child => typeof child === 'string' ? child.replace(/= \$event/g, `= ${value}`) : child)
  }
  return result
}
