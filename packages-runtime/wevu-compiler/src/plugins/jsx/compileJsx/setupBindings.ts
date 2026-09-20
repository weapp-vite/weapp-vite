import type { Expression, ObjectExpression } from '@weapp-vite/ast/babelTypes'
import type { JsxCompileContext } from './types'
import { getObjectPropertyByKey, unwrapTypeScriptExpression } from '@weapp-vite/ast'
import * as t from '@weapp-vite/ast/babelTypes'

const REF_FACTORIES = new Set(['ref', 'shallowRef', 'computed', 'customRef', 'toRef', 'useModel', 'useTemplateRef'])
const REF_OBJECT_FACTORIES = new Set(['toRefs', 'storeToRefs'])

export function resolveSetupFunction(component: ObjectExpression) {
  const setup = getObjectPropertyByKey(component, 'setup')
  if (t.isObjectMethod(setup)) {
    return setup
  }
  if (t.isObjectProperty(setup) && (t.isFunctionExpression(setup.value) || t.isArrowFunctionExpression(setup.value))) {
    return setup.value
  }
  return undefined
}

export function collectSetupRefBindings(component: ObjectExpression, context: JsxCompileContext) {
  const setup = resolveSetupFunction(component)
  const refs = new Set<string>()
  if (!setup || !t.isBlockStatement(setup.body)) {
    return refs
  }
  const declarations = setup.body.body.flatMap(statement => t.isVariableDeclaration(statement) ? statement.declarations : [])
  const stableDeclarations = new Set(setup.body.body.flatMap(statement => t.isVariableDeclaration(statement) && statement.kind === 'const' ? statement.declarations : []))
  const locals = new Set(declarations.flatMap(declaration => Object.keys(t.getBindingIdentifiers(declaration.id))))
  for (const statement of setup.body.body) {
    if (t.isFunctionDeclaration(statement) && statement.id) {
      locals.add(statement.id.name)
    }
  }
  for (const parameter of setup.params) {
    Object.keys(t.getBindingIdentifiers(parameter)).forEach(name => locals.add(name))
  }
  function importedApi(expression: Expression) {
    if (t.isIdentifier(expression) && !locals.has(expression.name)) {
      const imported = context.importedBindings?.get(expression.name)
      return imported && ['wevu', 'vue'].includes(imported.source) ? imported.importedName : undefined
    }
    if (t.isMemberExpression(expression) && !expression.computed && t.isIdentifier(expression.object) && t.isIdentifier(expression.property) && !locals.has(expression.object.name)) {
      const imported = context.importedBindings?.get(expression.object.name)
      return imported?.importedName === '*' && ['wevu', 'vue'].includes(imported.source) ? expression.property.name : undefined
    }
    return undefined
  }
  function isRef(expression: Expression): boolean {
    const value = unwrapTypeScriptExpression(expression)
    if (t.isIdentifier(value)) {
      return refs.has(value.name)
    }
    if (!t.isCallExpression(value) || !t.isExpression(value.callee)) {
      return false
    }
    const api = importedApi(value.callee)
    if (api && REF_FACTORIES.has(api)) {
      return true
    }
    const first = value.arguments[0]
    return (api === 'readonly' || api === 'shallowReadonly') && t.isExpression(first) && isRef(first)
  }
  for (const declaration of declarations) {
    // 只有不可重新绑定的局部变量，才能静态保证其始终遵守 ref 解包契约。
    if (!declaration.init || !stableDeclarations.has(declaration)) {
      continue
    }
    if (t.isIdentifier(declaration.id) && isRef(declaration.init)) {
      refs.add(declaration.id.name)
    }
    else if (t.isObjectPattern(declaration.id) && t.isCallExpression(declaration.init) && t.isExpression(declaration.init.callee)) {
      const api = importedApi(declaration.init.callee)
      if (api && REF_OBJECT_FACTORIES.has(api)) {
        for (const property of declaration.id.properties) {
          if (t.isObjectProperty(property) && t.isIdentifier(property.value)) {
            refs.add(property.value.name)
          }
        }
      }
    }
  }
  return refs
}
