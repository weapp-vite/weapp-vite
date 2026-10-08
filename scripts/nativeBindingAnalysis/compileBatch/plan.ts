import type { TransformContext } from '../../../packages-runtime/wevu-compiler/src/plugins/vue/compiler/template/types'
import type { BindingInput } from '../source'
import type { NormalizeBinding, PlannedRecord, RecordOptions } from './types'

export function bindingInput(expression: string, context?: TransformContext, additionalLocals?: Iterable<string>): BindingInput {
  return {
    expression,
    locals: [...new Set([...(context?.scopeStack ?? []).flatMap(scope => [...scope]), ...additionalLocals ?? []])],
    safeCallNames: [...context?.templateSafeCallNames ?? []],
  }
}

function freezeInput(input: BindingInput) {
  Object.freeze(input.locals)
  Object.freeze(input.safeCallNames)
  return Object.freeze(input)
}

/** 在遍历尚未退出当前作用域时冻结规范化输入；不提前执行依赖分析或编译。 */
export function planBindingRecord(options: RecordOptions, context: TransformContext, additionalLocals: Iterable<string> | undefined, normalize: NormalizeBinding): PlannedRecord {
  const locals = [...additionalLocals ?? []]
  const normalized = normalize(options.expression, context)
  const initial = freezeInput(bindingInput(normalized, context, locals))
  const inputs = [initial]
  const forStack = context.forStack.map((forInfo) => {
    const expression = forInfo.rawListExp ?? forInfo.listExp
    const normalizedList = initial.locals.length && expression
      ? normalize(expression, { ...context, scopeStack: [], forStack: [] })
      : undefined
    if (normalizedList !== undefined) {
      inputs.push(freezeInput({ expression: normalizedList, locals: [], safeCallNames: [...initial.safeCallNames] }))
    }
    return Object.freeze({
      item: forInfo.item,
      index: forInfo.index,
      key: forInfo.key,
      itemAliases: forInfo.itemAliases ? Object.freeze({ ...forInfo.itemAliases }) : undefined,
      rawListExp: normalizedList ?? forInfo.rawListExp,
      listExp: normalizedList ?? forInfo.listExp,
    })
  })
  const scopeDependencies = options.scopeDependencies?.map((scope) => {
    const copy = { expression: scope.expression, locals: [...scope.locals] }
    inputs.push(freezeInput(bindingInput(copy.expression, undefined, copy.locals)))
    Object.freeze(copy.locals)
    return Object.freeze(copy)
  })
  const scopes = options.scopes?.map((scope) => {
    const copy = { ...scope, ...(scope.locals ? { locals: [...scope.locals] } : {}) }
    if (copy.locals) {
      Object.freeze(copy.locals)
    }
    return Object.freeze(copy)
  })
  const frozenOptions: RecordOptions = Object.freeze({
    ...options,
    expression: normalized,
    sourceLocation: options.sourceLocation
      ? Object.freeze({ start: Object.freeze({ ...options.sourceLocation.start }), end: Object.freeze({ ...options.sourceLocation.end }) })
      : undefined,
    scopes,
    scopeDependencies,
  })
  if (frozenOptions.scopes) {
    Object.freeze(frozenOptions.scopes)
  }
  if (scopeDependencies) {
    Object.freeze(scopeDependencies)
  }
  // 回放仅消费这些字段；规范化已经完成，不保留可变 AST、slotPropStack 或整个上下文。
  const frozenContext = {
    rewriteScopedSlot: context.rewriteScopedSlot,
    scopeStack: context.scopeStack.map(scope => new Set(scope)),
    templateSafeCallNames: new Set(context.templateSafeCallNames),
    forStack,
  } as TransformContext
  Object.freeze(frozenContext.scopeStack)
  Object.freeze(forStack)
  Object.freeze(frozenContext)
  Object.freeze(locals)
  Object.freeze(inputs)
  return Object.freeze({ options: frozenOptions, context: frozenContext, additionalLocals: locals, inputs })
}
