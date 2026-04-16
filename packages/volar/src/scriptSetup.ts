import type ts from 'typescript'
import {
  DEFINE_OPTIONS_NAME,
  IDENTIFIER_NAME_RE,
  JS_LANG,
  TS_LANG,
  TS_SCRIPT_KIND_JS,
  TS_SCRIPT_KIND_TS,
  TS_SCRIPT_TARGET_LATEST,
  WXS_MODULE_RE,
} from './constants'

export function collectWxsModuleNames(templateContent?: string) {
  if (!templateContent) {
    return []
  }
  const names = new Set<string>()
  for (const match of templateContent.matchAll(WXS_MODULE_RE)) {
    const name = match[1] ?? match[2]
    if (name) {
      names.add(name)
    }
  }
  return [...names]
}

export function createWxsModuleDeclarations(moduleNames: string[]) {
  if (!moduleNames.length) {
    return ''
  }
  return moduleNames
    .map(name => `const ${name} = {} as Record<string, (...args: any[]) => any>`)
    .join('\n')
}

export function appendWxsDeclarations(code: string, moduleNames: string[]) {
  const declarations = createWxsModuleDeclarations(moduleNames)
  if (!declarations) {
    return code
  }
  return code
    ? `${code}\n\n${declarations}\n`
    : `${declarations}\n`
}

export function appendScriptSetupDeclarations(code: string, declarations: string) {
  if (!declarations) {
    return code
  }
  return code
    ? `${code}\n\n${declarations}\n`
    : `${declarations}\n`
}

export function createSyntheticScriptSetup(moduleNames: string[]) {
  const content = createWxsModuleDeclarations(moduleNames)
  if (!content) {
    return undefined
  }
  return {
    type: 'script',
    content,
    loc: {
      source: `<script setup lang="ts">\n${content}\n</script>`,
      start: { column: 1, line: 1, offset: 0 },
      end: { column: 1, line: 1, offset: 0 },
    },
    attrs: {
      setup: true,
      lang: 'ts',
    },
    lang: 'ts',
    setup: true,
    name: 'scriptSetup',
  }
}

export function syncScriptBlockSource(
  block: {
    content: string
    attrs?: Record<string, string | true>
    loc: { source: string }
  } | null | undefined,
) {
  if (!block) {
    return
  }
  const attrs = Object.entries(block.attrs ?? {})
    .filter(([, value]) => value != null)
    .map(([key, value]) => value === true ? key : `${key}="${String(value)}"`)
    .join(' ')
  const openTag = attrs ? `<script ${attrs}>` : '<script>'
  block.loc.source = `${openTag}\n${block.content}\n</script>`
}

function isIdentifierName(name: string) {
  return IDENTIFIER_NAME_RE.test(name)
}

function getPropertyNameText(node: ts.PropertyName | ts.BindingName, tsModule: typeof ts) {
  if (tsModule.isIdentifier(node) || tsModule.isStringLiteral(node) || tsModule.isNumericLiteral(node)) {
    return node.text
  }
  return undefined
}

function collectBindingNames(
  name: ts.BindingName,
  tsModule: typeof ts,
  bindings: Set<string>,
) {
  if (tsModule.isIdentifier(name)) {
    bindings.add(name.text)
    return
  }
  for (const element of name.elements) {
    if (tsModule.isBindingElement(element)) {
      collectBindingNames(element.name, tsModule, bindings)
    }
  }
}

function collectTopLevelBindingNames(code: string, tsModule: typeof ts, lang: string) {
  const scriptKind = lang === TS_LANG ? TS_SCRIPT_KIND_TS : TS_SCRIPT_KIND_JS
  const sourceFile = tsModule.createSourceFile(
    `bindings.${lang}`,
    code,
    TS_SCRIPT_TARGET_LATEST,
    true,
    scriptKind,
  )
  const bindings = new Set<string>()

  for (const statement of sourceFile.statements) {
    if (tsModule.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        collectBindingNames(declaration.name, tsModule, bindings)
      }
      continue
    }
    if ((tsModule.isFunctionDeclaration(statement)
      || tsModule.isClassDeclaration(statement)
      || tsModule.isEnumDeclaration(statement))
    && statement.name) {
      bindings.add(statement.name.text)
      continue
    }
    if (tsModule.isImportDeclaration(statement) && statement.importClause) {
      const { importClause } = statement
      if (importClause.name) {
        bindings.add(importClause.name.text)
      }
      if (importClause.namedBindings) {
        if (tsModule.isNamespaceImport(importClause.namedBindings)) {
          bindings.add(importClause.namedBindings.name.text)
        }
        else {
          for (const element of importClause.namedBindings.elements) {
            bindings.add(element.name.text)
          }
        }
      }
    }
  }

  return bindings
}

function unwrapParenthesizedExpression(node: ts.Expression, tsModule: typeof ts): ts.Expression {
  let current = node
  while (tsModule.isParenthesizedExpression(current)) {
    current = current.expression
  }
  return current
}

function findReturnedObjectLiteral(node: ts.ConciseBody, tsModule: typeof ts) {
  if (tsModule.isObjectLiteralExpression(node)) {
    return node
  }
  if (!tsModule.isBlock(node)) {
    return undefined
  }
  for (const statement of node.statements) {
    if (!tsModule.isReturnStatement(statement) || !statement.expression) {
      continue
    }
    const expression = unwrapParenthesizedExpression(statement.expression, tsModule)
    if (tsModule.isObjectLiteralExpression(expression)) {
      return expression
    }
  }
  return undefined
}

function extractDefineOptionsObjectLiteral(node: ts.CallExpression, tsModule: typeof ts) {
  if (!tsModule.isIdentifier(node.expression) || node.expression.text !== DEFINE_OPTIONS_NAME) {
    return undefined
  }
  const [firstArg] = node.arguments
  if (!firstArg) {
    return undefined
  }
  const arg = unwrapParenthesizedExpression(firstArg, tsModule)
  if (tsModule.isObjectLiteralExpression(arg)) {
    return arg
  }
  if (tsModule.isArrowFunction(arg) || tsModule.isFunctionExpression(arg)) {
    return findReturnedObjectLiteral(arg.body, tsModule)
  }
  return undefined
}

function collectObjectLiteralKeys(node: ts.ObjectLiteralExpression, tsModule: typeof ts) {
  const keys: string[] = []
  for (const property of node.properties) {
    if (!tsModule.isPropertyAssignment(property)
      && !tsModule.isMethodDeclaration(property)
      && !tsModule.isShorthandPropertyAssignment(property)
      && !tsModule.isGetAccessorDeclaration(property)) {
      continue
    }
    const key = getPropertyNameText(property.name, tsModule)
    if (key && isIdentifierName(key)) {
      keys.push(key)
    }
  }
  return keys
}

function setBindingType(map: Map<string, string>, name: string, typeText: string) {
  if (!map.has(name)) {
    map.set(name, typeText)
  }
}

function getRuntimeConstructorType(node: ts.Expression, tsModule: typeof ts): string | null {
  if (tsModule.isIdentifier(node)) {
    if (node.text === 'String') {
      return 'string'
    }
    if (node.text === 'Number') {
      return 'number'
    }
    if (node.text === 'Boolean') {
      return 'boolean'
    }
    if (node.text === 'Array') {
      return 'any[]'
    }
    if (node.text === 'Object') {
      return 'Record<string, any>'
    }
  }

  if (tsModule.isArrayLiteralExpression(node)) {
    const types = [...new Set(
      node.elements
        .map((element) => {
          if (tsModule.isSpreadElement(element)) {
            return null
          }
          return getRuntimeConstructorType(element, tsModule)
        })
        .filter((typeText): typeText is string => Boolean(typeText)),
    )]

    return types.length > 0
      ? types.join(' | ')
      : null
  }

  return null
}

function getMiniProgramPropertyType(node: ts.Expression, tsModule: typeof ts) {
  const runtimeType = getRuntimeConstructorType(node, tsModule)

  if (runtimeType) {
    return runtimeType
  }

  if (!tsModule.isObjectLiteralExpression(node)) {
    return 'any'
  }

  for (const property of node.properties) {
    if (!tsModule.isPropertyAssignment(property)) {
      continue
    }

    const name = getPropertyNameText(property.name, tsModule)

    if (name !== 'type') {
      continue
    }

    return getRuntimeConstructorType(
      unwrapParenthesizedExpression(property.initializer, tsModule),
      tsModule,
    ) ?? 'any'
  }

  return 'any'
}

function getExpressionTypeText(
  node: ts.Expression,
  tsModule: typeof ts,
  sourceFile: ts.SourceFile,
): string {
  const expression = unwrapParenthesizedExpression(node, tsModule)

  if (tsModule.isAsExpression(expression) || tsModule.isTypeAssertionExpression(expression)) {
    return expression.type.getText(sourceFile)
  }

  if (tsModule.isStringLiteral(expression) || tsModule.isNoSubstitutionTemplateLiteral(expression)) {
    return 'string'
  }

  if (tsModule.isNumericLiteral(expression)) {
    return 'number'
  }

  if (expression.kind === tsModule.SyntaxKind.TrueKeyword || expression.kind === tsModule.SyntaxKind.FalseKeyword) {
    return 'boolean'
  }

  if (tsModule.isPrefixUnaryExpression(expression) && tsModule.isNumericLiteral(expression.operand)) {
    return 'number'
  }

  if (tsModule.isArrayLiteralExpression(expression)) {
    const itemTypes = [...new Set(
      expression.elements
        .map((element) => {
          if (tsModule.isSpreadElement(element)) {
            return null
          }
          return getExpressionTypeText(element, tsModule, sourceFile)
        })
        .filter((typeText): typeText is string => Boolean(typeText) && typeText !== 'undefined'),
    )]

    if (itemTypes.length === 0) {
      return 'any[]'
    }

    return itemTypes.length === 1
      ? `${itemTypes[0]}[]`
      : `(${itemTypes.join(' | ')})[]`
  }

  if (tsModule.isObjectLiteralExpression(expression)) {
    const fields: string[] = []

    for (const property of expression.properties) {
      if (tsModule.isPropertyAssignment(property)) {
        const name = getPropertyNameText(property.name, tsModule)

        if (name) {
          fields.push(`${name}: ${getExpressionTypeText(property.initializer, tsModule, sourceFile)}`)
        }
        continue
      }

      if (tsModule.isShorthandPropertyAssignment(property)) {
        fields.push(`${property.name.text}: any`)
        continue
      }

      if (tsModule.isMethodDeclaration(property) || tsModule.isGetAccessorDeclaration(property)) {
        const name = getPropertyNameText(property.name, tsModule)

        if (name) {
          fields.push(`${name}: (...args: any[]) => any`)
        }
      }
    }

    return fields.length > 0
      ? `{ ${fields.join('; ')} }`
      : 'Record<string, any>'
  }

  if (tsModule.isArrowFunction(expression) || tsModule.isFunctionExpression(expression)) {
    return '(...args: any[]) => any'
  }

  if (tsModule.isIdentifier(expression) && expression.text === 'undefined') {
    return 'undefined'
  }

  return 'any'
}

function collectDefineOptionsTemplateBindings(code: string, tsModule: typeof ts, lang: string) {
  const scriptKind = lang === TS_LANG ? TS_SCRIPT_KIND_TS : TS_SCRIPT_KIND_JS
  const sourceFile = tsModule.createSourceFile(
    `script-setup.${lang}`,
    code,
    TS_SCRIPT_TARGET_LATEST,
    true,
    scriptKind,
  )

  const valueBindings = new Map<string, string>()
  const functionBindings = new Set<string>()

  const visit = (node: ts.Node) => {
    if (tsModule.isCallExpression(node)) {
      const optionsObject = extractDefineOptionsObjectLiteral(node, tsModule)
      if (optionsObject) {
        for (const property of optionsObject.properties) {
          const sectionName = (tsModule.isPropertyAssignment(property)
            || tsModule.isMethodDeclaration(property))
            ? getPropertyNameText(property.name, tsModule)
            : undefined

          if (!sectionName) {
            continue
          }

          if (sectionName === 'methods') {
            const methodsObject = tsModule.isPropertyAssignment(property)
              ? unwrapParenthesizedExpression(property.initializer, tsModule)
              : undefined
            if (methodsObject && tsModule.isObjectLiteralExpression(methodsObject)) {
              for (const name of collectObjectLiteralKeys(methodsObject, tsModule)) {
                functionBindings.add(name)
              }
            }
            continue
          }

          if (sectionName === 'properties' || sectionName === 'computed') {
            const objectValue = tsModule.isPropertyAssignment(property)
              ? unwrapParenthesizedExpression(property.initializer, tsModule)
              : undefined
            if (objectValue && tsModule.isObjectLiteralExpression(objectValue)) {
              for (const entry of objectValue.properties) {
                if (!tsModule.isPropertyAssignment(entry)
                  && !tsModule.isMethodDeclaration(entry)
                  && !tsModule.isShorthandPropertyAssignment(entry)
                  && !tsModule.isGetAccessorDeclaration(entry)) {
                  continue
                }

                const name = getPropertyNameText(entry.name, tsModule)

                if (!name || !isIdentifierName(name)) {
                  continue
                }

                const typeText = sectionName === 'properties' && tsModule.isPropertyAssignment(entry)
                  ? getMiniProgramPropertyType(
                      unwrapParenthesizedExpression(entry.initializer, tsModule),
                      tsModule,
                    )
                  : 'any'

                setBindingType(valueBindings, name, typeText)
              }
            }
            continue
          }

          if (sectionName === 'data') {
            let dataObject: ts.ObjectLiteralExpression | undefined
            if (tsModule.isMethodDeclaration(property)) {
              dataObject = findReturnedObjectLiteral(property.body ?? tsModule.factory.createBlock([], false), tsModule)
            }
            else if (tsModule.isPropertyAssignment(property)) {
              const initializer = unwrapParenthesizedExpression(property.initializer, tsModule)
              if (tsModule.isObjectLiteralExpression(initializer)) {
                dataObject = initializer
              }
              else if (tsModule.isArrowFunction(initializer) || tsModule.isFunctionExpression(initializer)) {
                dataObject = findReturnedObjectLiteral(initializer.body, tsModule)
              }
            }
            if (dataObject) {
              for (const property of dataObject.properties) {
                if (!tsModule.isPropertyAssignment(property)
                  && !tsModule.isMethodDeclaration(property)
                  && !tsModule.isShorthandPropertyAssignment(property)
                  && !tsModule.isGetAccessorDeclaration(property)) {
                  continue
                }

                const name = getPropertyNameText(property.name, tsModule)

                if (!name || !isIdentifierName(name)) {
                  continue
                }

                const typeText = tsModule.isPropertyAssignment(property)
                  ? getExpressionTypeText(property.initializer, tsModule, sourceFile)
                  : '(...args: any[]) => any'

                setBindingType(valueBindings, name, typeText)
              }
            }
          }
        }
      }
    }
    tsModule.forEachChild(node, visit)
  }

  visit(sourceFile)
  return {
    values: [...valueBindings],
    functions: [...functionBindings],
  }
}

export function createDefineOptionsTemplateDeclarations(
  code: string,
  tsModule: typeof ts,
  lang: string,
) {
  const topLevelBindings = collectTopLevelBindingNames(code, tsModule, lang)
  const bindings = collectDefineOptionsTemplateBindings(code, tsModule, lang)
  const declarations: string[] = []

  for (const [name, typeText] of bindings.values) {
    if (topLevelBindings.has(name)) {
      continue
    }
    declarations.push(`const ${name}: ${typeText} = null as any`)
  }

  for (const name of bindings.functions) {
    if (topLevelBindings.has(name)) {
      continue
    }
    declarations.push(`const ${name}: (...args: any[]) => any = null as any`)
  }

  return declarations.join('\n')
}

export function resolveScriptSetupLang(lang?: string) {
  return lang === JS_LANG ? JS_LANG : TS_LANG
}
