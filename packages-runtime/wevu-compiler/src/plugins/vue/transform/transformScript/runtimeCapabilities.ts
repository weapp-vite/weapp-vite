import type { Scope, Visitor } from '@weapp-vite/ast/babelTraverse'
import type { WevuRuntimeCapabilityMetadata } from '../../../../runtimeCapabilities'
import type { WevuDefaults } from '../../../../types/wevu'
import type { CapabilityAccumulator } from './runtimeCapabilityOptions'
import * as t from '@weapp-vite/ast/babelTypes'
import { isWevuRuntimeModuleId, WE_VU_RUNTIME_APIS } from '../../../../constants'
import { traverse } from '../../../../utils/babel'
import {
  addConservativeCapabilities,
  analyzeRuntimeDefaults,
  analyzeRuntimeFactoryOptions,
  createCapabilityAccumulator,
  finishRuntimeCapabilityAnalysis,
} from './runtimeCapabilityOptions'

export { injectWevuRuntimeCapabilityInstallers } from './runtimeCapabilityInjection'

type RuntimeOptionApiName
  = | 'createApp'
    | 'createWevuComponent'
    | 'createWevuScopedSlotComponent'
    | 'defineComponent'
    | 'setWevuDefaults'

const OPTION_FACTORY_APIS: Record<Exclude<RuntimeOptionApiName, 'createWevuScopedSlotComponent' | 'setWevuDefaults'>, true> = {
  createApp: true,
  createWevuComponent: true,
  defineComponent: true,
}

function addScopedSlotCreatorCapabilities(accumulator: CapabilityAccumulator) {
  accumulator.required.add('scopedSlots')
  addConservativeCapabilities(accumulator, ['templateRefs', 'inlineEvents', 'layout'])
}

/**
 * 分析源模块中显式 wevu 工厂与默认值调用所需的运行时能力。
 */
export function analyzeWevuRuntimeCalls(ast: t.File): WevuRuntimeCapabilityMetadata | undefined {
  const namedBindings = new Map<string, { api: RuntimeOptionApiName, specifier: t.ImportSpecifier }>()
  const namespaceSpecifiers: Array<t.ImportNamespaceSpecifier | t.ImportDefaultSpecifier> = []
  for (const statement of ast.program.body) {
    if (!t.isImportDeclaration(statement) || statement.importKind === 'type' || !isWevuRuntimeModuleId(statement.source.value)) {
      continue
    }
    for (const specifier of statement.specifiers) {
      if (t.isImportNamespaceSpecifier(specifier) || t.isImportDefaultSpecifier(specifier)) {
        namespaceSpecifiers.push(specifier)
        continue
      }
      if (!t.isImportSpecifier(specifier) || specifier.importKind === 'type' || !t.isIdentifier(specifier.imported)) {
        continue
      }
      const importedName = specifier.imported.name as RuntimeOptionApiName
      if (
        importedName === 'createWevuScopedSlotComponent'
        || importedName === 'setWevuDefaults'
        || Object.prototype.hasOwnProperty.call(OPTION_FACTORY_APIS, importedName)
      ) {
        namedBindings.set(specifier.local.name, { api: importedName, specifier })
      }
    }
  }

  if (!namedBindings.size && !namespaceSpecifiers.length) {
    return undefined
  }
  const handledCallees = new Set<t.Identifier>()
  const safeBindingReferences = new Set<t.Identifier>()
  const accumulator = createCapabilityAccumulator()

  const calls: Array<{
    api: RuntimeOptionApiName
    argument?: t.Expression
    argumentUnknown: boolean
    scope: Scope
  }> = []
  let programScope: Scope | undefined
  const visitor: Visitor = {
    Program(path) {
      programScope = path.scope
    },
    CallExpression(path) {
      if (!t.isIdentifier(path.node.callee)) {
        return
      }
      const runtimeBinding = namedBindings.get(path.node.callee.name)
      const binding = path.scope.getBinding(path.node.callee.name)
      if (!runtimeBinding || binding?.path.node !== runtimeBinding.specifier) {
        return
      }
      handledCallees.add(path.node.callee)
      const firstArgument = path.node.arguments[0]
      const argument = firstArgument && !t.isSpreadElement(firstArgument) && t.isExpression(firstArgument)
        ? firstArgument
        : undefined
      if (t.isIdentifier(argument)) {
        safeBindingReferences.add(argument)
      }
      calls.push({
        api: runtimeBinding.api,
        argument,
        argumentUnknown: Boolean(firstArgument && (t.isSpreadElement(firstArgument) || !t.isExpression(firstArgument))),
        scope: path.scope,
      })
    },
  }
  traverse(ast, visitor)

  for (const { api, argument, argumentUnknown, scope } of calls) {
    const context = { scope, safeBindingReferences }
    if (api === 'createWevuScopedSlotComponent') {
      addScopedSlotCreatorCapabilities(accumulator)
    }
    else if (argumentUnknown) {
      addConservativeCapabilities(accumulator, ['patchStrategy', 'setDataHighFrequencyWarning'])
    }
    else if (api === 'setWevuDefaults') {
      analyzeRuntimeDefaults(argument, context, accumulator)
    }
    else {
      analyzeRuntimeFactoryOptions(argument, context, accumulator)
    }
  }
  for (const { api, specifier } of namedBindings.values()) {
    const matchingBinding = programScope?.getBinding(specifier.local.name)
    if (!matchingBinding?.referencePaths.some(reference => !handledCallees.has(reference.node as t.Identifier))) {
      continue
    }
    if (api === 'createWevuScopedSlotComponent') {
      addScopedSlotCreatorCapabilities(accumulator)
    }
    else {
      addConservativeCapabilities(accumulator, ['patchStrategy', 'setDataHighFrequencyWarning'])
    }
  }
  for (const specifier of namespaceSpecifiers) {
    const binding = programScope?.getBinding(specifier.local.name)
    if (!binding?.referenced) {
      continue
    }
    addConservativeCapabilities(accumulator, ['patchStrategy', 'setDataHighFrequencyWarning'])
    const mayCreateScopedSlot = binding.referencePaths.some((reference) => {
      const parent = reference.parentPath
      if (
        !parent.isMemberExpression()
        || parent.node.object !== reference.node
        || parent.node.computed
        || !t.isIdentifier(parent.node.property)
      ) {
        return true
      }
      return parent.node.property.name === WE_VU_RUNTIME_APIS.createWevuScopedSlotComponent
    })
    if (mayCreateScopedSlot) {
      addScopedSlotCreatorCapabilities(accumulator)
    }
  }
  return finishRuntimeCapabilityAnalysis(accumulator)
}

/**
 * 分析编译器即将注册的默认导出选项。
 */
export function analyzeWevuComponentOptions(params: {
  expression: t.Expression | null
  scope?: Scope
  defaults?: Record<string, unknown>
}): WevuRuntimeCapabilityMetadata | undefined {
  if (!params.expression) {
    return undefined
  }
  const accumulator = createCapabilityAccumulator()
  analyzeRuntimeFactoryOptions(
    params.expression,
    { scope: params.scope },
    accumulator,
    params.defaults,
  )
  return finishRuntimeCapabilityAnalysis(accumulator)
}

/**
 * 分析序列化 app/component 默认值所需的运行时能力。
 */
export function analyzeWevuDefaults(defaults: WevuDefaults | undefined) {
  if (!defaults) {
    return undefined
  }
  const node = t.valueToNode(defaults)
  if (!t.isExpression(node)) {
    return undefined
  }
  const accumulator = createCapabilityAccumulator()
  analyzeRuntimeDefaults(node, {}, accumulator)
  return finishRuntimeCapabilityAnalysis(accumulator)
}
