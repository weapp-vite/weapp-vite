import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import vm from 'node:vm'
// eslint-disable-next-line e18e/ban-dependencies -- 真实 pnpm 回归需要统一处理 Windows 的 .cmd 入口。
import { execa } from 'execa'
import ts from 'typescript'
import { afterEach, expect, it } from 'vitest'
import * as yaml from 'yaml'

const require = createRequire(import.meta.url)
const toolkit = createRequire(require.resolve('repoctl')).resolve('@icebreakers/monorepo')
const directories: string[] = []
const packages = [
  { name: '@consumer-fixture/first', version: '1.0.1-nightly.20261112' },
  { name: '@consumer-fixture/second', version: '2.0.0-nightly.20261112' },
]

afterEach(async () => {
  await Promise.all(directories.splice(0).map(directory => rm(directory, { recursive: true, force: true })))
})

async function workspaceSource(region: string, provider = 'npm') {
  const directory = path.dirname(toolkit)
  const sources = await Promise.all((await readdir(directory)).filter(file => file.endsWith('.mjs')).map(file => readFile(path.join(directory, file), 'utf8')))
  const expressions: { source: string, globals: Record<string, unknown> }[] = []
  for (const source of sources) {
    const markers = [...source.matchAll(/^\/\/(?:#region | )(src\/[^\r\n]+\.ts)\r?$/gmu)]
    const markerIndex = markers.findIndex(marker => marker[1] === region)
    if (markerIndex < 0) {
      continue
    }
    const start = markers[markerIndex]!.index!
    const end = markers[markerIndex + 1]?.index ?? source.length
    const parsed = ts.createSourceFile('installed.mjs', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS)
    const globals: Record<string, unknown> = { report: { provider, packages }, manifest: { packages } }
    for (const statement of parsed.statements) {
      if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier) && statement.moduleSpecifier.text === 'yaml') {
        const clause = statement.importClause
        if (clause?.name) {
          globals[clause.name.text] = yaml
        }
        if (clause?.namedBindings && ts.isNamedImports(clause.namedBindings)) {
          for (const binding of clause.namedBindings.elements) {
            globals[binding.name.text] = yaml[(binding.propertyName?.text ?? binding.name.text) as keyof typeof yaml]
          }
        }
      }
    }
    const visit = (node: ts.Node) => {
      if (node.getStart(parsed) >= start && node.getEnd() <= end && ts.isCallExpression(node) && node.arguments.length >= 2 && node.arguments[0]!.getText(parsed).includes('"pnpm-workspace.yaml"')) {
        expressions.push({ source: node.arguments[1]!.getText(parsed), globals })
      }
      ts.forEachChild(node, visit)
    }
    visit(parsed)
  }
  expect(expressions, `Installed consumer workspace writer: ${region}`).toHaveLength(1)
  const expression = expressions[0]!
  return vm.compileFunction(`return (${expression.source})`, Object.keys(expression.globals))(...Object.values(expression.globals)) as string
}

it.each([
  'src/commands/release/nightly/consumer.ts',
  'src/commands/release/snapshot/prepared/consumer/index.ts',
])('writes a workspace pnpm can update after resolving fresh versions: %s', async (region) => {
  const content = await workspaceSource(region)
  const exclusions = packages.map(pkg => `${pkg.name}@${pkg.version}`)
  expect(yaml.parse(content)).toEqual({ packages: [], minimumReleaseAgeExclude: exclusions })
  const directory = await mkdtemp(path.join(tmpdir(), 'consumer-workspace-'))
  directories.push(directory)
  await writeFile(path.join(directory, 'package.json'), '{"private":true}')
  await writeFile(path.join(directory, 'pnpm-workspace.yaml'), content)
  const updated = [...exclusions, '@consumer-fixture/transitive@1.0.0']
  // 使用真实 pnpm 的项目配置写入器，覆盖安装器追加新发布依赖例外的同一边界。
  await execa('pnpm', ['--config.manage-package-manager-versions=false', 'config', 'set', '--location=project', '--json', 'minimumReleaseAgeExclude', JSON.stringify(updated)], {
    cwd: directory,
    env: { ...process.env, npm_config_userconfig: path.join(directory, 'user.npmrc') },
    timeout: 10_000,
  })
  expect(yaml.parse(await readFile(path.join(directory, 'pnpm-workspace.yaml'), 'utf8'))).toEqual({ packages: [], minimumReleaseAgeExclude: updated })
}, 20_000)

it('keeps non-npm consumers isolated without adding npm freshness exceptions', async () => {
  expect(yaml.parse(await workspaceSource('src/commands/release/nightly/consumer.ts', 'github'))).toEqual({ packages: [] })
})
