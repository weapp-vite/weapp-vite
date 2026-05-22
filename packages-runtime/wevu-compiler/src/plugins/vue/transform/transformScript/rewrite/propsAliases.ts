import { WEVU_PROPS_ALIASES_KEY, WEVU_PROPS_DERIVED_KEYS_KEY } from '@weapp-core/constants'
import * as t from '@weapp-vite/ast/babelTypes'
import { createStaticObjectKey, getObjectPropertyByKey } from '../utils'

export function injectPropsAliases(
  optionsObject: t.ObjectExpression,
  propsAliases: Record<string, string> | undefined,
) {
  const entries = Object.entries(propsAliases ?? {})
    .filter(([alias, propName]) => alias && propName)
    .map(([alias, propName]) => {
      return t.objectProperty(createStaticObjectKey(alias), t.stringLiteral(propName))
    })
  if (!entries.length) {
    return false
  }
  if (getObjectPropertyByKey(optionsObject, WEVU_PROPS_ALIASES_KEY)) {
    return false
  }
  optionsObject.properties.push(
    t.objectProperty(
      createStaticObjectKey(WEVU_PROPS_ALIASES_KEY),
      t.objectExpression(entries),
    ),
  )
  return true
}

export function injectPropsDerivedKeys(
  optionsObject: t.ObjectExpression,
  propsDerivedKeys: string[] | undefined,
) {
  const keys = [...new Set(propsDerivedKeys ?? [])].filter(Boolean)
  if (!keys.length) {
    return false
  }
  if (getObjectPropertyByKey(optionsObject, WEVU_PROPS_DERIVED_KEYS_KEY)) {
    return false
  }
  optionsObject.properties.push(
    t.objectProperty(
      createStaticObjectKey(WEVU_PROPS_DERIVED_KEYS_KEY),
      t.arrayExpression(keys.map(key => t.stringLiteral(key))),
    ),
  )
  return true
}
