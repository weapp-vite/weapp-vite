import ts from 'typescript'

export interface WeappGenerateConfigSnapshot {
  filenames: Partial<Record<'component' | 'page', string>>
  dirs: Partial<Record<'component' | 'page', string>>
  srcRoot?: string
}

function getPropertyName(node: ts.PropertyName) {
  if (ts.isIdentifier(node) || ts.isStringLiteral(node)) {
    return node.text
  }

  return null
}

function getObjectProperty(node: ts.ObjectLiteralExpression, name: string) {
  return node.properties.find((property) => {
    return ts.isPropertyAssignment(property)
      && getPropertyName(property.name) === name
  }) as ts.PropertyAssignment | undefined
}

function getObjectLiteral(node: ts.Expression | undefined): ts.ObjectLiteralExpression | null {
  if (!node) {
    return null
  }

  if (ts.isParenthesizedExpression(node)) {
    return getObjectLiteral(node.expression)
  }

  if (ts.isObjectLiteralExpression(node)) {
    return node
  }

  if (ts.isCallExpression(node)) {
    const [firstArgument] = node.arguments

    if (firstArgument) {
      return getObjectLiteral(firstArgument)
    }
  }

  if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
    if (ts.isBlock(node.body)) {
      for (const statement of node.body.statements) {
        if (ts.isReturnStatement(statement)) {
          return getObjectLiteral(statement.expression)
        }
      }

      return null
    }

    return getObjectLiteral(node.body)
  }

  return null
}

function getStringLiteralValue(node: ts.Expression | undefined) {
  if (!node) {
    return null
  }

  if (ts.isStringLiteralLike(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text
  }

  return null
}

function readStringMap(node: ts.ObjectLiteralExpression | null, keys: Array<'component' | 'page'>) {
  const result: Partial<Record<'component' | 'page', string>> = {}

  if (!node) {
    return result
  }

  for (const key of keys) {
    const property = getObjectProperty(node, key)
    const value = getStringLiteralValue(property?.initializer)

    if (value) {
      result[key] = value
    }
  }

  return result
}

function getExportObject(sourceFile: ts.SourceFile) {
  for (const statement of sourceFile.statements) {
    if (ts.isExportAssignment(statement)) {
      return getObjectLiteral(statement.expression)
    }
  }

  return null
}

export function readWeappGenerateConfigSnapshot(sourceText: string) {
  const sourceFile = ts.createSourceFile('vite.config.ts', sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const exportObject = getExportObject(sourceFile)

  if (!exportObject) {
    return null
  }

  const weappProperty = getObjectProperty(exportObject, 'weapp')
  const weappObject = getObjectLiteral(weappProperty?.initializer)

  if (!weappObject) {
    return null
  }

  const generateProperty = getObjectProperty(weappObject, 'generate')
  const generateObject = getObjectLiteral(generateProperty?.initializer)
  const dirsProperty = generateObject ? getObjectProperty(generateObject, 'dirs') : undefined
  const filenamesProperty = generateObject ? getObjectProperty(generateObject, 'filenames') : undefined

  return {
    srcRoot: getStringLiteralValue(getObjectProperty(weappObject, 'srcRoot')?.initializer) ?? undefined,
    dirs: readStringMap(getObjectLiteral(dirsProperty?.initializer), ['component', 'page']),
    filenames: readStringMap(getObjectLiteral(filenamesProperty?.initializer), ['component', 'page']),
  } satisfies WeappGenerateConfigSnapshot
}
