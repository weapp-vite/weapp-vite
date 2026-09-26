import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, realpath, symlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'
import { commonCases } from './common'
import { measure } from './measure'
import { wxmlCases } from './wxml'

const root = path.resolve(process.env.WXML_PERF_ROOT ?? process.cwd())
const output = path.resolve(process.env.WXML_PERF_OUTPUT ?? '.tmp/wxml-performance/micro.json')
const samples = Number(process.env.WXML_PERF_SAMPLES ?? 15)
const filter = process.env.WXML_PERF_FILTER
const modules = [
  'packages-runtime/wevu-compiler/src/plugins/vue/compiler/template.ts',
  'mpcore/packages/simulator/src/view/wxsDocument.ts',
  'mpcore/packages/simulator/src/view/templateText.ts',
  'mpcore/packages/simulator/src/browser/index.ts',
  'packages/weapp-vite/src/wxml/transform/editor.ts',
  'packages/weapp-vite/src/wxml/remove/index.ts',
  'packages/weapp-vite/src/wxml/options.ts',
  'packages/weapp-vite/src/wxml/transform/index.ts',
  'packages/weapp-vite/src/wxml/validate/index.ts',
  'packages/weapp-vite/src/runtime/runtimeState.ts',
  'packages/weapp-vite/src/wxml/processing/dependencies.ts',
]
const moduleRoot = path.join(root, '.tmp/wxml-performance/modules')
await mkdir(path.join(moduleRoot, 'node_modules'), { recursive: true })
for (const name of ['css-select', 'css-what', 'fontoxpath']) {
  const target = path.join(moduleRoot, 'node_modules', name)
  if (!existsSync(target)) {
    await symlink(await realpath(path.join(root, 'mpcore/packages/simulator/node_modules', name)), target, 'junction')
  }
}
// 与发布包一样去除 TS 编译辅助命名；准备耗时不计入样本。
await build({
  absWorkingDir: root,
  entryPoints: modules.filter(file => existsSync(path.join(root, file))),
  outbase: root,
  outdir: moduleRoot,
  bundle: true,
  splitting: true,
  packages: 'external',
  platform: 'node',
  format: 'esm',
  outExtension: { '.js': '.mjs' },
  logLevel: 'error',
})
const load = (file: string) => import(pathToFileURL(path.join(moduleRoot, file.replace(/\.ts$/, '.mjs'))).href)
assert.ok(globalThis.gc, 'Run with node --expose-gc --import tsx')
const supportsWxml = existsSync(path.join(root, 'packages/weapp-vite/src/wxml/transform/editor.ts'))
const cases = await commonCases(load, supportsWxml)
if (supportsWxml) {
  cases.push(...await wxmlCases(load, root))
}
const report = {
  sha: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  dirty: Boolean(execFileSync('git', ['diff', '--name-only'], { cwd: root, encoding: 'utf8' }).trim()),
  node: process.version,
  platform: process.platform,
  arch: process.arch,
  supportsWxml,
  compilation: 'esbuild ESM, bundle/splitting, external packages, no keepNames',
  results: [] as Awaited<ReturnType<typeof measure>>[],
}
await mkdir(path.dirname(output), { recursive: true })
for (const test of cases) {
  if (filter && !test.name.includes(filter)) {
    continue
  }
  const result = await measure(test, samples)
  report.results.push(result)
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`)
  process.stdout.write(`${result.name}: median=${result.medianMs.toFixed(3)}ms p95=${result.p95Ms.toFixed(3)}ms\n`)
}
assert.ok(report.results.length)
