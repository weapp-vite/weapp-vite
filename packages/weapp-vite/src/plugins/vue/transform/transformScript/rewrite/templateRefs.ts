import type { TemplateRefBinding } from '../../../compiler/template/types'
import * as t from '@babel/types'
import logger from '../../../../../logger'
import { createStaticObjectKey, getObjectPropertyByKey } from '../utils'

function buildTemplateRefEntry(binding: TemplateRefBinding): t.ObjectExpression {
  const props: t.ObjectProperty[] = [
    t.objectProperty(t.identifier('selector'), t.stringLiteral(binding.selector)),
    t.objectProperty(t.identifier('inFor'), t.booleanLiteral(binding.inFor)),
  ]

  if (binding.name) {
    props.push(t.objectProperty(t.identifier('name'), t.stringLiteral(binding.name)))
  }

  if (binding.expAst) {
    const body = t.blockStatement([t.returnStatement(t.cloneNode(binding.expAst, true))])
    props.push(t.objectProperty(t.identifier('get'), t.functionExpression(null, [], body)))
  }

  return t.objectExpression(props)
}

export function injectTemplateRefs(
  optionsObject: t.ObjectExpression,
  bindings: TemplateRefBinding[],
): boolean {
  if (!bindings.length) {
    return false
  }

  const entries = bindings.map(binding => buildTemplateRefEntry(binding))
  const refsArray = t.arrayExpression(entries)
  const key = createStaticObjectKey('__wevuTemplateRefs')
  const existing = getObjectPropertyByKey(optionsObject, '__wevuTemplateRefs')

  if (!existing) {
    optionsObject.properties.push(t.objectProperty(key, refsArray))
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

  logger.warn('无法自动注入 template ref 元数据，请手动合并 __wevuTemplateRefs。')
  return false
}
