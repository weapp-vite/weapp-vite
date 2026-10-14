import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { expect, it } from 'vitest'

it('keeps collector startup independent of workspace package dist before preparation', async () => {
  const root = path.resolve(fileURLToPath(new URL('../..', import.meta.url)))
  const pending = [path.join(root, 'scripts/performanceGate/process.ts')]
  const visited = new Set<string>()
  const external = new Set<string>()
  while (pending.length) {
    const filename = pending.pop()!
    if (visited.has(filename)) {
      continue
    }
    visited.add(filename)
    const source = ts.createSourceFile(filename, await readFile(filename, 'utf8'), ts.ScriptTarget.Latest)
    for (const statement of source.statements) {
      if ((!ts.isImportDeclaration(statement) && !ts.isExportDeclaration(statement))
        || !statement.moduleSpecifier || !ts.isStringLiteral(statement.moduleSpecifier)
        || (ts.isImportDeclaration(statement) && statement.importClause?.isTypeOnly)
        || (ts.isExportDeclaration(statement) && statement.isTypeOnly)) {
        continue
      }
      const specifier = statement.moduleSpecifier.text
      if (specifier.startsWith('node:')) {
        continue
      }
      if (!specifier.startsWith('.')) {
        external.add(specifier)
        continue
      }
      const resolved = ts.resolveModuleName(specifier, filename, { moduleResolution: ts.ModuleResolutionKind.Bundler, allowJs: true }, ts.sys).resolvedModule
      expect(resolved, `${path.relative(root, filename)} -> ${specifier}`).toBeDefined()
      pending.push(resolved!.resolvedFileName)
    }
  }
  expect([...external].toSorted()).toEqual(['execa'])
  expect([...visited].map(filename => path.relative(root, filename).replaceAll('\\', '/'))).not.toContain('packages/weapp-ide-cli/src/devtoolsProjectOwnership/host.ts')
})
