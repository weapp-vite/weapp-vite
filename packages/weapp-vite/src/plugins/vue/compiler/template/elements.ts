import type {
  DirectiveNode,
  ElementNode,
} from '@vue/compiler-core'
import type { ForParseResult, TransformContext, TransformNode } from './types'
import { NodeTypes } from '@vue/compiler-core'
import { renderClassAttribute, renderStyleAttribute, transformAttribute } from './attributes'
import { transformDirective } from './directives'
import { normalizeClassBindingExpression, normalizeWxmlExpression } from './expression'

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

export function transformElement(node: ElementNode, context: TransformContext, transformNode: TransformNode): string {
  const { tag } = node

  // 检查是否是 template 元素（用于 slot 内容）
  if (tag === 'template') {
    return transformTemplateElement(node, context, transformNode)
  }

  // 检查是否是 slot 元素
  if (tag === 'slot') {
    return transformSlotElement(node, context, transformNode)
  }

  // 检查是否是 component 元素（动态组件）
  if (tag === 'component') {
    return transformComponentElement(node, context, transformNode)
  }

  // 检查是否是 transition 元素
  if (tag === 'transition') {
    return transformTransitionElement(node, context, transformNode)
  }

  // 检查是否是 keep-alive 元素
  if (tag === 'keep-alive') {
    return transformKeepAliveElement(node, context, transformNode)
  }

  // 检查是否有结构指令
  const { type } = isStructuralDirective(node)

  if (type === 'if') {
    return transformIfElement(node, context, transformNode)
  }

  if (type === 'for') {
    return transformForElement(node, context, transformNode)
  }

  // 普通元素
  return transformNormalElement(node, context, transformNode)
}

function transformNormalElement(node: ElementNode, context: TransformContext, transformNode: TransformNode): string {
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
    const normalizedDynamicStyleExp = dynamicStyleExp
      ? normalizeWxmlExpression(dynamicStyleExp)
      : undefined
    attrs.unshift(renderStyleAttribute(staticStyle, normalizedDynamicStyleExp, vShowExp))
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

function transformSlotElement(node: ElementNode, context: TransformContext, transformNode: TransformNode): string {
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

function transformComponentElement(node: ElementNode, context: TransformContext, transformNode: TransformNode): string {
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
    return transformNormalElement(node, context, transformNode)
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

function transformTransitionElement(node: ElementNode, context: TransformContext, transformNode: TransformNode): string {
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

function transformKeepAliveElement(node: ElementNode, context: TransformContext, transformNode: TransformNode): string {
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

function transformTemplateElement(node: ElementNode, context: TransformContext, transformNode: TransformNode): string {
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
      return transformForElement({ ...node, tag: 'block' } as ElementNode, context, transformNode)
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
      return transformIfElement(fakeNode, context, transformNode)
    }
    if (hasOtherDirective) {
      // 条件/循环等结构指令：用 block 保留语义
      return transformNormalElement(node, context, transformNode).replace(/<template/g, '<block').replace(/<\/template>/g, '</block>')
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

function transformIfElement(node: ElementNode, context: TransformContext, transformNode: TransformNode): string {
  // 查找所有兄弟元素中的 v-if/v-else-if/v-else 指令
  // 这里简化处理，只处理当前元素
  const ifDirective = node.props.find(
    (prop): prop is DirectiveNode =>
      prop.type === NodeTypes.DIRECTIVE
      && (prop.name === 'if' || prop.name === 'else-if' || prop.name === 'else'),
  )

  if (!ifDirective) {
    /* istanbul ignore next */
    return transformNormalElement(node, context, transformNode)
  }

  // 移除 v-if 指令后转换元素
  const otherProps = node.props.filter(prop => prop !== ifDirective)
  const elementWithoutIf = { ...node, props: otherProps }

  // 转换内容
  const content = transformNormalElement(elementWithoutIf as ElementNode, context, transformNode)

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

function transformForElement(node: ElementNode, context: TransformContext, transformNode: TransformNode): string {
  // 查找 v-for 指令
  const forDirective = node.props.find(
    (prop): prop is DirectiveNode =>
      prop.type === NodeTypes.DIRECTIVE && prop.name === 'for',
  ) as DirectiveNode | undefined

  if (!forDirective || !forDirective.exp) {
    return transformNormalElement(node, context, transformNode)
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
