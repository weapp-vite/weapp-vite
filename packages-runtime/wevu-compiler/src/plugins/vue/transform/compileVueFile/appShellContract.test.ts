import * as t from '@weapp-vite/ast/babelTypes'
import { expect, it } from 'vitest'
import { parseJsLike } from '../../../../utils/babel'
import { compileVueFile } from './index'

function scopedSlotInstallerCalls(code: string) {
  const statements = parseJsLike(code).program.body
  const bindings = new Set<string>()
  for (const statement of statements) {
    if (!t.isImportDeclaration(statement)) {
      continue
    }
    for (const specifier of statement.specifiers) {
      if (!t.isImportSpecifier(specifier)) {
        continue
      }
      const imported = t.isIdentifier(specifier.imported)
        ? specifier.imported.name
        : specifier.imported.value
      if (imported === 'installScopedSlots') {
        bindings.add(specifier.local.name)
      }
    }
  }
  return statements.filter(statement => t.isExpressionStatement(statement)
    && t.isCallExpression(statement.expression)
    && t.isIdentifier(statement.expression.callee)
    && bindings.has(statement.expression.callee.name)
    && statement.expression.arguments.length === 0).length
}

it('keeps page script capabilities, template wrapper and component config on the same App shell generation', async () => {
  const source = '<script setup>const label = "page"</script><template><view>{{ label }}</view></template>'
  const filename = 'src/pages/plain/index.vue'
  const appShell = { importPath: '/weapp-app-shell', tagName: 'weapp-app-shell' }
  const results = []
  for (const hasShell of [false, true, false]) {
    const result = await compileVueFile(source, filename, {
      isPage: true,
      appShell: hasShell ? appShell : undefined,
      sourceMap: false,
    })
    const config = JSON.parse(result.config ?? '{}') as { usingComponents?: Record<string, string> }
    expect(result.meta?.runtimeCapabilities?.required.includes('scopedSlots') ?? false).toBe(hasShell)
    expect(result.bindingManifest?.features.scopedSlots ?? false).toBe(hasShell)
    expect(scopedSlotInstallerCalls(result.script ?? '')).toBe(hasShell ? 1 : 0)
    expect(result.template?.includes(`<${appShell.tagName}`)).toBe(hasShell)
    expect(config.usingComponents?.[appShell.tagName]).toBe(hasShell ? appShell.importPath : undefined)
    results.push(result)
  }
  expect(results[0]?.script).not.toBe(results[1]?.script)
  expect(results[2]?.script).toBe(results[0]?.script)
  expect(results[2]?.template).toBe(results[0]?.template)
  expect(results[2]?.config).toBe(results[0]?.config)
})
