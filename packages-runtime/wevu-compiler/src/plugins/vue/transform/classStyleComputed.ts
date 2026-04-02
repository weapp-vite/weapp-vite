import type { ClassStyleBinding } from '../compiler/template/types'
import * as t from '@weapp-vite/ast/babelTypes'
import { generate } from '../../../utils/babel'
import { buildComputedFunctionBody, createStaticObjectKey } from './classStyleComputedBuilders'

export interface ClassStyleHelperIds {
  normalizeClass: t.Identifier
  normalizeStyle: t.Identifier
  unref?: t.Identifier
}

export interface ClassStyleHelperNames {
  normalizeClassName: string
  normalizeStyleName: string
  unrefName?: string
}

export function buildClassStyleComputedEntries(
  bindings: ClassStyleBinding[],
  helpers: ClassStyleHelperIds,
) {
  const entries: t.ObjectProperty[] = []
  for (const binding of bindings) {
    const key = createStaticObjectKey(binding.name)
    const body = buildComputedFunctionBody(binding, helpers)
    const fn = t.functionExpression(null, [], body)
    entries.push(t.objectProperty(key, fn))
  }
  return entries
}

export function buildClassStyleComputedObject(
  bindings: ClassStyleBinding[],
  helpers: ClassStyleHelperIds,
): t.ObjectExpression | null {
  if (!bindings.length) {
    return null
  }
  const entries = buildClassStyleComputedEntries(bindings, helpers)
  if (!entries.length) {
    return null
  }
  return t.objectExpression(entries)
}

export function buildClassStyleComputedCode(
  bindings: ClassStyleBinding[],
  helpers: ClassStyleHelperNames,
): string | null {
  if (!bindings.length) {
    return null
  }
  const obj = buildClassStyleComputedObject(bindings, {
    normalizeClass: t.identifier(helpers.normalizeClassName),
    normalizeStyle: t.identifier(helpers.normalizeStyleName),
    unref: t.identifier(helpers.unrefName ?? 'unref'),
  })
  if (!obj) {
    return null
  }
  const { code } = generate(obj, { compact: true })
  return code
}
