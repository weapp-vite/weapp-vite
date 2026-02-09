import type { ClassStyleBinding } from '../../../compiler/template/types'
import * as t from '@babel/types'
import { resolveWarnHandler } from '../../../../../utils/warn'
import { buildClassStyleComputedEntries } from '../../classStyleComputed'
import { ensureRuntimeImport } from '../../scriptRuntimeImport'
import { createStaticObjectKey, getObjectPropertyByKey } from '../utils'

export function injectClassStyleComputed(
  optionsObject: t.ObjectExpression,
  bindings: ClassStyleBinding[],
  warn?: (message: string) => void,
): boolean {
  if (!bindings.length) {
    return false
  }
  const warnHandler = resolveWarnHandler(warn)
  const helpers = {
    normalizeClass: t.identifier('__wevuNormalizeClass'),
    normalizeStyle: t.identifier('__wevuNormalizeStyle'),
    unref: t.identifier('__wevuUnref'),
  }
  const entries = buildClassStyleComputedEntries(bindings, helpers)
  if (!entries.length) {
    return false
  }

  const computedProp = getObjectPropertyByKey(optionsObject, 'computed')
  if (!computedProp) {
    optionsObject.properties.splice(
      0,
      0,
      t.objectProperty(createStaticObjectKey('computed'), t.objectExpression(entries)),
    )
    return true
  }

  if (t.isObjectExpression(computedProp.value)) {
    computedProp.value.properties.push(...entries)
    return true
  }

  if (t.isIdentifier(computedProp.value) || t.isMemberExpression(computedProp.value)) {
    computedProp.value = t.objectExpression([
      ...entries,
      t.spreadElement(t.cloneNode(computedProp.value, true)),
    ])
    return true
  }

  warnHandler('无法自动注入 class/style 计算属性，请手动合并 computed。')
  return false
}

export function ensureClassStyleRuntimeImports(program: t.Program) {
  ensureRuntimeImport(program, 'normalizeClass', '__wevuNormalizeClass')
  ensureRuntimeImport(program, 'normalizeStyle', '__wevuNormalizeStyle')
  ensureRuntimeImport(program, 'unref', '__wevuUnref')
}
