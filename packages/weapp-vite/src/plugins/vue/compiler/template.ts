import type {
  AttributeNode,
  DirectiveNode,
  ElementNode,
  TextNode,
} from '@vue/compiler-core'
import generate from '@babel/generator'
import { parse as babelParse } from '@babel/parser'
import * as t from '@babel/types'
import {
  NodeTypes,
  baseParse as parse,
} from '@vue/compiler-core'

export interface TemplateCompileResult {
  code: string
  warnings: string[]
}

interface TransformContext {
  source: string
  filename: string
  warnings: string[]
}

function templateLiteralToConcat(node: t.TemplateLiteral): t.Expression {
  const segments: t.Expression[] = []

  node.quasis.forEach((quasi, index) => {
    const cooked = quasi.value.cooked ?? quasi.value.raw ?? ''
    if (cooked) {
      segments.push(t.stringLiteral(cooked))
    }
    if (index < node.expressions.length) {
      let inner = node.expressions[index] as t.Expression
      if (t.isTemplateLiteral(inner)) {
        inner = templateLiteralToConcat(inner)
      }
      segments.push(inner)
    }
  })

  if (segments.length === 0) {
    return t.stringLiteral('')
  }
  if (segments.length === 1) {
    return segments[0]
  }

  return segments.reduce((acc, cur) => t.binaryExpression('+', acc, cur))
}

function normalizeWxmlExpression(exp: string): string {
  if (!exp.includes('`')) {
    return exp
  }

  try {
    const ast = babelParse(`(${exp})`, {
      sourceType: 'module',
      plugins: ['typescript'],
    })
    const stmt = ast.program.body[0]
    if (!stmt || !('expression' in stmt)) {
      return exp
    }
    const expression = (stmt as any).expression as t.Expression
    const normalized = t.isTemplateLiteral(expression)
      ? templateLiteralToConcat(expression)
      : expression
    const { code } = generate(normalized, {
      compact: true,
      jsescOption: { quotes: 'single' },
    })
    return code
  }
  catch {
    return exp
  }
}

function isStructuralDirective(node: ElementNode): {
  type: 'if' | 'for' | null
  directive: DirectiveNode | undefined
} {
  // 检查是否有 v-if, v-else-if, v-else, v-for 指令
  for (const prop of node.props) {
    if (prop.type === NodeTypes.DIRECTIVE) {
      if (prop.name === 'if' || prop.name === 'else-if' || prop.name === 'else') {
        return { type: 'if', directive: prop }
      }
      if (prop.name === 'for') {
        return { type: 'for', directive: prop }
      }
    }
  }
  return { type: null, directive: undefined }
}

function transformElement(node: ElementNode, context: TransformContext): string {
  const { tag } = node

  // 检查是否是 template 元素（用于 slot 内容）
  if (tag === 'template') {
    return transformTemplateElement(node, context)
  }

  // 检查是否是 slot 元素
  if (tag === 'slot') {
    return transformSlotElement(node, context)
  }

  // 检查是否是 component 元素（动态组件）
  if (tag === 'component') {
    return transformComponentElement(node, context)
  }

  // 检查是否是 transition 元素
  if (tag === 'transition') {
    return transformTransitionElement(node, context)
  }

  // 检查是否是 keep-alive 元素
  if (tag === 'keep-alive') {
    return transformKeepAliveElement(node, context)
  }

  // 检查是否有结构指令
  const { type } = isStructuralDirective(node)

  if (type === 'if') {
    return transformIfElement(node, context)
  }

  if (type === 'for') {
    return transformForElement(node, context)
  }

  // 普通元素
  return transformNormalElement(node, context)
}

function transformNormalElement(node: ElementNode, context: TransformContext): string {
  const { tag, props } = node

  // 收集属性
  const attrs: string[] = []

  for (const prop of props) {
    if (prop.type === NodeTypes.ATTRIBUTE) {
      // 普通属性
      const attr = transformAttribute(prop, context)
      if (attr) {
        attrs.push(attr)
      }
    }
    else if (prop.type === NodeTypes.DIRECTIVE) {
      // 指令
      const dir = transformDirective(prop, context, node)
      if (dir) {
        attrs.push(dir)
      }
    }
  }

  // 处理子元素
  let children = ''
  if (node.children.length > 0) {
    children = node.children
      .map(child => transformNode(child, context))
      .join('')
  }

  // 生成 WXML
  const attrString = attrs.length ? ` ${attrs.join(' ')}` : ''

  return children
    ? `<${tag}${attrString}>${children}</${tag}>`
    : `<${tag}${attrString} />`
}

function transformAttribute(node: AttributeNode, _context: TransformContext): string {
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

function transformDirective(
  node: DirectiveNode,
  context: TransformContext,
  elementNode?: ElementNode,
): string | null {
  const { name, exp, arg } = node

  // v-bind 缩写 :
  if (name === 'bind') {
    if (!arg) {
      return null
    }
    const argValue = arg.type === NodeTypes.SIMPLE_EXPRESSION ? arg.content : ''
    if (!exp) {
      return null
    }
    const rawExpValue = exp.type === NodeTypes.SIMPLE_EXPRESSION ? exp.content : ''
    const expValue = normalizeWxmlExpression(rawExpValue)

    // 特殊处理 :key → wx:key（wx:key 不使用 {{ }}）
    if (argValue === 'key') {
      return `wx:key="${expValue}"`
    }

    return `${argValue}="{{${expValue}}}"`
  }

  // v-on 缩写 @
  if (name === 'on') {
    if (!arg) {
      return null
    }
    const argValue = arg.type === NodeTypes.SIMPLE_EXPRESSION ? arg.content : ''
    if (!exp) {
      return null
    }
    const rawExpValue = exp.type === NodeTypes.SIMPLE_EXPRESSION ? exp.content : ''
    const expValue = normalizeWxmlExpression(rawExpValue)

    // 映射常见事件（Vue 事件名 → 小程序事件名）
    const eventMap: Record<string, string> = {
      click: 'tap',
      dblclick: 'tap',
      mousedown: 'touchstart',
      mouseup: 'touchend',
      tap: 'tap',
      input: 'input',
      change: 'change',
      submit: 'submit',
      focus: 'focus',
      blur: 'blur',
      confirm: 'confirm',
      cancel: 'cancel',
      load: 'load',
      error: 'error',
      scroll: 'scroll',
      scrolltoupper: 'scrolltoupper',
      scrolltolower: 'scrolltolower',
      touchcancel: 'touchcancel',
      longtap: 'longtap',
      longpress: 'longpress',
    }
    const wxEvent = eventMap[argValue] || argValue
    return `bind${wxEvent}="${expValue}"`
  }

  // v-model
  if (name === 'model') {
    if (!exp) {
      return null
    }
    const rawExpValue = exp.type === NodeTypes.SIMPLE_EXPRESSION ? exp.content : ''
    const expValue = normalizeWxmlExpression(rawExpValue)

    // 根据元素类型生成不同的绑定
    return transformVModel(elementNode, expValue, context)
  }

  // v-show
  if (name === 'show') {
    if (!exp) {
      return null
    }
    const rawExpValue = exp.type === NodeTypes.SIMPLE_EXPRESSION ? exp.content : ''
    const expValue = normalizeWxmlExpression(rawExpValue)
    return `style="{{display: ${expValue} ? '' : 'none'}}"`
  }

  // v-html
  if (name === 'html') {
    context.warnings.push('v-html is not supported in mini-programs, use rich-text component instead')
    return null
  }

  // v-text
  if (name === 'text') {
    if (!exp) {
      return null
    }
    const rawExpValue = exp.type === NodeTypes.SIMPLE_EXPRESSION ? exp.content : ''
    const expValue = normalizeWxmlExpression(rawExpValue)
    return `>{{${expValue}}`
  }

  // v-cloak - Vue 的特殊指令，编译后移除，小程序中忽略
  if (name === 'cloak') {
    return null
  }

  // v-once - 只渲染一次，小程序中无对应特性，忽略并警告
  if (name === 'once') {
    context.warnings.push('v-once is not fully supported in mini-programs, the element will render normally')
    return null
  }

  // 自定义指令处理
  // 将自定义指令转换为 data-* 属性，供运行时处理
  return transformCustomDirective(name, exp, arg, context)
}

/**
 * 处理自定义指令
 * 将 v-custom-directive 转换为 data-v-custom-directive 属性
 * 支持带参数的自定义指令，如 v-custom-directive:arg
 */
function transformCustomDirective(
  name: string,
  exp: any,
  arg: any,
  context: TransformContext,
): string | null {
  // 内置指令列表（已处理过的）
  const builtInDirectives = new Set([
    'bind',
    'on',
    'model',
    'show',
    'html',
    'text',
    'if',
    'else-if',
    'else',
    'for',
    'slot',
    'cloak',
    'once',
    // Note: 'pre' (v-pre) is handled at parse time by Vue and doesn't reach here
  ])

  // 如果是内置指令，返回 null
  if (builtInDirectives.has(name)) {
    return null
  }

  // 转换为 data-v-* 属性
  const dataAttrName = `data-v-${name}`

  // 如果有表达式，将其作为属性值
  if (exp && exp.type === NodeTypes.SIMPLE_EXPRESSION) {
    const expValue = normalizeWxmlExpression(exp.content)
    // 对于简单值，直接使用；对于表达式，使用 {{ }} 包裹
    if (/^[a-z_$][\w$]*$/i.test(expValue)) {
      // 简单的变量引用
      return `${dataAttrName}="{{${expValue}}}"`
    }
    else {
      // 复杂表达式，需要保持原样
      return `${dataAttrName}="{{${expValue}}}"`
    }
  }

  // 如果有参数（如 v-color:red），将参数作为值
  if (arg && arg.type === NodeTypes.SIMPLE_EXPRESSION) {
    const argValue = arg.content
    return `${dataAttrName}="${argValue}"`
  }

  // 没有值和参数，仅作为标记属性
  context.warnings.push(
    `Custom directive v-${name} may require runtime support. Generated data attribute: ${dataAttrName}`,
  )
  return dataAttrName
}

function getElementType(element: ElementNode | undefined): string {
  if (!element) {
    return ''
  }

  for (const prop of element.props) {
    if (prop.type === NodeTypes.ATTRIBUTE && prop.name === 'type') {
      if (prop.value && prop.value.type === NodeTypes.TEXT) {
        return prop.value.content
      }
    }
  }
  return ''
}

function transformVModel(
  element: ElementNode | undefined,
  expValue: string,
  context: TransformContext,
): string | null {
  if (!element) {
    // 没有 element 信息时使用默认行为
    return `value="{{${expValue}}}" bind:input="${expValue} = $event.detail.value"`
  }

  const tag = element.tag
  const typeAttr = getElementType(element)

  // 根据不同的元素类型生成相应的绑定
  switch (tag) {
    case 'input': {
      // 根据 type 属性处理不同的 input
      switch (typeAttr) {
        case 'checkbox': {
          // checkbox 使用 checked + change 事件
          return `checked="{{${expValue}}}" bind:change="${expValue} = $event.detail.value.length > 0 ? $event.detail.value : $event.detail.value[0]"`
        }
        case 'radio': {
          // radio 使用 checked + change 事件
          return `checked="{{${expValue} === $event.detail.value}}" bind:change="${expValue} = $event.detail.value"`
        }
        default: {
          // 默认 text input 使用 value + input 事件
          return `value="{{${expValue}}}" bind:input="${expValue} = $event.detail.value"`
        }
      }
    }

    case 'textarea': {
      // textarea 使用 value + input 事件
      return `value="{{${expValue}}}" bind:input="${expValue} = $event.detail.value"`
    }

    case 'select': {
      // select 使用 value + change 事件
      return `value="{{${expValue}}}" bind:change="${expValue} = $event.detail.value"`
    }

    case 'switch':
    case 'checkbox': {
      // switch/checkbox 使用 checked + change 事件
      return `checked="{{${expValue}}}" bind:change="${expValue} = $event.detail.value"`
    }

    case 'slider': {
      // slider 使用 value + change 事件
      return `value="{{${expValue}}}" bind:change="${expValue} = $event.detail.value"`
    }

    case 'picker': {
      // picker 使用 value + change 事件
      return `value="{{${expValue}}}" bind:change="${expValue} = $event.detail.value"`
    }

    default: {
      // 默认行为，适用于自定义组件
      context.warnings.push(
        `v-model on <${tag}> may not work as expected. Using default binding.`,
      )
      return `value="{{${expValue}}}" bind:input="${expValue} = $event.detail.value"`
    }
  }
}

function transformSlotElement(node: ElementNode, context: TransformContext): string {
  // 获取 slot 的 name 属性
  let slotName = ''

  for (const prop of node.props) {
    if (prop.type === NodeTypes.ATTRIBUTE && prop.name === 'name') {
      if (prop.value && prop.value.type === NodeTypes.TEXT) {
        slotName = prop.value.content
        break
      }
    }
  }

  // WeChat 小程序的 slot 语法与 Vue 类似
  // 默认 slot 不需要 name 属性，具名 slot 需要 name 属性

  // 处理 fallback 内容（当没有传入 slot 内容时显示的默认内容）
  let fallbackContent = ''
  if (node.children.length > 0) {
    fallbackContent = node.children
      .map(child => transformNode(child, context))
      .join('')
  }

  // 构建属性字符串
  const attrs: string[] = []
  if (slotName) {
    attrs.push(`name="${slotName}"`)
  }

  const attrString = attrs.length ? ` ${attrs.join(' ')}` : ''

  // 如果有 fallback 内容，需要包裹它
  // WeChat 小程序的 slot 不直接支持 fallback，
  // 但我们可以使用 wx:if 来实现类似的效果
  if (fallbackContent) {
    // 注意：这里的实现简化了，实际需要配合运行时来判断 slot 是否有内容
    // 我们生成 slot 元素，fallback 内容会在运行时处理
    return `<slot${attrString}>${fallbackContent}</slot>`
  }

  // 没有 fallback 内容的自闭合 slot
  return `<slot${attrString} />`
}

/**
 * 处理动态组件 <component :is="currentComponent">
 * 在小程序中转换为条件渲染或使用 data-is 属性
 */
function transformComponentElement(node: ElementNode, context: TransformContext): string {
  // 查找 :is 或 v-bind:is 指令
  let isDirective: DirectiveNode | undefined
  for (const prop of node.props) {
    if (prop.type === NodeTypes.DIRECTIVE) {
      if ((prop.name === 'bind' && prop.arg?.type === NodeTypes.SIMPLE_EXPRESSION && prop.arg.content === 'is')) {
        isDirective = prop
        break
      }
    }
  }

  if (!isDirective || !isDirective.exp) {
    // 没有 :is 绑定，当作普通元素处理
    context.warnings.push('<component> without :is binding, treating as regular element')
    return transformNormalElement(node, context)
  }

  const componentVar = isDirective.exp.type === NodeTypes.SIMPLE_EXPRESSION ? isDirective.exp.content : ''

  // 微信小程序使用 data-is 属性来支持动态组件
  // 同时需要添加其他属性
  const otherProps = node.props.filter(prop => prop !== isDirective)
  const attrs: string[] = []

  for (const prop of otherProps) {
    if (prop.type === NodeTypes.ATTRIBUTE) {
      const attr = transformAttribute(prop, context)
      if (attr) {
        attrs.push(attr)
      }
    }
    else if (prop.type === NodeTypes.DIRECTIVE) {
      const dir = transformDirective(prop, context, node)
      if (dir) {
        attrs.push(dir)
      }
    }
  }

  // 处理子元素
  const children = node.children
    .map(child => transformNode(child, context))
    .join('')

  const attrString = attrs.length ? ` ${attrs.join(' ')}` : ''

  // 使用 data-is 属性
  context.warnings.push(
    'Dynamic components use data-is attribute which may require runtime support in mini-programs',
  )

  return `<component data-is="{{${componentVar}}}"${attrString}>${children}</component>`
}

/**
 * 处理过渡动画 <transition>
 * 小程序中使用 CSS 动画或 wxs 来实现过渡效果
 */
function transformTransitionElement(node: ElementNode, context: TransformContext): string {
  // transition 组件主要用于包裹需要过渡的元素
  // 在小程序中，我们移除外层 <transition>，只渲染子元素
  // 但添加特殊的 class 或 data 属性供运行时处理过渡

  context.warnings.push(
    '<transition> component: transitions require animation library or runtime support. Rendering children only.',
  )

  // 处理子元素
  const children = node.children
    .map(child => transformNode(child, context))
    .join('')

  // 如果只有一个子元素，直接返回它
  if (node.children.length === 1) {
    return children
  }

  // 多个子元素用 block 包裹
  return children || ''
}

/**
 * 处理 <keep-alive> 组件
 * 小程序中使用 data-keep-alive 属性标记
 */
function transformKeepAliveElement(node: ElementNode, context: TransformContext): string {
  context.warnings.push(
    '<keep-alive> component: requires runtime state management. Rendering children with marker.',
  )

  // 处理子元素
  const children = node.children
    .map(child => transformNode(child, context))
    .join('')

  // 添加 keep-alive 标记，供运行时处理
  return `<block data-keep-alive="true">${children}</block>`
}

function transformTemplateElement(node: ElementNode, context: TransformContext): string {
  // 检查是否有 v-slot 指令
  let slotDirective: DirectiveNode | undefined
  for (const prop of node.props) {
    if (prop.type === NodeTypes.DIRECTIVE && prop.name === 'slot') {
      slotDirective = prop as DirectiveNode
      break
    }
  }

  if (!slotDirective) {
    // 不是用于 slot 的 template，转换为 block
    context.warnings.push(
      '<template> element without v-slot is not supported in mini-programs, converting to <block>',
    )
    return transformNormalElement(node, context).replace(/<template/g, '<block').replace(/<\/template>/g, '</block>')
  }

  // 处理 v-slot 指令
  const slotName = slotDirective.arg
    ? (slotDirective.arg.type === NodeTypes.SIMPLE_EXPRESSION ? slotDirective.arg.content : '')
    : '' // 默认 slot

  // 处理作用域插槽的变量名
  const slotProps = slotDirective.exp
    ? (slotDirective.exp.type === NodeTypes.SIMPLE_EXPRESSION ? slotDirective.exp.content : '')
    : ''

  // WeChat 小程序使用 template 标签的 slot 属性来指定 slot 名称
  // 对于作用域插槽，小程序使用 data 属性

  // 转换 template 的子元素
  const children = node.children
    .map(child => transformNode(child, context))
    .join('')

  // 构建 WeChat 小程序的 template 语法
  const attrs: string[] = []

  if (slotName) {
    attrs.push(`slot="${slotName}"`)
  }
  else {
    attrs.push('slot=""') // 默认 slot
  }

  if (slotProps) {
    // 作用域插槽：使用 data 属性接收数据
    // WeChat 小程序的语法略有不同，需要在运行时处理
    context.warnings.push(
      `Scoped slots with v-slot="${slotProps}" require runtime support. Generated code may need adjustment.`,
    )
    attrs.push(`data="${slotProps}"`)
  }

  const attrString = attrs.length ? ` ${attrs.join(' ')}` : ''

  return `<template${attrString}>${children}</template>`
}

function parseForExpression(exp: string): string {
  // 解析 v-for 表达式
  // 支持: "item in list", "(item, index) in list", "(item, key, index) in list"

  // eslint-disable-next-line regexp/no-super-linear-backtracking
  const match = exp.match(/^\(([^,]+),\s*([^,]+),\s*([^)]+)\)\s+in\s+(.+)$/)
  if (match) {
    const [, item, _key, index, list] = match
    return `wx:for="{{${list}}}" wx:for-item="${item}" wx:for-index="${index}"`
  }

  // eslint-disable-next-line regexp/no-super-linear-backtracking
  const match2 = exp.match(/^\(([^,]+),\s*([^)]+)\)\s+in\s+(.+)$/)
  if (match2) {
    const [, item, index, list] = match2
    return `wx:for="{{${list}}}" wx:for-item="${item}" wx:for-index="${index}"`
  }

  // eslint-disable-next-line regexp/no-super-linear-backtracking
  const match3 = exp.match(/^(\w+)\s+in\s+(.+)$/)
  if (match3) {
    const [, item, list] = match3
    return `wx:for="{{${list}}}" wx:for-item="${item}"`
  }

  // 如果无法解析，返回空
  return ''
}

function transformNode(node: any, context: TransformContext): string {
  switch (node.type) {
    case NodeTypes.ELEMENT:
      return transformElement(node, context)

    case NodeTypes.TEXT:
      return transformText(node, context)

    case NodeTypes.INTERPOLATION:
      return transformInterpolation(node, context)

    case NodeTypes.COMMENT:
      // 注释默认移除
      return ''

    default:
      // 未知节点类型，返回空字符串
      return ''
  }
}

function transformText(node: TextNode, _context: TransformContext): string {
  return node.content
}

function transformInterpolation(node: any, _context: TransformContext): string {
  const { content } = node
  if (content.type === NodeTypes.SIMPLE_EXPRESSION) {
    const expValue = normalizeWxmlExpression(content.content)
    return `{{${expValue}}}`
  }
  return '{{}}'
}

function transformIfElement(node: ElementNode, context: TransformContext): string {
  // 查找所有兄弟元素中的 v-if/v-else-if/v-else 指令
  // 这里简化处理，只处理当前元素
  const ifDirective = node.props.find(
    (prop): prop is DirectiveNode =>
      prop.type === NodeTypes.DIRECTIVE
      && (prop.name === 'if' || prop.name === 'else-if' || prop.name === 'else'),
  )

  if (!ifDirective) {
    return transformNormalElement(node, context)
  }

  // 移除 v-if 指令后转换元素
  const otherProps = node.props.filter(prop => prop !== ifDirective)
  const elementWithoutIf = { ...node, props: otherProps }

  // 转换内容
  const content = transformNormalElement(elementWithoutIf as ElementNode, context)

  // 生成 block 包裹
  const dir = ifDirective as DirectiveNode
  if (dir.name === 'if' && dir.exp) {
    const rawExpValue = dir.exp.type === NodeTypes.SIMPLE_EXPRESSION ? dir.exp.content : ''
    const expValue = normalizeWxmlExpression(rawExpValue)
    return `<block wx:if="{{${expValue}}}">${content}</block>`
  }
  else if (dir.name === 'else-if' && dir.exp) {
    const rawExpValue = dir.exp.type === NodeTypes.SIMPLE_EXPRESSION ? dir.exp.content : ''
    const expValue = normalizeWxmlExpression(rawExpValue)
    return `<block wx:elif="{{${expValue}}}">${content}</block>`
  }
  else if (dir.name === 'else') {
    return `<block wx:else>${content}</block>`
  }

  return content
}

function transformForElement(node: ElementNode, context: TransformContext): string {
  // 查找 v-for 指令
  const forDirective = node.props.find(
    (prop): prop is DirectiveNode =>
      prop.type === NodeTypes.DIRECTIVE && prop.name === 'for',
  ) as DirectiveNode | undefined

  if (!forDirective || !forDirective.exp) {
    return transformNormalElement(node, context)
  }

  const expValue = forDirective.exp.type === NodeTypes.SIMPLE_EXPRESSION ? forDirective.exp.content : ''
  const forAttrs = parseForExpression(expValue)

  // 移除 v-for 指令后，转换其他属性
  const otherProps = node.props.filter(prop => prop !== forDirective)

  // 收集其他属性（如 :key, :class, @click 等）
  const attrs: string[] = [forAttrs]

  for (const prop of otherProps) {
    if (prop.type === NodeTypes.ATTRIBUTE) {
      const attr = transformAttribute(prop, context)
      if (attr) {
        attrs.push(attr)
      }
    }
    else if (prop.type === NodeTypes.DIRECTIVE) {
      const dir = transformDirective(prop, context, node)
      if (dir) {
        attrs.push(dir)
      }
    }
  }

  // 处理子元素
  const children = node.children
    .map(child => transformNode(child, context))
    .join('')

  // 生成元素标签
  const { tag } = node
  const attrString = attrs.length ? ` ${attrs.join(' ')}` : ''

  return children
    ? `<${tag}${attrString}>${children}</${tag}>`
    : `<${tag}${attrString} />`
}

export function compileVueTemplateToWxml(
  template: string,
  filename: string,
): TemplateCompileResult {
  const warnings: string[] = []

  try {
    // 使用 Vue compiler-core 解析模板
    const ast = parse(template, {
      onError: (error) => {
        warnings.push(`Template parse error: ${error.message}`)
      },
    })

    const context: TransformContext = {
      source: template,
      filename,
      warnings,
    }

    // 转换 AST 到 WXML
    const wxml = ast.children
      .map(child => transformNode(child, context))
      .join('')

    return {
      code: wxml,
      warnings,
    }
  }
  catch (error) {
    warnings.push(`Failed to compile template: ${error}`)
    return {
      code: template,
      warnings,
    }
  }
}
