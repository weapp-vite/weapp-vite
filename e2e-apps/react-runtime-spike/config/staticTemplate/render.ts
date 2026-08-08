/* eslint-disable ts/no-use-before-define -- 静态模板渲染器按 JSX 递归结构组织。 */
import type {
  Expression,
  JSXAttribute,
  JSXElement,
  JSXExpressionContainer,
  JSXFragment,
  JSXText,
} from '@weapp-vite/ast/babelTypes'
import type { StaticTemplateRenderContext } from './types.ts'
import * as t from '@weapp-vite/ast/babelTypes'
import { compileStaticStyle } from './style.ts'

const HOST_TAGS: Record<string, string> = {
  Button: 'button',
  Input: 'input',
  Text: 'text',
  View: 'view',
  button: 'button',
  input: 'input',
  text: 'text',
  view: 'view',
}

const EVENT_NAMES: Record<string, string> = {
  onChange: 'bindchange',
  onInput: 'bindinput',
  onTap: 'bindtap',
  onTapCapture: 'capture-bind:tap',
}
const EVENT_PROP_RE = /^on[A-Z]/

function escapeAttribute(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
}

function escapeText(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function normalizeJsxText(value: string) {
  return value
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .join(' ')
}

function readTagName(node: JSXElement['openingElement']['name']) {
  if (!t.isJSXIdentifier(node)) {
    throw new Error('static template 暂不支持 member/namespaced JSX tag')
  }
  const tag = HOST_TAGS[node.name]
  if (!tag) {
    throw new Error(`static template 暂不支持动态组件 <${node.name}>`)
  }
  return tag
}

function readAttributeExpression(attribute: JSXAttribute) {
  if (!attribute.value) {
    return t.booleanLiteral(true) as Expression
  }
  if (t.isStringLiteral(attribute.value)) {
    return attribute.value as Expression
  }
  if (!t.isJSXExpressionContainer(attribute.value) || t.isJSXEmptyExpression(attribute.value.expression)) {
    return undefined
  }
  return attribute.value.expression as Expression
}

function readStaticPrimitive(expression: Expression) {
  if (t.isStringLiteral(expression) || t.isNumericLiteral(expression) || t.isBooleanLiteral(expression)) {
    return expression.value
  }
  if (t.isTemplateLiteral(expression) && expression.expressions.length === 0) {
    return expression.quasis[0]?.value.cooked ?? ''
  }
  return undefined
}

function appendInternalAttribute(element: JSXElement, name: string, value: string) {
  element.openingElement.attributes.push(
    t.jsxAttribute(t.jsxIdentifier(name), t.stringLiteral(value)),
  )
}

function compileAttributes(element: JSXElement, slot: string, bindingFields: Set<string>) {
  const output: string[] = []
  let hasEvent = false
  for (const attribute of element.openingElement.attributes) {
    if (!t.isJSXAttribute(attribute) || !t.isJSXIdentifier(attribute.name)) {
      throw new Error('static template 暂不支持 JSX spread 或动态属性名')
    }
    const name = attribute.name.name
    if (name === 'key') {
      continue
    }
    const eventName = EVENT_NAMES[name]
    if (eventName) {
      hasEvent = true
      output.push(`${eventName}="eh"`)
      continue
    }
    if (EVENT_PROP_RE.test(name)) {
      throw new Error(`static template 暂不支持事件 ${name}`)
    }
    const expression = readAttributeExpression(attribute)
    if (!expression) {
      continue
    }
    const outputName = name === 'className' ? 'class' : name
    if (name === 'style' && t.isObjectExpression(expression)) {
      const style = compileStaticStyle(expression)
      if (style !== undefined) {
        output.push(`style="${escapeAttribute(style)}"`)
        continue
      }
    }
    const staticValue = readStaticPrimitive(expression)
    if (staticValue !== undefined) {
      output.push(`${outputName}="${escapeAttribute(String(staticValue))}"`)
      continue
    }
    bindingFields.add(name)
    output.push(`${outputName}="{{slots.${slot}.${name}}}"`)
  }
  if (hasEvent) {
    output.push(`data-sid="${slot}"`)
  }
  return output
}

function isDynamicTextExpression(node: JSXExpressionContainer) {
  return !t.isJSXEmptyExpression(node.expression)
    && readStaticPrimitive(node.expression as Expression) === undefined
}

function compileStaticChildren(
  children: Array<JSXText | JSXExpressionContainer | JSXElement | JSXFragment>,
  context: StaticTemplateRenderContext,
): string {
  return children.map((child) => {
    if (t.isJSXText(child)) {
      return escapeText(normalizeJsxText(child.value))
    }
    if (t.isJSXElement(child)) {
      return compileStaticElement(child, context)
    }
    if (t.isJSXFragment(child)) {
      return compileStaticFragment(child, context)
    }
    if (t.isJSXExpressionContainer(child)) {
      if (t.isJSXEmptyExpression(child.expression)) {
        return ''
      }
      const value = readStaticPrimitive(child.expression as Expression)
      if (value !== undefined) {
        return escapeText(String(value))
      }
      throw new Error('static template 的容器节点暂不支持动态结构表达式')
    }
    return ''
  }).join('')
}

function compileStaticFragment(fragment: JSXFragment, context: StaticTemplateRenderContext): string {
  return compileStaticChildren(fragment.children as Array<JSXText | JSXExpressionContainer | JSXElement | JSXFragment>, context)
}

function compileStaticElement(element: JSXElement, context: StaticTemplateRenderContext): string {
  const tag = readTagName(element.openingElement.name)
  const slot = `s${context.slotSeed++}`
  const bindingFields = new Set<string>()
  const slotRecord = {
    bindings: [] as string[],
    id: slot,
    tag,
  }
  context.slots.push(slotRecord)
  const attributes = compileAttributes(element, slot, bindingFields)
  const children = element.children as Array<JSXText | JSXExpressionContainer | JSXElement | JSXFragment>
  const hasDynamicText = (tag === 'text' || tag === 'button')
    && children.some(child => t.isJSXExpressionContainer(child) && isDynamicTextExpression(child))

  let content: string
  if (hasDynamicText) {
    if (children.some(child => t.isJSXElement(child) || t.isJSXFragment(child))) {
      throw new Error(`static template 的 <${tag}> 不支持动态文本与元素子节点混用`)
    }
    bindingFields.add('text')
    content = `{{slots.${slot}.text}}`
  }
  else {
    content = compileStaticChildren(children, context)
  }

  appendInternalAttribute(element, '__slot', slot)
  if (bindingFields.size > 0) {
    appendInternalAttribute(element, '__bindingFields', [...bindingFields].join(','))
  }
  slotRecord.bindings = [...bindingFields]

  const attributeSegment = attributes.length > 0 ? ` ${attributes.join(' ')}` : ''
  if (element.openingElement.selfClosing) {
    return `<${tag}${attributeSegment} />`
  }
  return `<${tag}${attributeSegment}>${content}</${tag}>`
}

export function renderStaticTemplate(root: JSXElement | JSXFragment, context: StaticTemplateRenderContext) {
  return t.isJSXElement(root)
    ? compileStaticElement(root, context)
    : compileStaticFragment(root, context)
}
