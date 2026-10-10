import { mkdtemp, readFile, realpath, rename, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { runInNewContext } from 'node:vm'
import { dev } from 'rolldown/experimental'
import { expect, it, vi } from 'vitest'
import { CompilerHmrHost, compilerSourceId } from '../../plugins/compilerPlugin/hmr'
import { createStatefulHmrRolldownRuntimeSource } from './commonRuntime'

it.each([false, true])('pins actual DevEngine inputs for virtual source ownership (extra dependency: %s)', async (extraDependency) => {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'hmr-compiler-batch-')))
  const entry = path.join(root, 'app.js')
  const readinessSeed = path.join(root, 'watch-ready.seed')
  const readinessSeedId = compilerSourceId(readinessSeed)
  const source = (value: string) => `globalThis.utility = ${JSON.stringify(value)}; if (import.meta.hot) import.meta.hot.accept();`
  await writeFile(entry, source('py-5.5'))
  await writeFile(readinessSeed, '0')
  const sourceId = compilerSourceId(entry)
  const host = new CompilerHmrHost()
  const batches: Array<{ input: ReturnType<CompilerHmrHost['freeze']>, code: string, filename: string, graphCode?: string | null }> = []
  const runtime: Record<string, unknown> = {}
  const seedUpdateTypes: string[] = []
  let seedObserved = false
  let captures = 0
  const started = performance.now()
  const events: Array<Record<string, unknown>> = []
  // 只同步保存有界阶段信息，避免诊断引入新的微任务或记录源码。
  const record = (event: string, details: Record<string, unknown> = {}) => {
    events.push({ at: Math.round(performance.now() - started), event, ...details })
    if (events.length > 48) {
      events.shift()
    }
  }
  const fileLabel = (file: string) => {
    if (file.startsWith('\0')) {
      return '<virtual>'
    }
    const relative = path.relative(root, file).replaceAll('\\', '/')
    return relative.startsWith('../') || path.isAbsolute(relative) ? '<external>' : relative || '<root>'
  }
  const engine = await dev({
    cwd: root,
    input: '\0entry',
    experimental: { devMode: { lazy: false, implement: createStatefulHmrRolldownRuntimeSource() } },
    plugins: [{
      name: 'capture-actual-input',
      resolveId(id) {
        return id === '\0entry' ? id : undefined
      },
      async load(id) {
        if (id === '\0entry') {
          this.addWatchFile(entry)
          record('load:start')
          const code = await readFile(entry, 'utf8')
          record('load:end')
          return code
        }
      },
      watchChange(id, change) {
        record('watchChange', { file: fileLabel(id), kind: change.event })
      },
      buildStart() {
        this.addWatchFile(root)
        record('buildStart:watch-root')
      },
      generateBundle() {
        if (extraDependency) {
          this.addWatchFile(entry)
        }
        record('generateBundle', { extraDependency })
      },
      transform(code, _id) {
        host.capture(entry, code)
        captures += 1
        record('capture', { virtualEntry: _id === '\0entry' })
      },
    }],
  }, { format: 'esm', entryFileNames: 'app.js', sourcemap: true }, {
    watch: { exclude: [path.join(root, 'dist'), `${root}/dist/**`], skipWrite: true, usePolling: true, pollInterval: 20, compareContentsForPolling: true },
    onOutput(result) {
      record('onOutput', result instanceof Error ? { error: true } : { outputCount: result.output.length })
      if (result instanceof Error) {
        throw result
      }
      for (const output of result.output) {
        if (output.type === 'chunk') {
          runInNewContext(output.code, runtime)
        }
      }
    },
    onHmrUpdates(result) {
      record('onHmrUpdates', result instanceof Error
        ? { error: true }
        : { changedFiles: result.changedFiles.slice(0, 8).map(fileLabel), updateTypes: result.updates.slice(0, 8).map(({ update }) => update.type) })
      if (result instanceof Error) {
        throw result
      }
      const input = host.freeze(result.changedFiles)
      record('freeze', { revision: input.revision, capturedSource: input.sources.has(sourceId) })
      if (result.changedFiles.length > 0 && result.changedFiles.every(file => compilerSourceId(file) === readinessSeedId)) {
        seedObserved = true
        seedUpdateTypes.push(...result.updates.map(({ update }) => update.type))
      }
      for (const { update } of result.updates) {
        if (update.type === 'Patch') {
          batches.push({ input, code: update.code, filename: update.filename, graphCode: engine.moduleGraph.getModuleInfo('\0entry')?.code })
        }
      }
    },
  })
  record('run:start')
  const running = engine.run()
  try {
    await running
    record('run:end')
    await engine.registerClient('test-client')
    record('registerClient:end')
    await engine.ensureCurrentBuildFinish()
    record('initialBuild:end')
    const initialState = await engine.getBundleState()
    record('initialState', { ...initialState })
    expect(runtime.utility).toBe('py-5.5')
    await engine.notifyPayloadDelivered('app.js')
    record('initialPayload:delivered')
    const initialCaptures = captures
    const initialRevision = host.freeze([]).revision
    // 路径登记回执早于 polling 首次扫描；只修改无模块依赖的探针，确认基线后再保存目标源码。
    let seedTick = 0
    await vi.waitUntil(async () => {
      if (seedObserved) {
        return true
      }
      await writeFile(readinessSeed, String(++seedTick))
      return false
    }, { timeout: 10_000, interval: 20 })
    await engine.ensureCurrentBuildFinish()
    const readyState = await engine.getBundleState()
    record('watchBaseline:observed', { seedTick, seedUpdateTypes: [...seedUpdateTypes], ...readyState })
    expect(seedUpdateTypes.length).toBeGreaterThan(0)
    expect(seedUpdateTypes.every(type => type === 'Noop')).toBe(true)
    expect(batches).toHaveLength(0)
    expect(captures).toBe(initialCaptures)
    expect(host.freeze([]).revision).toBe(initialRevision)
    expect(host.readSource(sourceId)).toBe(source('py-5.5'))
    expect(engine.moduleGraph.getModuleInfo('\0entry')?.code).toBe(source('py-5.5'))
    expect(runtime.utility).toBe('py-5.5')
    for (const [index, utility] of ['py-6.5', 'py-7.5'].entries()) {
      record('edit:start', { index })
      await writeFile(`${entry}.pending`, source(utility))
      await rename(`${entry}.pending`, entry)
      record('edit:renamed', { index })
      await vi.waitFor(() => expect(batches.length).toBe(index + 1), { timeout: 10_000 })
      record('patch:observed', { index, count: batches.length })
      expect(batches[index]!.input.sources.get(sourceId)).toBe(source(utility))
      expect(batches[index]!.code).toContain(utility)
      expect(batches[index]!.graphCode).toContain(utility)
      await engine.notifyPayloadDelivered(batches[index]!.filename)
      record('patch:delivered', { index })
      // 补丁回调早于原生 watcher 提交，下一轮编辑必须等待 coordinator 完成。
      await engine.ensureCurrentBuildFinish()
      record('patchBuild:end', { index })
      const state = await engine.getBundleState()
      record('patchState', { index, ...state })
      expect(seedUpdateTypes.every(type => type === 'Noop')).toBe(true)
    }
    expect(batches[0]!.input.sources.get(sourceId)).toBe(source('py-6.5'))
    expect(batches[1]!.input.revision).toBeGreaterThan(batches[0]!.input.revision)
    expect(batches[0]!.filename).not.toBe(batches[1]!.filename)
  }
  catch (error) {
    try {
      process.stderr.write(`[compiler-batch-native] ${JSON.stringify({ extraDependency, batches: batches.length, events })}\n`)
    }
    catch {
      // 诊断输出失败不得覆盖原始断言异常。
    }
    throw error
  }
  finally {
    await engine.close()
    await running
    await rm(root, { recursive: true, force: true })
  }
})
