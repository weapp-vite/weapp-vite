import type {
  DirectiveNode,
  ElementNode,
} from '@vue/compiler-core'
import type { ForParseResult, TransformContext } from './types'
import { NodeTypes } from '@vue/compiler-core'
import { normalizeWxmlExpression, parseInlineHandler } from './expression'

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
  const escapedModel = expValue.replace(/"/g, '&quot;')
  const bindModel = (event: string) => {
    const bindAttr = event.includes(':') ? `bind:${event}` : `bind${event}`
    return `${bindAttr}="__weapp_vite_model" data-wv-model="${escapedModel}"`
  }

  if (!element) {
    // 没有 element 信息时使用默认行为
    return `value="{{${expValue}}}" ${bindModel('input')}`
  }

  const tag = element.tag
  const typeAttr = getElementType(element)

  // 根据不同的元素类型生成相应的绑定
  switch (tag) {
    case 'input': {
      // 根据 type 属性处理不同的 input
      switch (typeAttr) {
        case 'checkbox': {
          // 兼容：checkbox 使用 checked + change 事件（值解析交给运行时）
          return `checked="{{${expValue}}}" ${bindModel('change')}`
        }
        case 'radio': {
          // 兼容：radio 使用 value + change 事件（值解析交给运行时）
          return `value="{{${expValue}}}" ${bindModel('change')}`
        }
        default: {
          // 默认 text input 使用 value + input 事件
          return `value="{{${expValue}}}" ${bindModel('input')}`
        }
      }
    }

    case 'textarea': {
      // 组件：textarea 使用 value + input 事件
      return `value="{{${expValue}}}" ${bindModel('input')}`
    }

    case 'select': {
      // 组件：select 使用 value + change 事件
      return `value="{{${expValue}}}" ${bindModel('change')}`
    }

    case 'switch':
    case 'checkbox': {
      // 组件：switch/checkbox 使用 checked + change 事件
      return `checked="{{${expValue}}}" ${bindModel('change')}`
    }

    case 'slider': {
      // 组件：slider 使用 value + change 事件
      return `value="{{${expValue}}}" ${bindModel('change')}`
    }

    case 'picker': {
      // 组件：picker 使用 value + change 事件
      return `value="{{${expValue}}}" ${bindModel('change')}`
    }

    default: {
      // 默认行为，适用于自定义组件
      context.warnings.push(
        `v-model on <${tag}> may not work as expected. Using default binding.`,
      )
      return `value="{{${expValue}}}" ${bindModel('input')}`
    }
  }
}

export function transformDirective(
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
