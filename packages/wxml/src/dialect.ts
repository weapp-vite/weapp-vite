import type { CompiledDialect, DialectDefinition, Syntax } from './types'

export interface CompiledState {
  readonly syntax: Syntax
  readonly rawTagPattern: RegExp
  readonly rawTagInitials: number
}

const states = new WeakMap<CompiledDialect, CompiledState>()

/** 校验并冻结方言声明，匹配结构不通过公开对象暴露。 */
export function compileDialect(definition: DialectDefinition): CompiledDialect {
  if (!definition || typeof definition !== 'object' || Array.isArray(definition)) {
    throw new TypeError('Expected a dialect definition.')
  }
  const { id, syntax, rawTags } = definition
  if (typeof id !== 'string' || !id) {
    throw new TypeError('Expected a nonempty dialect id.')
  }
  if (syntax !== 'legacy' && syntax !== 'xml') {
    throw new TypeError(`Unsupported template syntax: ${String(syntax)}.`)
  }
  if (!Array.isArray(rawTags)) {
    throw new TypeError('Expected rawTags to be an array of nonempty names.')
  }
  const names = Object.freeze(rawTags.slice())
  // ASCII 大小写首码相差 32，位图只排除不可能匹配的标签，碰撞仍由原 matcher 确认。
  let rawTagInitials = 0
  for (const name of names) {
    if (typeof name !== 'string' || !name) {
      throw new TypeError('Expected rawTags to be an array of nonempty names.')
    }
    rawTagInitials |= 1 << name.charCodeAt(0)
  }
  const matcher = new RegExp(`^(?:${names.map(name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})$`, 'i')
  const compiled = Object.freeze({ id, syntax, rawTags: names }) as CompiledDialect
  states.set(compiled, Object.freeze({ syntax, rawTagPattern: matcher, rawTagInitials }))
  return compiled
}

/** 绑定解析器或兼容上下文时校验一次，后续扫描直接使用私有状态。 */
export function compiledState(dialect: CompiledDialect): CompiledState {
  const state = states.get(dialect)
  if (!state) {
    throw new TypeError('Expected a compiled dialect.')
  }
  return state
}
