import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
// eslint-disable-next-line e18e/ban-dependencies -- 核验与正式准备相同的跨平台 pnpm workspace 选择结果。
import { execa } from 'execa'
import ts from 'typescript'
import { it } from 'vitest'
import { createBenchmarkCheckoutPreparationCommands, createBenchmarkRunnerPreparationCommand, createBenchmarkTemplateDependenciesCommand } from './benchmark-checkout-preparation'

/** 沿静态运行时导入发现源码 helper 的公共依赖，不读取本机已有 dist。 */
async function collectRuntimeImports(entries: URL[]): Promise<Set<string>> {
  const imports = new Set<string>()
  const visited = new Set<string>()
  const pending = entries.map(entry => fileURLToPath(entry))
  while (pending.length) {
    const filename = pending.pop()!
    if (visited.has(filename)) {
      continue
    }
    visited.add(filename)
    const source = ts.createSourceFile(filename, await readFile(filename, 'utf8'), ts.ScriptTarget.Latest)
    for (const statement of source.statements) {
      if (!(ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement))
        || !statement.moduleSpecifier || !ts.isStringLiteral(statement.moduleSpecifier)) {
        continue
      }
      if (ts.isImportDeclaration(statement)) {
        const clause = statement.importClause
        if (clause?.isTypeOnly || (clause && !clause.name && clause.namedBindings && ts.isNamedImports(clause.namedBindings)
          && clause.namedBindings.elements.length > 0 && clause.namedBindings.elements.every(item => item.isTypeOnly))) {
          continue
        }
      }
      else if (statement.isTypeOnly || (statement.exportClause && ts.isNamedExports(statement.exportClause)
        && statement.exportClause.elements.length > 0 && statement.exportClause.elements.every(item => item.isTypeOnly))) {
        continue
      }
      const specifier = statement.moduleSpecifier.text
      if (!specifier.startsWith('.')) {
        imports.add(specifier)
        continue
      }
      const resolved = path.resolve(path.dirname(filename), specifier)
      const candidates = path.extname(resolved)
        ? [resolved, resolved.replace(/\.m?js$/, '.ts')]
        : ['.ts', '.mts', '.js', '/index.ts', '/index.mts', '/index.js'].map(suffix => `${resolved}${suffix}`)
      const dependency = candidates.find(candidate => existsSync(candidate))
      assert.ok(dependency, `Unresolved runtime import ${specifier} in ${path.basename(filename)}`)
      pending.push(dependency)
    }
  }
  return imports
}

it('prepares selected templates transitive dependencies without building the measurement targets', () => {
  const command = createBenchmarkTemplateDependenciesCommand(['weapp-vite-react-template', 'weapp-vite-template', 'weapp-vite-react-template'])
  const selectors = command.args.filter((_, index, args) => args[index - 1] === '--filter')
  assert.deepEqual(selectors, ['weapp-vite...', 'weapp-vite-react-template^...', 'weapp-vite-template^...'])
  assert.ok(command.args.includes('-r'))
  assert.ok(!selectors.includes('weapp-vite-react-template...'))
  assert.equal(command.command, 'pnpm')
})

it('syncs generated API sources before benchmarking a checkout', () => {
  assert.deepEqual(createBenchmarkCheckoutPreparationCommands(), [
    {
      command: 'pnpm',
      args: ['--filter', '@weapp-core/api', 'catalog:sync'],
    },
    {
      command: 'pnpm',
      args: ['--filter', '@weapp-core/api', 'docs:sync'],
    },
  ])
})

it('prepares transitive runtime workspace imports used by the driver without building measurement targets', async () => {
  const command = createBenchmarkRunnerPreparationCommand()
  const cwd = fileURLToPath(new URL('../', import.meta.url))
  const [selected, workspace, imports] = await Promise.all([
    execa('pnpm', [...command.args.slice(0, -2), 'list', '--depth', '-1', '--json'], { cwd }),
    execa('pnpm', ['-r', 'list', '--depth', '-1', '--json'], { cwd }),
    collectRuntimeImports([
      './benchmark-templates-hmr.ts',
      './compare-templates-performance.ts',
      './performanceGate/full.ts',
      './performanceGate/smoke.ts',
      './performanceGate/worker.ts',
      '../packages/weapp-vite/scripts/benchmark-auto-import-build.ts',
      '../packages/weapp-vite/scripts/benchmark-auto-import-hmr.ts',
    ].map(entry => new URL(entry, import.meta.url))),
  ])
  const selectedPackages = new Set((JSON.parse(selected.stdout) as Array<{ name: string }>).map(item => item.name))
  const workspacePackages = new Set((JSON.parse(workspace.stdout) as Array<{ name: string }>).map(item => item.name))
  assert.ok(imports.has('@weapp-core/logger'), 'The driver must include the process ownership helper dependency chain')
  for (const specifier of imports) {
    const dependency = specifier.split('/').slice(0, specifier.startsWith('@') ? 2 : 1).join('/')
    if (workspacePackages.has(dependency)) {
      assert.ok(selectedPackages.has(dependency), `Runner dependency ${specifier} has no dist preparation`)
    }
  }
  assert.equal(command.command, 'pnpm')
  assert.equal(command.args.at(-1), 'build')
  assert.ok(!selectedPackages.has('weapp-vite'))
  assert.ok(!selectedPackages.has('weapp-ide-cli'))
  assert.ok(!Array.from(selectedPackages).some(name => name.endsWith('-template')))
})
