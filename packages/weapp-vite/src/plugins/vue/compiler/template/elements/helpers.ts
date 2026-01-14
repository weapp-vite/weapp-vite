import type { DirectiveNode, ElementNode } from '@vue/compiler-core'
import type { ForParseResult, TransformContext } from '../types'
import { NodeTypes } from '@vue/compiler-core'

export function isStructuralDirective(node: ElementNode): {
  type: 'if' | 'for' | null
  directive: DirectiveNode | undefined
} {
  // 检查 v-if、v-else-if、v-else、v-for
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

export function pushScope(context: TransformContext, names: string[]) {
  if (!names.length) {
    return
  }
  context.scopeStack.push(new Set(names))
}

export function popScope(context: TransformContext) {
  if (context.scopeStack.length) {
    context.scopeStack.pop()
  }
}

export function pushForScope(context: TransformContext, info: ForParseResult) {
  if (!info.listExp) {
    return
  }
  context.forStack.push({ ...info })
}

export function popForScope(context: TransformContext) {
  if (context.forStack.length) {
    context.forStack.pop()
  }
}

export function withForScope<T>(context: TransformContext, info: ForParseResult, fn: () => T): T {
  pushForScope(context, info)
  try {
    return fn()
  }
  finally {
    popForScope(context)
  }
}

export function pushSlotProps(context: TransformContext, mapping: Record<string, string>) {
  if (!Object.keys(mapping).length) {
    return
  }
  context.slotPropStack.push(mapping)
}

export function popSlotProps(context: TransformContext) {
  if (context.slotPropStack.length) {
    context.slotPropStack.pop()
  }
}

export function withScope<T>(context: TransformContext, names: string[], fn: () => T): T {
  pushScope(context, names)
  try {
    return fn()
  }
  finally {
    popScope(context)
  }
}

export function withSlotProps<T>(context: TransformContext, mapping: Record<string, string>, fn: () => T): T {
  pushSlotProps(context, mapping)
  try {
    return fn()
  }
  finally {
    popSlotProps(context)
  }
}

export function collectScopePropMapping(context: TransformContext): Record<string, string> {
  const mapping: Record<string, string> = {}
  if (!context.slotMultipleInstance) {
    return mapping
  }
  for (const scope of context.scopeStack) {
    for (const name of scope) {
      if (!/^[A-Z_$][\w$]*$/i.test(name)) {
        continue
      }
      if (!Object.prototype.hasOwnProperty.call(mapping, name)) {
        mapping[name] = name
      }
    }
  }
  return mapping
}

export function buildScopePropsExpression(context: TransformContext): string | null {
  const mapping = collectScopePropMapping(context)
  const keys = Object.keys(mapping)
  if (!keys.length) {
    return null
  }
  return `[${keys.map(key => `${toWxmlStringLiteral(key)},${key}`).join(',')}]`
}

export function toWxmlStringLiteral(value: string) {
  const escaped = value
    .replace(/\\/g, '\\\\')
    .replace(/'/g, '\\\'')
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
  return `'${escaped}'`
}

export function hashString(input: string) {
  let hash = 0
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash) + input.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash).toString(36)
}

export function isScopedSlotsDisabled(context: TransformContext) {
  return context.scopedSlotsCompiler === 'off'
}

export function findSlotDirective(node: ElementNode): DirectiveNode | undefined {
  return node.props.find(
    prop => prop.type === NodeTypes.DIRECTIVE && prop.name === 'slot',
  ) as DirectiveNode | undefined
}

export function parseForExpression(exp: string): ForParseResult {
  // 解析 v-for："item in list"、"(item, index) in list"、"(item, key, index) in list"

  // eslint-disable-next-line regexp/no-super-linear-backtracking -- 保持与模板转换逻辑一致
  const match = exp.match(/^\(([^,]+),\s*([^,]+),\s*([^)]+)\)\s+in\s+(.+)$/)
  if (match) {
    const [, item, _key, index, list] = match
    return {
      listExp: list,
      item,
      index,
      key: _key,
    }
  }

  // eslint-disable-next-line regexp/no-super-linear-backtracking -- 保持与模板转换逻辑一致
  const match2 = exp.match(/^\(([^,]+),\s*([^)]+)\)\s+in\s+(.+)$/)
  if (match2) {
    const [, item, index, list] = match2
    return {
      listExp: list,
      item,
      index,
    }
  }

  // eslint-disable-next-line regexp/no-super-linear-backtracking -- 保持与模板转换逻辑一致
  const match3 = exp.match(/^(\w+)\s+in\s+(.+)$/)
  if (match3) {
    const [, item, list] = match3
    return {
      listExp: list,
      item,
    }
  }

  return {}
}
