import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

export interface CaseInventory {
  source: string
  name: string
  plans: Array<{ registration: string, fixture: string, checkpoints: string, source: string }>
  routes: string[]
  operations: string[]
  notes: string[]
}

type Bindings = Map<string, unknown>

function expression(node: ts.Node | undefined) {
  return node?.getText().replace(/\s+/g, ' ').slice(0, 240) ?? '<missing>'
}

function unwrap(node: ts.Expression): ts.Expression {
  return ts.isAsExpression(node) || ts.isSatisfiesExpression(node) || ts.isParenthesizedExpression(node) ? unwrap(node.expression) : node
}

function readLiteral(node: ts.Expression | undefined, bindings: Bindings): unknown {
  if (!node) {
    return undefined
  }
  node = unwrap(node)
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text
  }
  if (ts.isNumericLiteral(node)) {
    return Number(node.text)
  }
  if (ts.isIdentifier(node)) {
    return bindings.get(node.text)
  }
  if (ts.isPropertyAccessExpression(node)) {
    const value = readLiteral(node.expression, bindings)
    return value && typeof value === 'object' ? (value as Record<string, unknown>)[node.name.text] : undefined
  }
  if (ts.isArrayLiteralExpression(node)) {
    const items = node.elements.map(item => readLiteral(item as ts.Expression, bindings))
    return items.every(item => item !== undefined) ? items : undefined
  }
  if (ts.isTemplateExpression(node)) {
    let text = node.head.text
    for (const span of node.templateSpans) {
      const value = readLiteral(span.expression, bindings)
      text += `${value ?? `\${${expression(span.expression)}}`}${span.literal.text}`
    }
    return text
  }
  return undefined
}

function callRoot(node: ts.Expression): string {
  if (ts.isIdentifier(node)) {
    return node.text
  }
  if (ts.isPropertyAccessExpression(node) || ts.isCallExpression(node)) {
    return callRoot(node.expression)
  }
  return ''
}

function objectProperty(node: ts.Expression | undefined, name: string) {
  if (!node || !ts.isObjectLiteralExpression(unwrap(node))) {
    return undefined
  }
  const object = unwrap(node) as ts.ObjectLiteralExpression
  const property = object.properties.find(item => item.name && (ts.isIdentifier(item.name) || ts.isStringLiteral(item.name)) && item.name.text === name)
  return property && ts.isPropertyAssignment(property) ? property.initializer : undefined
}

export function analyzeCaseSource(content: string, file: string, templateNames: string[] = [], initialBindings: Record<string, unknown> = {}): CaseInventory[] {
  const source = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true)
  const cases: CaseInventory[] = []
  const globals: Bindings = new Map(Object.entries(initialBindings))
  const imports = new Map<string, { original: string, source: string }>()
  const helpers = new Map<string, ts.FunctionDeclaration>()
  const position = (node: ts.Node) => `${file}:${source.getLineAndCharacterOfPosition(node.getStart()).line + 1}`
  const collectGlobals = (node: ts.Node) => {
    if (ts.isFunctionDeclaration(node) && node.name) {
      helpers.set(node.name.text, node)
    }
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
      const value = readLiteral(node.initializer, globals)
      if (value !== undefined) {
        globals.set(node.name.text, value)
      }
    }
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) && node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings)) {
      for (const item of node.importClause.namedBindings.elements) {
        imports.set(item.name.text, { original: item.propertyName?.text ?? item.name.text, source: node.moduleSpecifier.text })
      }
    }
    if (ts.isSourceFile(node) || ts.isVariableStatement(node) || ts.isVariableDeclarationList(node)) {
      ts.forEachChild(node, collectGlobals)
    }
  }
  collectGlobals(source)

  function inspectCase(node: ts.CallExpression, name: string, bindings: Bindings, inheritedNotes: string[]) {
    const result: CaseInventory = { source: position(node), name, plans: [], routes: [], operations: [], notes: [...inheritedNotes] }
    const visitedHelpers = new Set<string>()
    const visit = (child: ts.Node) => {
      if (ts.isCallExpression(child)) {
        const root = callRoot(child.expression)
        const called = imports.get(root)?.original ?? root
        if (called === 'createDomAcceptance') {
          result.plans.push({ registration: 'createDomAcceptance', fixture: String(readLiteral(child.arguments[1], bindings) ?? expression(child.arguments[1])), checkpoints: expression(child.arguments[2]), source: position(child) })
        }
        if (called === 'runTemplateE2E') {
          const options = child.arguments[0]
          const plan = objectProperty(options, 'acceptance')
          if (plan) {
            const reference = ts.isIdentifier(plan) ? imports.get(plan.text) : undefined
            result.plans.push({ registration: 'runTemplateE2E', fixture: expression(objectProperty(options, 'templateRoot')), checkpoints: expression(plan), source: reference ? `${path.posix.normalize(path.posix.join(path.posix.dirname(file), reference.source))}.ts` : position(child) })
          }
        }
        if (called === 'withBehaviorPage') {
          const page = readLiteral(child.arguments[1], bindings)
          result.plans.push({ registration: 'withBehaviorPage', fixture: 'e2e-apps/wevu-features', checkpoints: expression(child.arguments[2]), source: position(child) })
          if (typeof page === 'string') {
            result.routes.push(`/pages/${page}/index`)
          }
        }
        if (called === 'runGithubDom' && imports.get(root)?.source.includes('githubIssuesDom')) {
          result.plans.push({ registration: called, fixture: 'e2e-apps/github-issues', checkpoints: expression(child.arguments[2]), source: position(child) })
          const route = readLiteral(child.arguments[1], bindings)
          if (typeof route === 'string') {
            result.routes.push(route)
          }
        }
        const helper = helpers.get(called)
        if (helper?.body && !visitedHelpers.has(called)) {
          visitedHelpers.add(called)
          visit(helper.body)
        }
        if (ts.isPropertyAccessExpression(child.expression) && ['reLaunch', 'navigateTo', 'redirectTo', 'switchTab', 'callMethod', 'callMethodWithOptions', 'tap'].includes(child.expression.name.text)) {
          const argument = readLiteral(child.arguments[0], bindings)
          const operation = `${child.expression.name.text}(${typeof argument === 'string' ? argument : expression(child.arguments[0])})`
          result.operations.push(operation)
          if (['reLaunch', 'navigateTo', 'redirectTo', 'switchTab'].includes(child.expression.name.text) && typeof argument === 'string') {
            result.routes.push(argument)
          }
        }
      }
      if (ts.isPropertyAssignment(child) && child.name.getText() === 'route' && ts.isStringLiteral(child.initializer)) {
        result.routes.push(child.initializer.text)
      }
      ts.forEachChild(child, visit)
    }
    for (const argument of node.arguments.slice(1)) {
      visit(argument)
    }
    if (expression(node.expression).includes('.skip') || expression(node.expression).includes('.todo')) {
      result.notes.push('skip/todo declaration; cannot be accepted as passed')
    }
    if (!result.plans.length) {
      result.notes.push('Missing createDomAcceptance plan; existing DOM/data assertions do not produce acceptance evidence')
    }
    result.routes = [...new Set(result.routes)]
    result.operations = [...new Set(result.operations)]
    cases.push(result)
  }

  function visit(node: ts.Node, bindings: Bindings, suites: string[], notes: string[]) {
    if (ts.isForOfStatement(node) && ts.isVariableDeclarationList(node.initializer)) {
      const declaration = node.initializer.declarations[0]
      const values = readLiteral(node.expression, bindings)
      if (declaration && ts.isIdentifier(declaration.name) && Array.isArray(values)) {
        for (const value of values) {
          const next = new Map(bindings)
          next.set(declaration.name.text, value)
          visit(node.statement, next, suites, notes)
        }
        return
      }
      visit(node.statement, bindings, suites, [...notes, `Dynamic parameterization: ${expression(node.expression)} at ${position(node)}`])
      return
    }
    if (ts.isCallExpression(node)) {
      const root = callRoot(node.expression)
      const called = imports.get(root)?.original ?? root
      const literalName = readLiteral(node.arguments[0], bindings)
      if (['it', 'test'].includes(called) && typeof literalName === 'string') {
        const names = expression(node.expression).includes('.each(') && templateNames.length
          ? templateNames.map(template => literalName.replaceAll('$name', template))
          : [literalName]
        const caseNotes = expression(node.expression).includes('.each(') && !templateNames.length
          ? [...notes, `Dynamic each table: ${expression(node.expression)}`]
          : notes
        for (const name of names) {
          inspectCase(node, [...suites, name].join(' > '), bindings, caseNotes)
        }
        return
      }
      if (called.startsWith('describe') && typeof literalName === 'string') {
        const inherited = expression(node.expression).includes('.skip') ? [...notes, 'Skipped describe'] : notes
        for (const argument of node.arguments.slice(1)) {
          visit(argument, bindings, [...suites, literalName], inherited)
        }
        return
      }
    }
    ts.forEachChild(node, child => visit(child, bindings, suites, notes))
  }
  visit(source, globals, [], [])
  return cases
}

export function importedTestSources(content: string, file: string) {
  const source = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true)
  return source.statements.filter(ts.isImportDeclaration)
    .map(node => ts.isStringLiteral(node.moduleSpecifier) ? node.moduleSpecifier.text : '')
    .filter(specifier => specifier.startsWith('.') && /\.test(?:\.ts)?$/.test(specifier))
    .map(specifier => path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier.endsWith('.ts') ? specifier : `${specifier}.ts`)))
}

export function readFactoryTitle(content: string, file: string, factory: string) {
  const source = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true)
  for (const statement of source.statements) {
    if (ts.isExpressionStatement(statement) && ts.isCallExpression(statement.expression)
      && callRoot(statement.expression.expression) === factory) {
      return readLiteral(statement.expression.arguments[0], new Map())
    }
  }
  return undefined
}

export function readCaseInventory(root: string, file: string, templates: string[] = [], seen = new Set<string>()): CaseInventory[] {
  if (seen.has(file)) {
    return []
  }
  seen.add(file)
  const content = fs.readFileSync(path.join(root, file), 'utf8')
  return [
    ...analyzeCaseSource(content, file, templates),
    ...importedTestSources(content, file).flatMap(child => readCaseInventory(root, child, [], seen)),
  ]
}
