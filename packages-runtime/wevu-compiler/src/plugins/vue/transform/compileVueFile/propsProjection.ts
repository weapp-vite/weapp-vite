import type { Node } from '@weapp-vite/ast/babelTypes'
import * as t from '@weapp-vite/ast/babelTypes'
import { parseJsLike } from '../../../../utils/babel'

function propertyName(node: Node) {
  return t.isIdentifier(node) ? node.name : t.isStringLiteral(node) ? node.value : undefined
}

/** 从最终 props 选项识别冲突；外部声明保守投影，避免把 setup 状态回写为宿主属性。 */
export function resolveSetupPropConflicts(
  script: string,
  bindings: Record<string, unknown> | undefined,
  getScriptAst = () => parseJsLike(script),
): string[] | undefined {
  if (!/\bprops\s*:/.test(script)) {
    return undefined
  }
  let setupKeys = Object.entries(bindings ?? {})
    .filter(([, kind]) => typeof kind === 'string' && (kind.startsWith('setup-') || kind === 'literal-const'))
    .map(([key]) => key)
  if (!setupKeys.length) {
    return undefined
  }
  const ast = getScriptAst()
  const declarations = new Map<string, t.Expression>()
  for (const statement of ast.program.body) {
    if (!t.isVariableDeclaration(statement)) {
      continue
    }
    for (const declaration of statement.declarations) {
      if (t.isIdentifier(declaration.id) && declaration.init) {
        declarations.set(declaration.id.name, declaration.init)
      }
    }
  }
  const findOption = (node: Node, name: string, visited = new Set<string>()): Node | undefined => {
    if (t.isIdentifier(node) && !visited.has(node.name)) {
      visited.add(node.name)
      const declaration = declarations.get(node.name)
      return declaration ? findOption(declaration, name, visited) : undefined
    }
    if (t.isObjectExpression(node)) {
      for (const property of [...node.properties].reverse()) {
        if ((t.isObjectProperty(property) || t.isObjectMethod(property)) && !property.computed && propertyName(property.key) === name) {
          return t.isObjectProperty(property) ? property.value : property
        }
        if (t.isSpreadElement(property)) {
          const inherited = findOption(property.argument, name, visited)
          if (inherited) {
            return inherited
          }
        }
      }
    }
    if (t.isCallExpression(node)) {
      for (const argument of [...node.arguments].reverse()) {
        const props = findOption(argument, name, visited)
        if (props) {
          return props
        }
      }
    }
    if (t.isTSAsExpression(node) || t.isTSSatisfiesExpression(node)) {
      return findOption(node.expression, name, visited)
    }
  }
  const exported = ast.program.body.find(statement => t.isExportDefaultDeclaration(statement))
  const props = exported && t.isExportDefaultDeclaration(exported) ? findOption(exported.declaration, 'props') : undefined
  if (!props) {
    return undefined
  }
  const setup = exported && t.isExportDefaultDeclaration(exported) ? findOption(exported.declaration, 'setup') : undefined
  if (setup && (t.isObjectMethod(setup) || t.isFunctionExpression(setup) || t.isArrowFunctionExpression(setup))
    && t.isIdentifier(setup.params[0]) && t.isBlockStatement(setup.body)) {
    const propsBindings = new Set<string>()
    for (const statement of setup.body.body) {
      if (!t.isVariableDeclaration(statement)) {
        continue
      }
      for (const declaration of statement.declarations) {
        if (t.isIdentifier(declaration.id) && t.isIdentifier(declaration.init, { name: setup.params[0].name })) {
          propsBindings.add(declaration.id.name)
        }
      }
    }
    setupKeys = setupKeys.filter(key => !propsBindings.has(key))
  }
  const names = new Set<string>()
  if (t.isObjectExpression(props)) {
    for (const property of props.properties) {
      if (!t.isObjectProperty(property) || property.computed) {
        return setupKeys
      }
      const name = propertyName(property.key)
      if (name === undefined) {
        return setupKeys
      }
      names.add(name)
    }
  }
  else if (t.isArrayExpression(props) && props.elements.every(element => t.isStringLiteral(element))) {
    for (const element of props.elements) {
      names.add((element as t.StringLiteral).value)
    }
  }
  else {
    return setupKeys
  }
  return setupKeys.filter(key => names.has(key))
}
