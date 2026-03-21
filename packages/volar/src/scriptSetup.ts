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

function collectDefineOptionsTemplateBindings(code: string, tsModule: typeof ts, lang: string) {
  const scriptKind = lang === TS_LANG ? TS_SCRIPT_KIND_TS : TS_SCRIPT_KIND_JS
  const sourceFile = tsModule.createSourceFile(
    `script-setup.${lang}`,
    code,
    TS_SCRIPT_TARGET_LATEST,
    true,
    scriptKind,
  )

  const valueBindings = new Set<string>()
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
              for (const name of collectObjectLiteralKeys(objectValue, tsModule)) {
                valueBindings.add(name)
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
              if (tsModule.isArrowFunction(initializer) || tsModule.isFunctionExpression(initializer)) {
                dataObject = findReturnedObjectLiteral(initializer.body, tsModule)
              }
            }
            if (dataObject) {
              for (const name of collectObjectLiteralKeys(dataObject, tsModule)) {
                valueBindings.add(name)
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

  for (const name of bindings.values) {
    if (topLevelBindings.has(name)) {
      continue
    }
    declarations.push(`const ${name}: any = null as any`)
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
