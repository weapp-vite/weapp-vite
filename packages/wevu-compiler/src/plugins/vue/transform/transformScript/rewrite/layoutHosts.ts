import type { LayoutHostBinding } from '../../../compiler/template/types'
import * as t from '@weapp-vite/ast/babelTypes'
import { resolveWarnHandler } from '../../../../../utils/warn'
import { createStaticObjectKey, getObjectPropertyByKey } from '../utils'

function buildLayoutHostEntry(binding: LayoutHostBinding): t.ObjectExpression {
  const props: t.ObjectProperty[] = [
    t.objectProperty(t.identifier('key'), t.stringLiteral(binding.key)),
  ]

  if (binding.refName) {
    props.push(t.objectProperty(t.identifier('refName'), t.stringLiteral(binding.refName)))
  }

  props.push(t.objectProperty(t.identifier('selector'), t.stringLiteral(binding.selector)))

  if (binding.kind) {
    props.push(t.objectProperty(t.identifier('kind'), t.stringLiteral(binding.kind)))
  }

  return t.objectExpression(props)
}

export function injectLayoutHosts(
  optionsObject: t.ObjectExpression,
  bindings: LayoutHostBinding[],
  warn?: (message: string) => void,
): boolean {
  if (!bindings.length) {
    return false
  }
  const warnHandler = resolveWarnHandler(warn)
  const entries = bindings.map(binding => buildLayoutHostEntry(binding))
  const hostsArray = t.arrayExpression(entries)
  const key = createStaticObjectKey('__wevuLayoutHosts')
  const existing = getObjectPropertyByKey(optionsObject, '__wevuLayoutHosts')

  if (!existing) {
    optionsObject.properties.push(t.objectProperty(key, hostsArray))
    return true
  }

  if (t.isArrayExpression(existing.value)) {
    existing.value.elements.push(...entries)
    return true
  }

  if (t.isIdentifier(existing.value) || t.isMemberExpression(existing.value)) {
    existing.value = t.arrayExpression([
      ...entries,
      t.spreadElement(t.cloneNode(existing.value, true)),
    ])
    return true
  }

  warnHandler('无法自动注入 layout host 元数据，请手动合并 __wevuLayoutHosts。')
  return false
}
