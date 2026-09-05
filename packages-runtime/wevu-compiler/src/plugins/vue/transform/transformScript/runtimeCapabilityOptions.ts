import type { Scope } from '@weapp-vite/ast/babelTraverse'
import type { WevuRuntimeCapabilityMetadata, WevuRuntimeCapabilityName } from '../../../../runtimeCapabilities'
import * as t from '@weapp-vite/ast/babelTypes'
import { createWevuRuntimeCapabilityMetadata } from '../../../../runtimeCapabilities'
import { isStaticObjectKeyMatch } from './utils'

export interface CapabilityAccumulator {
  required: Set<WevuRuntimeCapabilityName>
  conservative: Set<WevuRuntimeCapabilityName>
}

export interface StaticAnalysisContext {
  scope?: Scope
  safeBindingReferences?: ReadonlySet<t.Identifier>
}

interface StaticExpression {
  value: t.Expression
  context: StaticAnalysisContext
}

type PropertyState = { kind: 'absent' } | { kind: 'unknown' } | ({ kind: 'value' } & StaticExpression)

export function createCapabilityAccumulator(): CapabilityAccumulator {
  return {
    required: new Set<WevuRuntimeCapabilityName>(),
    conservative: new Set<WevuRuntimeCapabilityName>(),
  }
}

export function addConservativeCapabilities(
  accumulator: CapabilityAccumulator,
  names: readonly WevuRuntimeCapabilityName[],
) {
  for (const name of names) {
    accumulator.required.add(name)
    accumulator.conservative.add(name)
  }
}

function unwrapExpression(node: t.Expression): t.Expression {
  if (t.isTSAsExpression(node) || t.isTSSatisfiesExpression(node) || t.isTSNonNullExpression(node) || t.isTypeCastExpression(node)) {
    return unwrapExpression(node.expression as t.Expression)
  }
  if (t.isParenthesizedExpression(node)) {
    return unwrapExpression(node.expression)
  }
  return node
}

function resolveStaticExpression(
  node: t.Expression,
  context: StaticAnalysisContext,
  visited = new Set<t.VariableDeclarator>(),
): StaticExpression | undefined {
  const normalized = unwrapExpression(node)
  if (!t.isIdentifier(normalized) || normalized.name === 'undefined') {
    return { value: normalized, context }
  }
  const binding = context.scope?.getBinding(normalized.name)
  if (
    !binding
    || !binding.constant
    || !binding.path.isVariableDeclarator()
    || !binding.path.parentPath?.isVariableDeclaration()
    || binding.path.parentPath.node.kind !== 'const'
    || visited.has(binding.path.node)
  ) {
    return undefined
  }
  const referencesAreLocal = binding.referencePaths.length === 1 || binding.referencePaths.every((reference) => {
    return context.safeBindingReferences?.has(reference.node as t.Identifier)
      || (reference.parentPath.isExportDefaultDeclaration() && reference.parentPath.node.declaration === reference.node)
  })
  if (!referencesAreLocal || !binding.path.node.init || !t.isExpression(binding.path.node.init)) {
    return undefined
  }
  visited.add(binding.path.node)
  return resolveStaticExpression(binding.path.node.init, {
    scope: binding.path.scope,
    safeBindingReferences: context.safeBindingReferences,
  }, visited)
}

function resolveProperty(
  object: t.ObjectExpression,
  key: string,
  context: StaticAnalysisContext,
  initial: PropertyState = { kind: 'absent' },
): PropertyState {
  let state = initial
  for (const property of object.properties) {
    if (t.isSpreadElement(property) || property.computed) {
      state = { kind: 'unknown' }
      continue
    }
    if (!isStaticObjectKeyMatch(property.key, key)) {
      continue
    }
    if (!t.isObjectProperty(property) || !t.isExpression(property.value)) {
      state = { kind: 'unknown' }
      continue
    }
    state = { kind: 'value', value: property.value, context }
  }
  return state
}

function isStaticPrimitive(node: t.Expression) {
  return t.isBooleanLiteral(node)
    || t.isNullLiteral(node)
    || t.isNumericLiteral(node)
    || t.isStringLiteral(node)
    || (t.isTemplateLiteral(node) && node.expressions.length === 0)
    || t.isIdentifier(node, { name: 'undefined' })
}
function applyResolvedProperty(current: PropertyState, next: PropertyState): PropertyState {
  return next.kind === 'absent' ? current : next
}

function resolveInheritedSetData(
  expression: t.Expression,
  context: StaticAnalysisContext,
  visited: Set<t.ObjectExpression>,
): PropertyState {
  const result = resolveStaticExpression(expression, context)
  if (!result) {
    return { kind: 'unknown' }
  }
  const { value: resolved, context: resolvedContext } = result
  if (!t.isObjectExpression(resolved)) {
    return isStaticPrimitive(resolved) || t.isFunction(resolved)
      ? { kind: 'absent' }
      : { kind: 'unknown' }
  }
  if (visited.has(resolved)) {
    return { kind: 'absent' }
  }
  visited.add(resolved)

  let state: PropertyState = { kind: 'absent' }
  const inherited = resolveProperty(resolved, 'extends', resolvedContext)
  if (inherited.kind === 'unknown') {
    state = inherited
  }
  else if (inherited.kind === 'value') {
    state = applyResolvedProperty(
      state,
      resolveInheritedSetData(inherited.value, inherited.context, visited),
    )
  }

  const mixins = resolveProperty(resolved, 'mixins', resolvedContext)
  if (mixins.kind === 'unknown') {
    state = mixins
  }
  else if (mixins.kind === 'value') {
    const resolvedMixins = resolveStaticExpression(mixins.value, mixins.context)
    if (!resolvedMixins || !t.isArrayExpression(resolvedMixins.value)) {
      state = { kind: 'unknown' }
    }
    else {
      for (const element of resolvedMixins.value.elements) {
        if (!element || t.isSpreadElement(element) || !t.isExpression(element)) {
          state = { kind: 'unknown' }
          continue
        }
        state = applyResolvedProperty(
          state,
          resolveInheritedSetData(element, resolvedMixins.context, visited),
        )
      }
    }
  }

  state = applyResolvedProperty(state, resolveProperty(resolved, 'setData', resolvedContext))
  visited.delete(resolved)
  return state
}

function analyzeHighFrequencyWarning(
  state: PropertyState,
  accumulator: CapabilityAccumulator,
) {
  if (state.kind === 'unknown') {
    addConservativeCapabilities(accumulator, ['setDataHighFrequencyWarning'])
    return
  }
  if (state.kind === 'absent') {
    return
  }
  const resolved = resolveStaticExpression(state.value, state.context)
  if (!resolved) {
    addConservativeCapabilities(accumulator, ['setDataHighFrequencyWarning'])
    return
  }
  const { value, context } = resolved
  if (t.isObjectExpression(value)) {
    const enabled = resolveProperty(value, 'enabled', context)
    if (enabled.kind === 'unknown') {
      addConservativeCapabilities(accumulator, ['setDataHighFrequencyWarning'])
      return
    }
    if (enabled.kind === 'value') {
      const resolvedEnabled = resolveStaticExpression(enabled.value, enabled.context)
      if (!resolvedEnabled) {
        addConservativeCapabilities(accumulator, ['setDataHighFrequencyWarning'])
        return
      }
      if (t.isBooleanLiteral(resolvedEnabled.value, { value: false })) {
        return
      }
    }
    accumulator.required.add('setDataHighFrequencyWarning')
    return
  }
  if (t.isBooleanLiteral(value, { value: true })) {
    accumulator.required.add('setDataHighFrequencyWarning')
    return
  }
  if (!isStaticPrimitive(value) && !t.isArrayExpression(value) && !t.isFunction(value)) {
    addConservativeCapabilities(accumulator, ['setDataHighFrequencyWarning'])
  }
}

function analyzeSetData(
  state: PropertyState,
  accumulator: CapabilityAccumulator,
  defaults?: PropertyState,
) {
  if (state.kind === 'unknown') {
    addConservativeCapabilities(accumulator, ['patchStrategy', 'setDataHighFrequencyWarning'])
    return
  }
  if (state.kind === 'absent') {
    if (defaults) {
      analyzeSetData(defaults, accumulator)
    }
    return
  }

  const defaultValue = defaults?.kind === 'value'
    ? resolveStaticExpression(defaults.value, defaults.context)
    : undefined
  const defaultObject = defaultValue && t.isObjectExpression(defaultValue.value) ? defaultValue.value : undefined
  if (
    defaultObject
    && (t.isIdentifier(state.value) || t.isMemberExpression(state.value))
  ) {
    addConservativeCapabilities(accumulator, ['patchStrategy', 'setDataHighFrequencyWarning'])
    return
  }

  const resolved = resolveStaticExpression(state.value, state.context)
  if (!resolved) {
    addConservativeCapabilities(accumulator, ['patchStrategy', 'setDataHighFrequencyWarning'])
    return
  }
  const { value, context } = resolved
  if (!t.isObjectExpression(value)) {
    if (defaultObject) {
      analyzeSetData({ kind: 'value', value: defaultObject, context: defaultValue!.context }, accumulator)
    }
    if (!isStaticPrimitive(value) && !t.isArrayExpression(value) && !t.isFunction(value)) {
      addConservativeCapabilities(accumulator, ['patchStrategy', 'setDataHighFrequencyWarning'])
    }
    return
  }

  const mergedDefaults = t.isObjectExpression(state.value) ? defaultObject : undefined
  const defaultStrategy = mergedDefaults
    ? resolveProperty(mergedDefaults, 'strategy', defaultValue!.context)
    : defaults?.kind === 'unknown' ? defaults : undefined
  const strategy = resolveProperty(value, 'strategy', context, defaultStrategy)
  if (strategy.kind === 'unknown') {
    addConservativeCapabilities(accumulator, ['patchStrategy'])
  }
  else if (strategy.kind === 'value') {
    const resolvedStrategy = resolveStaticExpression(strategy.value, strategy.context)?.value
    const isPatchStrategy = t.isStringLiteral(resolvedStrategy, { value: 'patch' })
      || (
        t.isTemplateLiteral(resolvedStrategy)
        && resolvedStrategy.expressions.length === 0
        && resolvedStrategy.quasis[0]?.value.cooked === 'patch'
      )
    if (isPatchStrategy) {
      accumulator.required.add('patchStrategy')
    }
    else if (!resolvedStrategy || (!isStaticPrimitive(resolvedStrategy) && !t.isArrayExpression(resolvedStrategy) && !t.isFunction(resolvedStrategy))) {
      addConservativeCapabilities(accumulator, ['patchStrategy'])
    }
  }
  const defaultHighFrequencyWarning = mergedDefaults
    ? resolveProperty(mergedDefaults, 'highFrequencyWarning', defaultValue!.context)
    : defaults?.kind === 'unknown' ? defaults : undefined
  analyzeHighFrequencyWarning(
    resolveProperty(value, 'highFrequencyWarning', context, defaultHighFrequencyWarning),
    accumulator,
  )
}

/**
 * 分析一次工厂调用或默认导出使用的选项表达式。
 */
export function analyzeRuntimeFactoryOptions(
  expression: t.Expression | undefined,
  context: StaticAnalysisContext,
  accumulator: CapabilityAccumulator,
  defaults?: Record<string, unknown>,
) {
  const hasDefaultSetData = Boolean(
    defaults && Object.prototype.hasOwnProperty.call(defaults, 'setData'),
  )
  const defaultSetDataNode = hasDefaultSetData ? t.valueToNode(defaults?.setData) : undefined
  const defaultSetData: PropertyState | undefined = defaultSetDataNode && t.isExpression(defaultSetDataNode)
    ? { kind: 'value', value: defaultSetDataNode, context: {} }
    : undefined
  if (!expression) {
    if (defaultSetData) {
      analyzeSetData(defaultSetData, accumulator)
    }
    return
  }
  const resolved = resolveStaticExpression(expression, context)
  if (!resolved) {
    addConservativeCapabilities(accumulator, ['patchStrategy', 'setDataHighFrequencyWarning'])
    return
  }
  if (!t.isObjectExpression(resolved.value)) {
    if (!isStaticPrimitive(resolved.value) && !t.isArrayExpression(resolved.value) && !t.isFunction(resolved.value)) {
      addConservativeCapabilities(accumulator, ['patchStrategy', 'setDataHighFrequencyWarning'])
    }
    return
  }
  analyzeSetData(resolveInheritedSetData(resolved.value, resolved.context, new Set()), accumulator, defaultSetData)
}

/**
 * 分析 setWevuDefaults() 中 app 与 component 两个默认值分支。
 */
export function analyzeRuntimeDefaults(
  expression: t.Expression | undefined,
  context: StaticAnalysisContext,
  accumulator: CapabilityAccumulator,
) {
  if (!expression) {
    return
  }
  const resolved = resolveStaticExpression(expression, context)
  if (!resolved || !t.isObjectExpression(resolved.value)) {
    addConservativeCapabilities(accumulator, ['patchStrategy', 'setDataHighFrequencyWarning'])
    return
  }
  for (const key of ['app', 'component'] as const) {
    const branch = resolveProperty(resolved.value, key, resolved.context)
    if (branch.kind === 'unknown') {
      addConservativeCapabilities(accumulator, ['patchStrategy', 'setDataHighFrequencyWarning'])
    }
    else if (branch.kind === 'value') {
      analyzeRuntimeFactoryOptions(branch.value, branch.context, accumulator)
    }
  }
}

export function finishRuntimeCapabilityAnalysis(
  accumulator: CapabilityAccumulator,
): WevuRuntimeCapabilityMetadata | undefined {
  return createWevuRuntimeCapabilityMetadata(accumulator.required, accumulator.conservative)
}
