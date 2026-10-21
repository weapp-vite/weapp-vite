import type { AcceptanceReport } from './types'
import path from 'node:path'
import ts from 'typescript'
import { readSuiteConditionValue } from './inventoryConditions'

export type AcceptanceProvider = AcceptanceReport['provider']

export interface ProviderCaseApplicability {
  providers: AcceptanceProvider[]
  conditions: Array<{ modifier: 'runIf' | 'skipIf', expression: string, source: string }>
}

const PROVIDERS: AcceptanceProvider[] = ['devtools', 'headless']

function rootName(node: ts.Expression): string {
  if (ts.isIdentifier(node)) {
    return node.text
  }
  return ts.isPropertyAccessExpression(node) || ts.isCallExpression(node) ? rootName(node.expression) : ''
}

/** 只证明可信 provider 常量上的声明条件；未知条件和普通 skip 不产生范围豁免。 */
export function createProviderApplicabilityReader(source: ts.SourceFile, file: string, uncertainBindings: Set<string>, calledName: (name: string) => string) {
  const resolvers = new Set<string>()
  const declarations = new Map<string, ts.Expression>()
  const vitest = new Map<string, string>()
  for (const statement of source.statements) {
    if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)
      && statement.importClause?.namedBindings && !statement.importClause.isTypeOnly && ts.isNamedImports(statement.importClause.namedBindings)) {
      const specifier = statement.moduleSpecifier.text
      const module = path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier)).replace(/\.ts$/, '')
      for (const item of statement.importClause.namedBindings.elements) {
        if (item.isTypeOnly) {
          continue
        }
        const original = item.propertyName?.text ?? item.name.text
        if (module === 'e2e/utils/runtimeProvider' && original === 'resolveRuntimeProviderName') {
          resolvers.add(item.name.text)
        }
        if (specifier === 'vitest' && ['it', 'test', 'describe'].includes(original)) {
          vitest.set(item.name.text, original)
        }
      }
    }
    if (ts.isVariableStatement(statement) && (statement.declarationList.flags & ts.NodeFlags.Const)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name) && declaration.initializer) {
          declarations.set(declaration.name.text, declaration.initializer)
        }
      }
    }
  }

  function evaluate(node: ts.Expression, provider: AcceptanceProvider, visiting = new Set<string>()): { value: unknown, usesProvider: boolean } {
    if (ts.isAsExpression(node) || ts.isSatisfiesExpression(node) || ts.isParenthesizedExpression(node)) {
      return evaluate(node.expression, provider, visiting)
    }
    if (visiting.size && ts.isCallExpression(node) && ts.isIdentifier(node.expression) && resolvers.has(node.expression.text)
      && !uncertainBindings.has(node.expression.text) && node.arguments.length === 0) {
      return { value: provider, usesProvider: true }
    }
    if (ts.isIdentifier(node) && declarations.has(node.text) && !uncertainBindings.has(node.text) && !visiting.has(node.text)) {
      return evaluate(declarations.get(node.text)!, provider, new Set([...visiting, node.text]))
    }
    if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.ExclamationToken) {
      const operand = evaluate(node.operand, provider, visiting)
      return { value: typeof operand.value === 'boolean' ? !operand.value : undefined, usesProvider: operand.usesProvider }
    }
    if (ts.isBinaryExpression(node)) {
      const left = evaluate(node.left, provider, visiting)
      const right = evaluate(node.right, provider, visiting)
      const usesProvider = left.usesProvider || right.usesProvider
      if (left.value !== undefined && right.value !== undefined) {
        if (node.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken) {
          return { value: left.value === right.value, usesProvider }
        }
        if (node.operatorToken.kind === ts.SyntaxKind.ExclamationEqualsEqualsToken) {
          return { value: left.value !== right.value, usesProvider }
        }
        if (typeof left.value === 'boolean' && typeof right.value === 'boolean') {
          if (node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) {
            return { value: left.value && right.value, usesProvider }
          }
          if (node.operatorToken.kind === ts.SyntaxKind.BarBarToken) {
            return { value: left.value || right.value, usesProvider }
          }
        }
      }
      return { value: undefined, usesProvider }
    }
    return { value: readSuiteConditionValue(node, () => undefined), usesProvider: false }
  }

  function hasUnprovenSkipOptions(call: ts.CallExpression) {
    return call.arguments.slice(1).some((argument) => {
      if (ts.isArrowFunction(argument) || ts.isFunctionExpression(argument)
        || typeof evaluate(argument, 'devtools').value === 'number') {
        return false
      }
      if (!ts.isObjectLiteralExpression(argument)) {
        return true
      }
      return argument.properties.some((property) => {
        if (ts.isSpreadAssignment(property) || !property.name
          || (!ts.isIdentifier(property.name) && !ts.isStringLiteral(property.name))) {
          return true
        }
        if (property.name.text === '__proto__') {
          return true
        }
        if (!['skip', 'todo'].includes(property.name.text)) {
          return false
        }
        return !ts.isPropertyAssignment(property)
          || PROVIDERS.some(provider => evaluate(property.initializer, provider).value !== false)
      })
    })
  }

  return (test: ts.CallExpression): ProviderCaseApplicability | undefined => {
    const testRoot = rootName(test.expression)
    if (uncertainBindings.has(testRoot) || !['it', 'test'].includes(vitest.get(testRoot) ?? '')) {
      return undefined
    }
    let providers = [...PROVIDERS]
    const conditions: ProviderCaseApplicability['conditions'] = []
    for (let ancestor: ts.Node | undefined = test; ancestor; ancestor = ancestor.parent) {
      if (!ts.isCallExpression(ancestor)) {
        continue
      }
      const root = rootName(ancestor.expression)
      const kind = !uncertainBindings.has(root) && vitest.get(root)
      if (ancestor !== test && calledName(root).startsWith('describe') && kind !== 'describe') {
        return undefined
      }
      if (!kind || (ancestor !== test && kind !== 'describe')) {
        continue
      }
      if (hasUnprovenSkipOptions(ancestor)) {
        return undefined
      }
      let expression: ts.Expression = ancestor.expression
      while (ts.isPropertyAccessExpression(expression) || ts.isCallExpression(expression)) {
        if (ts.isPropertyAccessExpression(expression) && ['skip', 'todo'].includes(expression.name.text)) {
          return undefined
        }
        if (ts.isCallExpression(expression) && ts.isPropertyAccessExpression(expression.expression)
          && ['runIf', 'skipIf'].includes(expression.expression.name.text)) {
          const condition = expression.arguments[0]
          if (!condition || expression.arguments.length !== 1) {
            return undefined
          }
          const results = PROVIDERS.map(provider => ({ provider, ...evaluate(condition, provider) }))
          if (results.some(result => !result.usesProvider || typeof result.value !== 'boolean')) {
            return undefined
          }
          const modifier = expression.expression.name.text as 'runIf' | 'skipIf'
          providers = providers.filter(provider => results.find(result => result.provider === provider)!.value === (modifier === 'runIf'))
          conditions.push({ modifier, expression: condition.getText().replace(/\s+/g, ' '), source: `${file}:${source.getLineAndCharacterOfPosition(expression.getStart()).line + 1}` })
        }
        expression = expression.expression
      }
    }
    return conditions.length && providers.length ? { providers, conditions } : undefined
  }
}
