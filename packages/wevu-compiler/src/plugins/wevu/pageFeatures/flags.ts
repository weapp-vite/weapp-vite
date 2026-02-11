import type { WevuPageFeatureFlag, WevuPageHookName } from './types'
import * as t from '@babel/types'
import { WE_VU_MODULE_ID, WE_VU_PAGE_HOOK_TO_FEATURE } from '../../../constants'
import { traverse } from '../../../utils/babel'
import { buildInjectedFeaturesObject, getObjectMemberIndexByKey, getObjectPropertyByKey } from './astUtils'

type WevuShareLifecycleHookName
  = | 'onShareAppMessage'
    | 'onShareTimeline'
    | 'onAddToFavorites'

function isFeatureFlagExplicitlyFalse(
  featuresObject: t.ObjectExpression,
  featureFlag: 'enableOnShareAppMessage' | 'enableOnShareTimeline' | 'enableOnAddToFavorites',
) {
  const featureProp = getObjectPropertyByKey(featuresObject, featureFlag)
  return !!(featureProp && t.isBooleanLiteral(featureProp.value) && featureProp.value.value === false)
}

function collectShareLifecycleHooksToInject(
  optionsObject: t.ObjectExpression,
  enabled: Set<WevuPageFeatureFlag>,
): Set<WevuShareLifecycleHookName> {
  const existingFeaturesProp = getObjectPropertyByKey(optionsObject, 'features')
  const existingFeaturesObject = existingFeaturesProp && t.isObjectExpression(existingFeaturesProp.value)
    ? existingFeaturesProp.value
    : undefined

  if (existingFeaturesProp) {
    if (!existingFeaturesObject) {
      return new Set()
    }
    if (existingFeaturesObject.properties.some(prop => t.isSpreadElement(prop))) {
      return new Set()
    }
  }

  const shareHooks = new Set<WevuShareLifecycleHookName>()

  if (enabled.has('enableOnShareTimeline')) {
    // 官方要求：onShareTimeline 生效时需同时具备 onShareAppMessage
    shareHooks.add('onShareAppMessage')
    shareHooks.add('onShareTimeline')
  }
  else if (enabled.has('enableOnShareAppMessage')) {
    shareHooks.add('onShareAppMessage')
  }

  if (enabled.has('enableOnAddToFavorites')) {
    shareHooks.add('onAddToFavorites')
  }

  if (!existingFeaturesObject) {
    return shareHooks
  }

  if (isFeatureFlagExplicitlyFalse(existingFeaturesObject, 'enableOnShareAppMessage')) {
    shareHooks.delete('onShareAppMessage')
    shareHooks.delete('onShareTimeline')
  }
  if (isFeatureFlagExplicitlyFalse(existingFeaturesObject, 'enableOnShareTimeline')) {
    shareHooks.delete('onShareTimeline')
  }
  if (isFeatureFlagExplicitlyFalse(existingFeaturesObject, 'enableOnAddToFavorites')) {
    shareHooks.delete('onAddToFavorites')
  }

  if (shareHooks.has('onShareTimeline')) {
    shareHooks.add('onShareAppMessage')
  }

  return shareHooks
}

function buildInjectedShareLifecycleMethod(name: WevuShareLifecycleHookName) {
  return t.objectMethod(
    'method',
    t.identifier(name),
    [],
    t.blockStatement([
      t.returnStatement(t.objectExpression([])),
    ]),
  )
}

function injectWevuShareLifecycleHooksIntoOptionsObject(
  optionsObject: t.ObjectExpression,
  enabled: Set<WevuPageFeatureFlag>,
) {
  const hooksToInject = collectShareLifecycleHooksToInject(optionsObject, enabled)
  if (!hooksToInject.size) {
    return false
  }

  const setupIndex = getObjectMemberIndexByKey(optionsObject, 'setup')
  let insertAt = setupIndex >= 0 ? setupIndex : optionsObject.properties.length
  let changed = false

  for (const hookName of hooksToInject) {
    if (getObjectMemberIndexByKey(optionsObject, hookName) >= 0) {
      continue
    }
    optionsObject.properties.splice(insertAt, 0, buildInjectedShareLifecycleMethod(hookName))
    insertAt += 1
    changed = true
  }

  return changed
}

/**
 * 扫描 AST，收集启用的 wevu 页面特性标识。
 */
export function collectWevuPageFeatureFlags(ast: t.File): Set<WevuPageFeatureFlag> {
  const namedHookLocals = new Map<string, WevuPageFeatureFlag>()
  const namespaceLocals = new Set<string>()

  for (const stmt of ast.program.body) {
    if (!t.isImportDeclaration(stmt) || stmt.source.value !== WE_VU_MODULE_ID) {
      continue
    }
    for (const specifier of stmt.specifiers) {
      if (t.isImportSpecifier(specifier) && t.isIdentifier(specifier.imported)) {
        const importedName = specifier.imported.name as WevuPageHookName
        const matched = WE_VU_PAGE_HOOK_TO_FEATURE[importedName]
        if (matched) {
          namedHookLocals.set(specifier.local.name, matched)
        }
      }
      else if (t.isImportNamespaceSpecifier(specifier)) {
        namespaceLocals.add(specifier.local.name)
      }
    }
  }

  if (namedHookLocals.size === 0 && namespaceLocals.size === 0) {
    return new Set()
  }

  const enabled = new Set<WevuPageFeatureFlag>()

  function consumeHookCallByName(name: string) {
    const matched = namedHookLocals.get(name)
    if (matched) {
      enabled.add(matched)
    }
  }

  function consumeNamespaceHookCall(namespace: string, hookName: string) {
    if (!namespaceLocals.has(namespace)) {
      return
    }
    const matched = (WE_VU_PAGE_HOOK_TO_FEATURE as any)[hookName] as WevuPageFeatureFlag | undefined
    if (matched) {
      enabled.add(matched)
    }
  }

  traverse(ast, {
    CallExpression(path) {
      const callee = path.node.callee
      if (t.isIdentifier(callee)) {
        consumeHookCallByName(callee.name)
        return
      }
      if (t.isMemberExpression(callee) && !callee.computed && t.isIdentifier(callee.object)) {
        const property = callee.property
        if (t.isIdentifier(property)) {
          consumeNamespaceHookCall(callee.object.name, property.name)
        }
      }
    },
    OptionalCallExpression(path) {
      const callee = path.node.callee
      if (t.isIdentifier(callee)) {
        consumeHookCallByName(callee.name)
        return
      }
      if (t.isMemberExpression(callee) && !callee.computed && t.isIdentifier(callee.object)) {
        const property = callee.property
        if (t.isIdentifier(property)) {
          consumeNamespaceHookCall(callee.object.name, property.name)
        }
      }
    },
  })

  return enabled
}

/**
 * 将启用的页面特性注入到 options 对象中。
 */
export function injectWevuPageFeatureFlagsIntoOptionsObject(
  optionsObject: t.ObjectExpression,
  enabled: Set<WevuPageFeatureFlag>,
): boolean {
  if (!enabled.size) {
    return false
  }

  const expectedKeys = Array.from(enabled)
  const existingFeaturesProp = getObjectPropertyByKey(optionsObject, 'features')
  let changed = false

  if (!existingFeaturesProp) {
    const featuresObject = buildInjectedFeaturesObject(enabled)

    const setupIndex = getObjectMemberIndexByKey(optionsObject, 'setup')
    const insertAt = setupIndex >= 0 ? setupIndex : 0

    optionsObject.properties.splice(
      insertAt,
      0,
      t.objectProperty(t.identifier('features'), featuresObject),
    )
    changed = true
  }
  else if (t.isObjectExpression(existingFeaturesProp.value)) {
    const featuresObject = existingFeaturesProp.value
    const injectedProps: t.ObjectProperty[] = []

    for (const key of expectedKeys) {
      const existing = getObjectPropertyByKey(featuresObject, key)
      if (existing) {
        continue
      }
      // 关键：注入的 `true` 必须放在现有属性/spread 之前，确保用户配置（尤其是 `false`）能在后续覆盖。
      // 例如：`features: { ...disabled }` 且 disabled 内含
      // `{ enableOnShareTimeline: false }`.
      injectedProps.push(
        t.objectProperty(t.identifier(key), t.booleanLiteral(true)),
      )
    }

    if (injectedProps.length) {
      featuresObject.properties.splice(0, 0, ...injectedProps)
      changed = true
    }
  }
  // 兼容 `features: importedObject`（或 `features: ns.importedObject`）：通过包一层对象字面量实现注入。
  else if (t.isIdentifier(existingFeaturesProp.value) || t.isMemberExpression(existingFeaturesProp.value)) {
    const base = t.cloneNode(existingFeaturesProp.value, true) as t.Expression
    const injected = buildInjectedFeaturesObject(enabled)
    injected.properties.push(t.spreadElement(base))
    existingFeaturesProp.value = injected
    changed = true
  }

  changed = injectWevuShareLifecycleHooksIntoOptionsObject(optionsObject, enabled) || changed
  return changed
}
