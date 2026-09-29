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
  const source = (value: string) => `globalThis.utility = ${JSON.stringify(value)}; if (import.meta.hot) import.meta.hot.accept();`
  await writeFile(entry, source('py-5.5'))
  const sourceId = compilerSourceId(entry)
  const host = new CompilerHmrHost()
  const batches: Array<{ input: ReturnType<CompilerHmrHost['freeze']>, code: string, filename: string, graphCode?: string | null }> = []
  const runtime: Record<string, unknown> = {}
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
          return await readFile(entry, 'utf8')
        }
      },
      buildStart() {
        this.addWatchFile(root)
      },
      generateBundle() {
        if (extraDependency) {
          this.addWatchFile(entry)
        }
      },
      transform(code, _id) {
        host.capture(entry, code)
      },
    }],
  }, { format: 'cjs', entryFileNames: 'app.js', sourcemap: true }, {
    watch: { exclude: [path.join(root, 'dist'), `${root}/dist/**`], skipWrite: true, usePolling: true, pollInterval: 20, compareContentsForPolling: true },
    onOutput(result) {
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
      if (result instanceof Error) {
        throw result
      }
      const input = host.freeze(result.changedFiles)
      for (const { update } of result.updates) {
        if (update.type === 'Patch') {
          batches.push({ input, code: update.code, filename: update.filename, graphCode: engine.moduleGraph.getModuleInfo('\0entry')?.code })
        }
      }
    },
  })
  const running = engine.run()
  try {
    await engine.registerClient('test-client')
    await engine.ensureCurrentBuildFinish()
    expect(runtime.utility).toBe('py-5.5')
    await engine.notifyPayloadDelivered('app.js')
    for (const [index, utility] of ['py-6.5', 'py-7.5'].entries()) {
      await writeFile(`${entry}.pending`, source(utility))
      await rename(`${entry}.pending`, entry)
      await vi.waitFor(() => expect(batches.length).toBe(index + 1), { timeout: 10_000 })
      expect(batches[index]!.input.sources.get(sourceId)).toBe(source(utility))
      expect(batches[index]!.code).toContain(utility)
      expect(batches[index]!.graphCode).toContain(utility)
    }
    expect(batches[0]!.input.sources.get(sourceId)).toBe(source('py-6.5'))
    expect(batches[1]!.input.revision).toBeGreaterThan(batches[0]!.input.revision)
    expect(batches[0]!.filename).not.toBe(batches[1]!.filename)
  }
  finally {
    await engine.close()
    await running
    await rm(root, { recursive: true, force: true })
  }
})
