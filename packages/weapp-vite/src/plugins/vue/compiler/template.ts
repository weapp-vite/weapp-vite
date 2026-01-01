import type {
  AttributeNode,
  DirectiveNode,
  ElementNode,
  TextNode,
} from '@vue/compiler-core'
import generateModule from '@babel/generator'
import { parse as babelParse } from '@babel/parser'
import * as t from '@babel/types'
import {
  NodeTypes,
  baseParse as parse,
} from '@vue/compiler-core'
import { LRUCache } from 'lru-cache'

// 兼容：在 ESM 构建下归一化 CJS default 导出形态
const generate: typeof generateModule = (generateModule as any).default ?? generateModule

// 说明：`lru-cache@11` 的值类型要求非空（`V extends {}`），这里用 `false` 作为“缓存未命中”的哨兵值。
const babelExpressionCache = new LRUCache<string, t.Expression | false>({ max: 1024 })
const inlineHandlerCache = new LRUCache<string, { name: string, args: any[] } | false>({ max: 1024 })

export interface TemplateCompileResult {
  code: string
  warnings: string[]
}

interface TransformContext {
  source: string
  filename: string
  warnings: string[]
}

interface ForParseResult {
  attrs: string[]
  item?: string
  index?: string
  key?: string
}

function generateExpression(node: t.Expression): string {
  const { code } = generate(node, {
    compact: true,
    jsescOption: { quotes: 'single' },
  })
  return code
}

function parseBabelExpression(exp: string): t.Expression | null {
  const cached = babelExpressionCache.get(exp)
  if (cached !== undefined) {
    return cached === false ? null : cached
  }
  try {
    const ast = babelParse(`(${exp})`, {
      sourceType: 'module',
      plugins: ['typescript'],
    })
    const stmt = ast.program.body[0]
    if (!stmt || !('expression' in stmt)) {
      babelExpressionCache.set(exp, false)
      return null
    }
    const expression = (stmt as any).expression as t.Expression
    babelExpressionCache.set(exp, expression)
    return expression
  }
  catch {
    babelExpressionCache.set(exp, false)
    return null
  }
}

function normalizeClassBindingExpression(exp: string, context: TransformContext): string[] {
  const ast = parseBabelExpression(exp)
  if (!ast) {
    return [normalizeWxmlExpression(exp)]
  }

  const out: string[] = []

  const pushExpr = (node: t.Expression) => {
    out.push(normalizeWxmlExpression(generateExpression(node)))
  }

  const visit = (node: t.Expression | null | undefined) => {
    if (!node) {
      return
    }
    if (t.isArrayExpression(node)) {
      for (const el of node.elements) {
        if (!el) {
          continue
        }
        if (t.isSpreadElement(el)) {
          context.warnings.push('Spread syntax in :class is not supported in mini-programs, ignoring it')
          continue
        }
        if (t.isExpression(el)) {
          visit(el)
        }
      }
      return
    }
    if (t.isObjectExpression(node)) {
      for (const prop of node.properties) {
        if (t.isSpreadElement(prop)) {
          context.warnings.push('Spread syntax in :class object is not supported in mini-programs, ignoring it')
          continue
        }
        if (!t.isObjectProperty(prop)) {
          continue
        }
        const value = prop.value
        if (!t.isExpression(value)) {
          continue
        }
        const test = value
        if (prop.computed) {
          const keyExpr = prop.key
          if (!t.isExpression(keyExpr)) {
            continue
          }
          pushExpr(t.conditionalExpression(test, keyExpr, t.stringLiteral('')))
        }
        else if (t.isIdentifier(prop.key)) {
          pushExpr(t.conditionalExpression(test, t.stringLiteral(prop.key.name), t.stringLiteral('')))
        }
        else if (t.isStringLiteral(prop.key)) {
          pushExpr(t.conditionalExpression(test, t.stringLiteral(prop.key.value), t.stringLiteral('')))
        }
      }
      return
    }

    pushExpr(node)
  }

  visit(ast)

  if (!out.length) {
    return [normalizeWxmlExpression(exp)]
  }
  return out
}

function renderClassAttribute(staticClass: string | undefined, classExpressions: string[] | undefined): string {
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

function renderStyleAttribute(
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
    const expValue = normalizeWxmlExpression(dynamicStyleExp)
    merged += `{{${expValue}}}`
  }

  if (vShowExp) {
    const hiddenStyle = merged ? ';display: none' : 'display: none'
    merged += `{{${vShowExp} ? '' : '${hiddenStyle}'}}`
  }

  return `style="${merged}"`
}

function parseInlineHandler(exp: string): { name: string, args: any[] } | null {
  const cached = inlineHandlerCache.get(exp)
  if (cached !== undefined) {
    return cached === false ? null : cached
  }
  try {
    const ast = babelParse(`(${exp})`, {
      sourceType: 'module',
      plugins: ['typescript'],
    })
    const stmt = ast.program.body[0]
    if (!stmt || !('expression' in stmt)) {
      return null
    }
    const expression = (stmt as any).expression
    if (!t.isCallExpression(expression) || !t.isIdentifier(expression.callee)) {
      return null
    }
    const name = expression.callee.name
    const args: any[] = []
    for (const arg of expression.arguments) {
      if (t.isIdentifier(arg) && arg.name === '$event') {
        args.push('$event')
      }
      else if (t.isStringLiteral(arg) || t.isNumericLiteral(arg) || t.isBooleanLiteral(arg)) {
        args.push(arg.value)
      }
      else if (t.isNullLiteral(arg)) {
        args.push(null)
      }
      else {
        inlineHandlerCache.set(exp, false)
        return null
      }
    }
    const out = { name, args }
    inlineHandlerCache.set(exp, out)
    return out
  }
  catch {
    inlineHandlerCache.set(exp, false)
    return null
  }
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
    // 回退：简单把模板字符串改写为字符串拼接
    if (exp.startsWith('`') && exp.endsWith('`')) {
      const inner = exp.slice(1, -1)
      let rewritten = `'${inner.replace(/\$\{([^}]+)\}/g, '\' + ($1) + \'')}'`
      // 移除边界处冗余的 `+ ''`
      rewritten = rewritten.replace(/'\s*\+\s*''/g, '\'').replace(/''\s*\+\s*'/g, '\'')
      rewritten = rewritten.replace(/^\s*''\s*\+\s*/g, '').replace(/\s*\+\s*''\s*$/g, '')
      return rewritten
    }

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
  let staticClass: string | undefined
  let dynamicClassExp: string | undefined
  let staticStyle: string | undefined
  let dynamicStyleExp: string | undefined
  let vShowExp: string | undefined
  let vTextExp: string | undefined

  for (const prop of props) {
    if (prop.type === NodeTypes.ATTRIBUTE) {
      if (prop.name === 'class' && prop.value?.type === NodeTypes.TEXT) {
        staticClass = prop.value.content
        continue
      }
      if (prop.name === 'style' && prop.value?.type === NodeTypes.TEXT) {
        staticStyle = prop.value.content
        continue
      }
      // 普通属性
      const attr = transformAttribute(prop, context)
      if (attr) {
        attrs.push(attr)
      }
    }
    else if (prop.type === NodeTypes.DIRECTIVE) {
      if (
        prop.name === 'bind'
        && prop.arg?.type === NodeTypes.SIMPLE_EXPRESSION
        && prop.arg.content === 'class'
        && prop.exp?.type === NodeTypes.SIMPLE_EXPRESSION
      ) {
        dynamicClassExp = prop.exp.content
        continue
      }
      if (
        prop.name === 'bind'
        && prop.arg?.type === NodeTypes.SIMPLE_EXPRESSION
        && prop.arg.content === 'style'
        && prop.exp?.type === NodeTypes.SIMPLE_EXPRESSION
      ) {
        dynamicStyleExp = prop.exp.content
        continue
      }
      if (prop.name === 'show' && prop.exp?.type === NodeTypes.SIMPLE_EXPRESSION) {
        vShowExp = normalizeWxmlExpression(prop.exp.content)
        continue
      }
      if (prop.name === 'text' && prop.exp?.type === NodeTypes.SIMPLE_EXPRESSION) {
        vTextExp = normalizeWxmlExpression(prop.exp.content)
        continue
      }
      // 指令
      const dir = transformDirective(prop, context, node)
      if (dir) {
        attrs.push(dir)
      }
    }
  }

  if (staticClass || dynamicClassExp) {
    const expressions = dynamicClassExp
      ? normalizeClassBindingExpression(dynamicClassExp, context)
      : undefined
    attrs.unshift(renderClassAttribute(staticClass, expressions))
  }
  if (staticStyle || dynamicStyleExp || vShowExp) {
    attrs.unshift(renderStyleAttribute(staticStyle, dynamicStyleExp, vShowExp))
  }

  // 处理子元素
  let children = ''
  if (node.children.length > 0) {
    children = node.children
      .map(child => transformNode(child, context))
      .join('')
  }
  if (vTextExp !== undefined) {
    children = `{{${vTextExp}}}`
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
  forInfo?: ForParseResult,
): string | null {
  const { name, exp, arg } = node

  const isSimpleHandler = (value: string) => /^[A-Z_$][\w$]*$/i.test(value)

  // 指令：v-bind（缩写 :）
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
      const trimmed = expValue.trim()
      // 指令：v-for 使用 item 作为 key 时，映射为 "*this" 以匹配小程序语义
      if (forInfo?.item && trimmed === forInfo.item) {
        return 'wx:key="*this"'
      }
      if (forInfo?.key && trimmed === forInfo.key) {
        return 'wx:key="*this"'
      }
      if (forInfo?.item && trimmed.startsWith(`${forInfo.item}.`)) {
        const remainder = trimmed.slice(forInfo.item.length + 1)
        const firstSegment = remainder.split('.')[0] || remainder
        return `wx:key="${firstSegment}"`
      }
      return `wx:key="${expValue}"`
    }

    return `${argValue}="{{${expValue}}}"`
  }

  // 指令：v-on（缩写 @）
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
    const isInlineExpression = rawExpValue && !isSimpleHandler(rawExpValue)
    const inlineHandler = isInlineExpression ? parseInlineHandler(rawExpValue) : null

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
    const bindAttr = wxEvent.includes(':') ? `bind:${wxEvent}` : `bind${wxEvent}`
    if (inlineHandler) {
      const argsJson = JSON.stringify(inlineHandler.args)
      const escapedArgs = argsJson.replace(/"/g, '&quot;')
      return [
        `data-wv-handler="${inlineHandler.name}"`,
        `data-wv-args="${escapedArgs}"`,
        `${bindAttr}="__weapp_vite_inline"`,
      ].join(' ')
    }
    if (isInlineExpression) {
      const escaped = rawExpValue.replace(/"/g, '&quot;')
      return `data-wv-inline="${escaped}" ${bindAttr}="__weapp_vite_inline"`
    }
    return `${bindAttr}="${expValue}"`
  }

  // 指令：v-model
  if (name === 'model') {
    if (!exp) {
      return null
    }
    const rawExpValue = exp.type === NodeTypes.SIMPLE_EXPRESSION ? exp.content : ''
    const expValue = normalizeWxmlExpression(rawExpValue)

    // 根据元素类型生成不同的绑定
    return transformVModel(elementNode, expValue, context)
  }

  // 指令：v-show
  if (name === 'show') {
    if (!exp) {
      return null
    }
    const rawExpValue = exp.type === NodeTypes.SIMPLE_EXPRESSION ? exp.content : ''
    const expValue = normalizeWxmlExpression(rawExpValue)
    // 说明：WXML 表达式不支持对象字面量（`display: ...`），用条件输出完整 style 字符串
    return `style="{{${expValue} ? '' : 'display: none'}}"`
  }

  // 指令：v-html
  if (name === 'html') {
    context.warnings.push('v-html is not supported in mini-programs, use rich-text component instead')
    return null
  }

  // 指令：v-cloak（Vue 的特殊指令，编译后移除，小程序中忽略）
  if (name === 'cloak') {
    return null
  }

  // 指令：v-once（只渲染一次，小程序中无对应特性，忽略并警告）
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
    // 说明：`pre`（v-pre）在 Vue parse 阶段已处理，这里不会再收到
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
          // 组件：checkbox 使用 checked + change 事件
          return `checked="{{${expValue}}}" bind:change="${expValue} = $event.detail.value.length > 0 ? $event.detail.value : $event.detail.value[0]"`
        }
        case 'radio': {
          // 组件：radio 使用 checked + change 事件
          return `checked="{{${expValue} === $event.detail.value}}" bind:change="${expValue} = $event.detail.value"`
        }
        default: {
          // 默认 text input 使用 value + input 事件
          return `value="{{${expValue}}}" bind:input="${expValue} = $event.detail.value"`
        }
      }
    }

    case 'textarea': {
      // 组件：textarea 使用 value + input 事件
      return `value="{{${expValue}}}" bind:input="${expValue} = $event.detail.value"`
    }

    case 'select': {
      // 组件：select 使用 value + change 事件
      return `value="{{${expValue}}}" bind:change="${expValue} = $event.detail.value"`
    }

    case 'switch':
    case 'checkbox': {
      // 组件：switch/checkbox 使用 checked + change 事件
      return `checked="{{${expValue}}}" bind:change="${expValue} = $event.detail.value"`
    }

    case 'slider': {
      // 组件：slider 使用 value + change 事件
      return `value="{{${expValue}}}" bind:change="${expValue} = $event.detail.value"`
    }

    case 'picker': {
      // 组件：picker 使用 value + change 事件
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

  // 微信小程序的 slot 语法与 Vue 类似
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
  // 微信小程序的 slot 不直接支持 fallback，
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
  // 组件：transition 主要用于包裹需要过渡的元素
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
  let nameAttr = ''
  let isAttr = ''
  let dataAttr = ''
  let hasOtherDirective = false
  let structuralDirective: DirectiveNode | undefined

  for (const prop of node.props) {
    if (prop.type === NodeTypes.DIRECTIVE && prop.name === 'slot') {
      slotDirective = prop as DirectiveNode
      break
    }
    if (prop.type === NodeTypes.DIRECTIVE) {
      hasOtherDirective = true
      if (!structuralDirective && (prop.name === 'if' || prop.name === 'else-if' || prop.name === 'else' || prop.name === 'for')) {
        structuralDirective = prop
      }
    }
    if (prop.type === NodeTypes.ATTRIBUTE && prop.name === 'name') {
      nameAttr = prop.value && prop.value.type === NodeTypes.TEXT ? prop.value.content : ''
    }
    if (prop.type === NodeTypes.ATTRIBUTE && prop.name === 'is') {
      isAttr = prop.value && prop.value.type === NodeTypes.TEXT ? prop.value.content : ''
    }
    if (prop.type === NodeTypes.ATTRIBUTE && prop.name === 'data') {
      dataAttr = prop.value && prop.value.type === NodeTypes.TEXT ? prop.value.content : ''
    }
  }

  // 转换 template 的子元素
  const children = node.children
    .map(child => transformNode(child, context))
    .join('')

  // 无 slot 且无语义属性时，根据是否包含指令决定如何降级
  if (!slotDirective && !nameAttr && !isAttr && !dataAttr) {
    if (structuralDirective?.name === 'for') {
      // 结构指令 v-for：使用 block 承载 wx:for
      return transformForElement({ ...node, tag: 'block' } as ElementNode, context)
    }
    if (structuralDirective && (structuralDirective.name === 'if' || structuralDirective.name === 'else-if' || structuralDirective.name === 'else')) {
      // 条件指令：使用 block 承载 wx:if / wx:elif / wx:else
      const dir = structuralDirective
      const base = node.props.filter(prop => prop !== dir)
      const fakeNode: ElementNode = { ...node, tag: 'block', props: base }
      if (dir.name === 'if' && dir.exp) {
        const rawExpValue = dir.exp.type === NodeTypes.SIMPLE_EXPRESSION ? dir.exp.content : ''
        const expValue = normalizeWxmlExpression(rawExpValue)
        return `<block wx:if="{{${expValue}}}">${children}</block>`
      }
      if (dir.name === 'else-if' && dir.exp) {
        const rawExpValue = dir.exp.type === NodeTypes.SIMPLE_EXPRESSION ? dir.exp.content : ''
        const expValue = normalizeWxmlExpression(rawExpValue)
        return `<block wx:elif="{{${expValue}}}">${children}</block>`
      }
      if (dir.name === 'else') {
        return `<block wx:else>${children}</block>`
      }
      // 回退：使用通用转换
      return transformIfElement(fakeNode, context)
    }
    if (hasOtherDirective) {
      // 条件/循环等结构指令：用 block 保留语义
      return transformNormalElement(node, context).replace(/<template/g, '<block').replace(/<\/template>/g, '</block>')
    }
    // 纯占位：直接展开子节点
    return children
  }

  // 构建属性
  const attrs: string[] = []
  if (nameAttr) {
    attrs.push(`name="${nameAttr}"`)
  }
  if (isAttr) {
    attrs.push(`is="${isAttr}"`)
  }
  if (dataAttr) {
    attrs.push(`data="${dataAttr}"`)
  }

  if (slotDirective) {
    // 处理 v-slot 指令
    const slotName = slotDirective.arg
      ? (slotDirective.arg.type === NodeTypes.SIMPLE_EXPRESSION ? slotDirective.arg.content : '')
      : '' // 默认 slot

    // 处理作用域插槽的变量名
    const slotProps = slotDirective.exp
      ? (slotDirective.exp.type === NodeTypes.SIMPLE_EXPRESSION ? slotDirective.exp.content : '')
      : ''

    // 微信小程序使用 template 标签的 slot 属性来指定 slot 名称
    // 对于作用域插槽，小程序使用 data 属性

    if (slotName) {
      attrs.push(`slot="${slotName}"`)
    }
    else {
      attrs.push('slot=""') // 默认 slot
    }

    if (slotProps) {
      // 作用域插槽：使用 data 属性接收数据
      context.warnings.push(
        `Scoped slots with v-slot="${slotProps}" require runtime support. Generated code may need adjustment.`,
      )
      attrs.push(`data="${slotProps}"`)
    }
  }

  // 无语义属性的 template 仅作为占位，直接移除包装
  if (!slotDirective && !nameAttr && !isAttr && !dataAttr) {
    return children
  }

  const attrString = attrs.length ? ` ${attrs.join(' ')}` : ''

  const tagName = slotDirective ? 'block' : 'template'

  return `<${tagName}${attrString}>${children}</${tagName}>`
}

function parseForExpression(exp: string): ForParseResult {
  // 解析 v-for 表达式
  // 支持: "item in list", "(item, index) in list", "(item, key, index) in list"

  // eslint-disable-next-line regexp/no-super-linear-backtracking -- 这里的正则来自模板转换逻辑，保持原样避免误伤
  const match = exp.match(/^\(([^,]+),\s*([^,]+),\s*([^)]+)\)\s+in\s+(.+)$/)
  if (match) {
    const [, item, _key, index, list] = match
    return {
      attrs: [`wx:for="{{${list}}}"`, `wx:for-item="${item}"`, `wx:for-index="${index}"`],
      item,
      index,
      key: _key,
    }
  }

  // eslint-disable-next-line regexp/no-super-linear-backtracking -- 这里的正则来自模板转换逻辑，保持原样避免误伤
  const match2 = exp.match(/^\(([^,]+),\s*([^)]+)\)\s+in\s+(.+)$/)
  if (match2) {
    const [, item, index, list] = match2
    return {
      attrs: [`wx:for="{{${list}}}"`, `wx:for-item="${item}"`, `wx:for-index="${index}"`],
      item,
      index,
    }
  }

  // eslint-disable-next-line regexp/no-super-linear-backtracking -- 这里的正则来自模板转换逻辑，保持原样避免误伤
  const match3 = exp.match(/^(\w+)\s+in\s+(.+)$/)
  if (match3) {
    const [, item, list] = match3
    return {
      attrs: [`wx:for="{{${list}}}"`, `wx:for-item="${item}"`],
      item,
    }
  }

  // 如果无法解析，返回空
  return {
    attrs: [],
  }
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
      /* istanbul ignore next */
      return ''
  }
}

function escapeWxmlText(value: string) {
  if (!value) {
    return ''
  }
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function transformText(node: TextNode, _context: TransformContext): string {
  return escapeWxmlText(node.content)
}

function transformInterpolation(node: any, _context: TransformContext): string {
  const { content } = node
  if (content.type === NodeTypes.SIMPLE_EXPRESSION) {
    const expValue = normalizeWxmlExpression(content.content)
    return `{{${expValue}}}`
  }
  /* istanbul ignore next */
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
    /* istanbul ignore next */
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
  const forInfo = parseForExpression(expValue)

  // 移除 v-for 指令后，转换其他属性
  const otherProps = node.props.filter(prop => prop !== forDirective)

  // 收集其他属性（如 :key, :class, @click 等）
  const attrs: string[] = [...forInfo.attrs]

  for (const prop of otherProps) {
    if (prop.type === NodeTypes.ATTRIBUTE) {
      const attr = transformAttribute(prop, context)
      if (attr) {
        attrs.push(attr)
      }
    }
    else if (prop.type === NodeTypes.DIRECTIVE) {
      const dir = transformDirective(prop, context, node, forInfo)
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
