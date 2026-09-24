import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import process from 'node:process'
import { setTimeout } from 'node:timers/promises'
import { pathToFileURL } from 'node:url'
import { percentile } from './measure'

const root = path.resolve(process.env.WXML_PERF_ROOT ?? process.cwd())
const output = path.resolve(process.env.WXML_PERF_OUTPUT ?? '.tmp/wxml-performance/watch.json')
const enabled = process.env.WXML_PERF_ENABLED === '1'
const { createCompilerContext } = await import(pathToFileURL(path.join(root, 'packages/weapp-vite/dist/index.mjs')).href)
const outputs = ['pages/native/index.wxml', 'pages/vue/index.wxml', 'sub/index.wxml', 'independent/index.wxml']
const report: any = { sha: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), enabled, filter: process.env.WXML_PERF_FILTER ?? null, exclude: process.env.WXML_PERF_EXCLUDE ?? null, runtime: process.env.WXML_PERF_RUNTIME ?? null, results: [] }
await mkdir(path.dirname(output), { recursive: true })

async function until(check: () => Promise<boolean>) {
  const deadline = performance.now() + 45000
  while (!await check()) {
    assert.ok(performance.now() < deadline, 'HMR output did not reach the expected state')
    await setTimeout(10)
  }
}

for (const runtime of ['classic', 'stateful-experimental'].filter(value => !process.env.WXML_PERF_RUNTIME || value === process.env.WXML_PERF_RUNTIME)) {
  // 固定同一输入 fixture，依赖全部链接到被测 checkout，避免混用 dist。
  const parent = path.join(root, '.tmp/wxml-performance/projects')
  await mkdir(parent, { recursive: true })
  const tempDir = await mkdtemp(path.join(parent, 'watch-'))
  const fixture = path.resolve(import.meta.dirname, '../../test/fixture-projects/weapp-vite/wxml-remove')
  await cp(fixture, tempDir, { recursive: true, filter: source => !path.relative(fixture, source).split(path.sep).some(part => ['node_modules', 'dist', '.weapp-vite'].includes(part)) })
  await mkdir(path.join(tempDir, 'node_modules'), { recursive: true })
  for (const [name, relative] of [['weapp-vite', 'packages/weapp-vite'], ['wevu', 'packages-runtime/wevu']]) {
    await symlink(path.join(root, relative!), path.join(tempDir, 'node_modules', name!), 'junction')
  }
  const project = { tempDir, cleanup: () => rm(tempDir, { recursive: true, force: true }) }
  const ctx = await createCompilerContext({
    cwd: project.tempDir,
    mode: enabled ? 'transform-validate' : 'legacy',
    isDev: true,
    inlineConfig: { weapp: { hmr: { runtime } }, build: { watch: { chokidar: { usePolling: true, interval: 50 } } } },
  })
  let watcher: any
  try {
    watcher = await ctx.buildService.build({ skipNpm: true })
    await until(async () => (await Promise.all(outputs.map(file => readFile(path.join(project.tempDir, 'dist', file), 'utf8').catch(() => '')))).every(Boolean))
    await setTimeout(500)
    for (const file of outputs.filter(value => (!process.env.WXML_PERF_FILTER || value.includes(process.env.WXML_PERF_FILTER)) && (!process.env.WXML_PERF_EXCLUDE || !value.includes(process.env.WXML_PERF_EXCLUDE)))) {
      const sourceFile = path.join(project.tempDir, 'src', file.replace('pages/vue/index.wxml', 'pages/vue/index.vue'))
      const original = await readFile(sourceFile, 'utf8')
      const samples = []
      for (let round = 0; round < 20; round++) {
        const marker = `perf-${round}`
        const next = file.includes('/vue/') ? original.replace('</template>', `<view>${marker}</view></template>`) : `${original}<view>${marker}</view>`
        const start = performance.now()
        await writeFile(sourceFile, next)
        await until(async () => (await readFile(path.join(project.tempDir, 'dist', file), 'utf8')).includes(marker))
        samples.push({ ms: performance.now() - start, ...process.memoryUsage() })
        const code = await readFile(path.join(project.tempDir, 'dist', file), 'utf8')
        if (enabled) {
          assert.equal(code.match(/<!-- transform-once -->/g)?.length, 1)
        }
        await setTimeout(100)
      }
      report.results.push({ runtime, scenario: file, samples, medianMs: percentile(samples.map(sample => sample.ms), 0.5), p95Ms: percentile(samples.map(sample => sample.ms), 0.95) })
      await writeFile(output, `${JSON.stringify(report, null, 2)}\n`)
    }
    if (enabled) {
      const samples = []
      for (let round = 0; round < 20; round++) {
        const label = `rule-${round}`
        const start = performance.now()
        await writeFile(path.join(project.tempDir, 'transform-rules.json'), JSON.stringify({ label }))
        await until(async () => (await Promise.all(outputs.map(file => readFile(path.join(project.tempDir, 'dist', file), 'utf8')))).every(code => code.includes(`data-rule="${label}"`)))
        samples.push({ ms: performance.now() - start, ...process.memoryUsage() })
        await setTimeout(100)
      }
      report.results.push({ runtime, scenario: 'external-dependency', samples, medianMs: percentile(samples.map(sample => sample.ms), 0.5), p95Ms: percentile(samples.map(sample => sample.ms), 0.95) })
      await writeFile(output, `${JSON.stringify(report, null, 2)}\n`)
      let errors = 0
      watcher.on('event', (event: { code: string }) => {
        if (event.code === 'ERROR') {
          errors++
        }
      })
      const recovery = []
      for (let round = 0; round < 20; round++) {
        const previous = errors
        await rm(path.join(project.tempDir, 'transform-rules.json'))
        await until(async () => errors > previous)
        const label = `recovery-${round}`
        const start = performance.now()
        await writeFile(path.join(project.tempDir, 'transform-rules.json'), JSON.stringify({ label }))
        await until(async () => (await Promise.all(outputs.map(file => readFile(path.join(project.tempDir, 'dist', file), 'utf8')))).every(code => code.includes(`data-rule="${label}"`) && code.match(/<!-- transform-once -->/g)?.length === 1))
        recovery.push({ ms: performance.now() - start, ...process.memoryUsage(), pending: ctx.runtimeState.wxmlProcessing.pending.size })
        await setTimeout(100)
      }
      report.results.push({ runtime, scenario: 'failure-recovery', samples: recovery, medianMs: percentile(recovery.map(sample => sample.ms), 0.5), p95Ms: percentile(recovery.map(sample => sample.ms), 0.95) })
      await writeFile(output, `${JSON.stringify(report, null, 2)}\n`)
    }
  }
  finally {
    await watcher?.close()
    await ctx.watcherService.closeAll()
    assert.equal(ctx.runtimeState.wxmlProcessing?.references?.size ?? 0, 0)
    assert.equal(ctx.runtimeState.build.independent.watchFiles?.size ?? 0, 0)
    assert.equal(ctx.runtimeState.build.independent.watchListeners?.size ?? 0, 0)
    await project.cleanup()
  }
}

assert.ok(report.results.length, 'No watch scenarios matched the requested filters')
report.completed = true
await writeFile(output, `${JSON.stringify(report, null, 2)}\n`)
