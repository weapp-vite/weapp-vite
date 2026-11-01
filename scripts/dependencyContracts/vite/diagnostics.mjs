import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
// eslint-disable-next-line e18e/ban-dependencies -- 显式诊断串行复用跨平台启动、原始退出码与错误传播。
import { execa } from 'execa'

assert.equal(process.argv.length, 2, 'The complete Vite diagnostic entry does not accept filters')
assert.equal(typeof globalThis.gc, 'function', 'Run Vite diagnostics with --expose-gc')
const require = createRequire(import.meta.url)
const planned = ['source-contracts', 'watcher-diagnostics']
const completed = []
try {
  await execa(process.execPath, ['--expose-gc', fileURLToPath(new URL('./run.mjs', import.meta.url))], { stdio: 'inherit' })
  completed.push(planned[0])
  await execa(process.execPath, [path.join(path.dirname(require.resolve('vitest/package.json')), 'vitest.mjs'), 'run', '--config', fileURLToPath(new URL('./diagnostics.config.mjs', import.meta.url))], { stdio: 'inherit' })
  completed.push(planned[1])
}
finally {
  const passed = completed.length === planned.length
  console.log(JSON.stringify({ suite: 'dependency-internals', status: passed ? 'passed' : 'failed', planned, completed, failed: passed ? undefined : planned[completed.length], notExecuted: planned.slice(completed.length + 1) }))
}
