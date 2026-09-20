import type { ObjectExpression } from '@weapp-vite/ast/babelTypes'
import type { WevuBindingManifestV1, WevuRuntimeBindingManifestMode } from '../../../../../types/bindingManifest'
import type { CompilerPageLayoutPlan } from '../../../../../types/pageLayout'
import {
  WEVU_BINDING_MANIFEST_KEY,
  WEVU_EXPRESSION_ERROR_IDENTIFIER,
  WEVU_LAYOUT_BIND_PREFIX,
  WEVU_SLOT_NAMES_PROP,
  WEVU_SLOT_OWNER_ID_KEY,
  WEVU_SLOT_OWNER_ID_PROP,
  WEVU_SLOT_SCOPE_KEY,
} from '@weapp-core/constants'
import * as t from '@weapp-vite/ast/babelTypes'
import { createRuntimeBindingManifest } from '../../../../../bindingManifest'
import { isBindingManifestComplete } from '../../../compiler/template/bindingManifest'
import { parseBabelExpression } from '../../../compiler/template/expression/parse'
import { createStaticObjectKey, getObjectPropertyByKey } from '../utils'

function mergeStableKeys(target: string[], incoming: Iterable<string>) {
  const seen = new Set(target)
  for (const key of incoming) {
    if (!key || seen.has(key)) {
      continue
    }
    seen.add(key)
    target.push(key)
  }
}

function resolveOutputRoot(outputPath: string) {
  return /^[A-Z_$][\w$]*/i.exec(outputPath)?.[0]
}

/**
 * 从绑定清单推导当前组件允许同步的顶层输出 key。
 */
export function resolveBindingManifestPickKeys(
  manifest: WevuBindingManifestV1,
  autoSetDataPick: boolean,
) {
  const keys: string[] = []
  if (!isBindingManifestComplete(manifest)) {
    return keys
  }
  const outputRoots = manifest.bindings.flatMap((binding) => {
    const root = resolveOutputRoot(binding.outputPath)
    return root ? [root] : []
  })
  const hasUnmaterializedSnapshotFallback = manifest.bindings.some((binding) => {
    return binding.updateMode === 'snapshot-fallback' && !resolveOutputRoot(binding.outputPath)
  })
  if (hasUnmaterializedSnapshotFallback) {
    return keys
  }
  const requiresScopedSlotOwner = manifest.bindings.some((binding) => {
    return binding.outputPath === WEVU_SLOT_OWNER_ID_KEY || binding.outputPath === WEVU_SLOT_OWNER_ID_PROP
  })
  if (autoSetDataPick || requiresScopedSlotOwner) {
    mergeStableKeys(keys, outputRoots)
  }
  if (autoSetDataPick) {
    mergeStableKeys(keys, [WEVU_SLOT_NAMES_PROP, WEVU_SLOT_OWNER_ID_PROP, WEVU_SLOT_SCOPE_KEY])
  }
  if (requiresScopedSlotOwner) {
    mergeStableKeys(keys, [
      WEVU_SLOT_OWNER_ID_KEY,
      WEVU_SLOT_NAMES_PROP,
      WEVU_SLOT_OWNER_ID_PROP,
      WEVU_SLOT_SCOPE_KEY,
    ])
  }
  return keys
}

function mergePickArray(array: t.ArrayExpression, keys: string[]) {
  const existing = new Set<string>()
  for (const element of array.elements) {
    if (t.isStringLiteral(element)) {
      existing.add(element.value)
    }
  }
  let changed = false
  for (const key of keys) {
    if (existing.has(key)) {
      continue
    }
    existing.add(key)
    array.elements.push(t.stringLiteral(key))
    changed = true
  }
  return changed
}

function injectSetDataPick(componentOptions: ObjectExpression, keys: string[]) {
  if (!keys.length) {
    return false
  }
  const pickArray = () => t.arrayExpression(keys.map(key => t.stringLiteral(key)))
  const setDataProp = getObjectPropertyByKey(componentOptions, 'setData')
  if (!setDataProp) {
    componentOptions.properties.unshift(
      t.objectProperty(
        t.identifier('setData'),
        t.objectExpression([
          t.objectProperty(t.identifier('pick'), pickArray()),
        ]),
      ),
    )
    return true
  }
  if (t.isObjectExpression(setDataProp.value)) {
    const pickProp = getObjectPropertyByKey(setDataProp.value, 'pick')
    if (!pickProp) {
      setDataProp.value.properties.unshift(t.objectProperty(t.identifier('pick'), pickArray()))
      return true
    }
    return t.isArrayExpression(pickProp.value) && mergePickArray(pickProp.value, keys)
  }
  if (t.isIdentifier(setDataProp.value) || t.isMemberExpression(setDataProp.value) || t.isCallExpression(setDataProp.value)) {
    setDataProp.value = t.objectExpression([
      t.objectProperty(t.identifier('pick'), pickArray()),
      t.spreadElement(t.cloneNode(setDataProp.value, true)),
    ])
    return true
  }
  return false
}

function injectManifestMetadata(
  componentOptions: ObjectExpression,
  manifest: WevuBindingManifestV1,
  mode: WevuRuntimeBindingManifestMode,
) {
  const serialized = createRuntimeBindingManifest(manifest, mode)
  const value = t.callExpression(
    t.memberExpression(t.identifier('Object'), t.identifier('freeze')),
    [t.valueToNode(serialized) as t.Expression],
  )
  const existing = getObjectPropertyByKey(componentOptions, WEVU_BINDING_MANIFEST_KEY)
  if (existing) {
    existing.value = value
    return true
  }
  componentOptions.properties.push(
    t.objectProperty(t.stringLiteral(WEVU_BINDING_MANIFEST_KEY), value),
  )
  return true
}

function injectLayoutComputed(componentOptions: ObjectExpression, plan: CompilerPageLayoutPlan | undefined) {
  const runtimeEntries = Object.entries(plan?.currentLayout?.props ?? {})
    .filter((entry): entry is [string, { kind: 'expression', expression: string }] => {
      const value = entry[1]
      return typeof value === 'object' && value !== null && value.kind === 'expression'
    })
  if (!runtimeEntries.length) {
    return false
  }
  const computedEntries = runtimeEntries.map(([key, value]) => {
    const expression = parseBabelExpression(value.expression) ?? t.identifier('undefined')
    return t.objectProperty(
      createStaticObjectKey(`${WEVU_LAYOUT_BIND_PREFIX}${key}`),
      t.functionExpression(
        null,
        [],
        t.blockStatement([
          t.tryStatement(
            t.blockStatement([t.returnStatement(t.cloneNode(expression, true))]),
            t.catchClause(
              t.identifier(WEVU_EXPRESSION_ERROR_IDENTIFIER),
              t.blockStatement([t.returnStatement(t.identifier('undefined'))]),
            ),
          ),
        ]),
      ),
    )
  })
  const computedProp = getObjectPropertyByKey(componentOptions, 'computed')
  if (!computedProp) {
    componentOptions.properties.unshift(
      t.objectProperty(t.identifier('computed'), t.objectExpression(computedEntries)),
    )
    return true
  }
  if (t.isObjectExpression(computedProp.value)) {
    computedProp.value.properties.push(...computedEntries)
    return true
  }
  if (t.isIdentifier(computedProp.value) || t.isMemberExpression(computedProp.value)) {
    computedProp.value = t.objectExpression([
      ...computedEntries,
      t.spreadElement(t.cloneNode(computedProp.value, true)),
    ])
    return true
  }
  return false
}

/**
 * 在既有脚本 AST pass 中注入布局计算、绑定清单与 setData.pick。
 */
export function injectBindingManifestContract(
  componentOptions: ObjectExpression,
  options: {
    manifest?: WevuBindingManifestV1
    autoSetDataPick?: boolean
    pageLayout?: CompilerPageLayoutPlan
    runtimeBindingManifest?: WevuRuntimeBindingManifestMode
  },
) {
  let changed = injectLayoutComputed(componentOptions, options.pageLayout)
  if (!options.manifest) {
    return changed
  }
  changed = injectManifestMetadata(
    componentOptions,
    options.manifest,
    options.runtimeBindingManifest ?? 'compact',
  ) || changed
  const pickKeys = resolveBindingManifestPickKeys(options.manifest, options.autoSetDataPick === true)
  changed = injectSetDataPick(componentOptions, pickKeys) || changed
  return changed
}
