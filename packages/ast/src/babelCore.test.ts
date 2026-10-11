import { execFile } from 'node:child_process'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { describe, expect, it } from 'vitest'

const execFileAsync = promisify(execFile)
const packageDirectory = fileURLToPath(new URL('../', import.meta.url))
const adapterUrl = new URL('./babelCore.ts', import.meta.url).href
const babelUrl = new URL('./babel.ts', import.meta.url).href
const namedExports = [
  'parse',
  'parseAsync',
  'parseSync',
  'transform',
  'transformAsync',
  'transformSync',
  'transformFile',
  'transformFileAsync',
  'transformFileSync',
  'transformFromAst',
  'transformFromAstAsync',
  'transformFromAstSync',
  'types',
  'version',
]

describe('Babel core ESM adapter', () => {
  // 必须使用全新 Node 进程，Vitest 预加载过的 Babel 会掩盖并发 import 与同步 require 的竞争。
  it.each([false, true])('loads concurrent ESM imports and preserves its public exports (adapter first: %s)', async (adapterFirst) => {
    const imports = adapterFirst ? [adapterUrl, '@babel/core'] : ['@babel/core', adapterUrl]
    const { stdout } = await execFileAsync(process.execPath, ['--input-type=module', '--eval', `
      import assert from 'node:assert/strict'
      const modules = await Promise.all(${JSON.stringify(imports)}.map(id => import(id)))
      const [adapter, core] = ${adapterFirst ? 'modules' : 'modules.toReversed()'}
      assert.equal(adapter.default, core)
      const namedExports = ${JSON.stringify(namedExports)}
      assert.deepEqual(Object.keys(adapter).sort(), [...namedExports, 'default'].sort())
      for (const name of namedExports) assert.equal(adapter[name], core[name], name)
      const options = { babelrc: false, configFile: false }
      const ast = adapter.parseSync('const answer = 42', options)
      assert.equal(ast.program.body[0].type, 'VariableDeclaration')
      const transformed = adapter.transformSync('const answer = 42', { ...options, ast: true, code: false })
      assert.equal(transformed.ast.program.body[0].declarations[0].init.value, 42)
      const babel = await import(${JSON.stringify(babelUrl)})
      const parsed = babel.parse('const answer = 42')
      const names = []
      babel.traverse(parsed, { Identifier(path) { names.push(path.node.name) } })
      assert.deepEqual(names, ['answer'])
      assert.match(babel.generate(parsed).code, /answer/)
      assert.ok(babel.getVisitorKeys().Identifier)
      console.log('babel-core-contract-ok')
    `], { cwd: packageDirectory, timeout: 15_000 })
    expect(stdout.trim()).toBe('babel-core-contract-ok')
  })
})
