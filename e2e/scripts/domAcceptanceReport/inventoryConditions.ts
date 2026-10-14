import ts from 'typescript'

type ConditionValue = string | number | boolean

function isConditionValue(value: unknown): value is ConditionValue {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
}

/** 属性名和对象简写是引用，不构成对条件变量的词法遮蔽。 */
export function readConditionBindingName(node: ts.Node): string | undefined {
  if (ts.isVariableDeclaration(node) || ts.isParameter(node) || ts.isBindingElement(node)
    || ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node)
    || ts.isClassDeclaration(node) || ts.isClassExpression(node) || ts.isEnumDeclaration(node)
    || ts.isModuleDeclaration(node) || ts.isImportClause(node) || ts.isImportSpecifier(node)
    || ts.isNamespaceImport(node) || ts.isImportEqualsDeclaration(node)) {
    return node.name && ts.isIdentifier(node.name) ? node.name.text : undefined
  }
  return undefined
}

/** 只计算已证明的矩阵值、常量别名与严格比较；未知值不参与分支裁剪。 */
export function readSuiteConditionValue(
  node: ts.Expression | undefined,
  readBinding: (name: string) => unknown,
): ConditionValue | undefined {
  if (!node) {
    return undefined
  }
  if (ts.isAsExpression(node) || ts.isSatisfiesExpression(node) || ts.isParenthesizedExpression(node)) {
    return readSuiteConditionValue(node.expression, readBinding)
  }
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text
  }
  if (node.kind === ts.SyntaxKind.TrueKeyword || node.kind === ts.SyntaxKind.FalseKeyword) {
    return node.kind === ts.SyntaxKind.TrueKeyword
  }
  if (ts.isNumericLiteral(node)) {
    return Number(node.text)
  }
  if (ts.isIdentifier(node)) {
    const value = readBinding(node.text)
    return isConditionValue(value) ? value : undefined
  }
  if (ts.isBinaryExpression(node)
    && (node.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken
      || node.operatorToken.kind === ts.SyntaxKind.ExclamationEqualsEqualsToken)) {
    const left = readSuiteConditionValue(node.left, readBinding)
    const right = readSuiteConditionValue(node.right, readBinding)
    if (left !== undefined && right !== undefined) {
      return node.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken ? left === right : left !== right
    }
  }
  return undefined
}
