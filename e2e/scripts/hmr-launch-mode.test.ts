import fs from 'node:fs/promises'
import path from 'node:path'
import { glob } from 'tinyglobby'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const wrapperSuite = 'automator-bridge-wrapper-hmr.runtime.test.ts'
const additionalHmrSuites = ['forward-console-demo.runtime.test.ts']
const ideRoot = path.resolve(import.meta.dirname, '../ide')

function unwrap(expression: ts.Expression): ts.Expression {
  while (ts.isParenthesizedExpression(expression) || ts.isAsExpression(expression) || ts.isSatisfiesExpression(expression) || ts.isNonNullExpression(expression)) {
    expression = expression.expression
  }
  return expression
}

function propertyName(name: ts.PropertyName): string | undefined {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name)) {
    return name.text
  }
  if (ts.isComputedPropertyName(name) && ts.isStringLiteral(name.expression)) {
    return name.expression.text
  }
}

function auditLaunchMode(source: string, expected: 'direct' | 'snapshot') {
  const file = ts.createSourceFile('fixture.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const launchNames = new Set(['launchAutomator'])
  const namespaces = new Set<string>()
  for (const statement of file.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier) || !statement.moduleSpecifier.text.endsWith('/automator')) {
      continue
    }
    const bindings = statement.importClause?.namedBindings
    if (bindings && ts.isNamedImports(bindings)) {
      for (const binding of bindings.elements) {
        if ((binding.propertyName ?? binding.name).text === 'launchAutomator') {
          launchNames.add(binding.name.text)
        }
      }
    }
    else if (bindings && ts.isNamespaceImport(bindings)) {
      namespaces.add(bindings.name.text)
    }
  }
  const violations: string[] = []
  let calls = 0
  function visit(node: ts.Node) {
    if (ts.isCallExpression(node)) {
      const callee = unwrap(node.expression)
      const launch = ts.isIdentifier(callee)
        ? launchNames.has(callee.text)
        : ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.expression) && namespaces.has(callee.expression.text) && callee.name.text === 'launchAutomator'
      if (launch) {
        calls++
        const argument = node.arguments[0] && unwrap(node.arguments[0])
        let mode: string | undefined
        if (argument && ts.isObjectLiteralExpression(argument)) {
          for (const property of argument.properties) {
            if (ts.isSpreadAssignment(property) || (property.name && ts.isComputedPropertyName(property.name) && propertyName(property.name) === undefined)) {
              mode = undefined
            }
            else if (property.name && propertyName(property.name) === 'bridgeProjectMode') {
              const value = ts.isPropertyAssignment(property) ? unwrap(property.initializer) : undefined
              mode = value && ts.isStringLiteral(value) ? value.text : undefined
            }
          }
        }
        if (mode !== expected) {
          const line = file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1
          violations.push(`line ${line}: launchAutomator requires an explicit final bridgeProjectMode: '${expected}' in its options object`)
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(file)
  return { calls, violations }
}

describe('IDE HMR launch mode contract', () => {
  it('requires direct launch for product HMR and snapshot only for the wrapper regression', async () => {
    const files = [...new Set([...await glob('**/*hmr*.test.ts', { cwd: ideRoot, onlyFiles: true }), ...additionalHmrSuites])]
    expect(files.length).toBeGreaterThan(0)
    expect(files).toContain(wrapperSuite)
    const audits = await Promise.all(files.sort().map(async (file) => {
      const source = await fs.readFile(path.join(ideRoot, file), 'utf8')
      return { file, ...auditLaunchMode(source, file === wrapperSuite ? 'snapshot' : 'direct') }
    }))
    expect(audits.flatMap(audit => audit.violations.map(message => `${audit.file}: ${message}`))).toEqual([])
    // 该专项通过 CLI dev -o 和 waitForOpenedAutomator 连接原项目，不调用桥接启动器。
    // 新增间接启动必须先审查其实际入口，不能因为没有 launchAutomator 调用就静默通过。
    expect(audits.filter(audit => audit.calls === 0).map(audit => audit.file)).toEqual([
      'layout-power-demo.runtime-vendor-hmr.test.ts',
    ])
  })

  it.each([
    'launchAutomator({ projectPath })',
    'launchAutomator(options)',
    'launchAutomator({ bridgeProjectMode: mode })',
    'launchAutomator({ bridgeProjectMode: "snapshot" })',
    'launchAutomator({ bridgeProjectMode: "direct", ...options })',
    'launchAutomator({ bridgeProjectMode: "direct", [key]: value })',
    'launchAutomator({ bridgeProjectMode: "direct", bridgeProjectMode: "snapshot" })',
  ])('rejects missing, indirect, incorrect or overwritten launch mode: %s', (source) => {
    expect(auditLaunchMode(source, 'direct')).toEqual({ calls: 1, violations: [expect.stringContaining('bridgeProjectMode: \'direct\'')] })
  })

  it('accepts explicit literal options after defaults and TypeScript wrappers', () => {
    expect(auditLaunchMode('launchAutomator(({ ...defaults, ["bridgeProjectMode"]: "direct" } satisfies Options))', 'direct'))
      .toEqual({ calls: 1, violations: [] })
    expect(auditLaunchMode('launchAutomator({ bridgeProjectMode: "snapshot" })', 'snapshot'))
      .toEqual({ calls: 1, violations: [] })
  })

  it('checks import aliases and namespace calls without reading comments or string literals as code', () => {
    const source = `import { launchAutomator as launch } from '../utils/automator'
import * as automator from '../utils/automator'
// launchAutomator({ bridgeProjectMode: 'snapshot' })
const example = "launchAutomator({})"
launch({ bridgeProjectMode: 'direct' })
automator.launchAutomator({ bridgeProjectMode: 'direct' })`
    expect(auditLaunchMode(source, 'direct')).toEqual({ calls: 2, violations: [] })
  })
})
