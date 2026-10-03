import type { Reporter, TestRunResult } from 'vitest/node'
import type { MpcoreArtifactWatchCallbacks } from './config'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { Worker } from 'node:worker_threads'
import { describe, expect, it, vi } from 'vitest'
import { createVitest } from 'vitest/node'
import { configEntry, createRunnerFixture, packageRoot } from './runner/fixtures'

function assertPassed(result: TestRunResult) {
  expect(result.unhandledErrors).toEqual([])
  expect(result.testModules.length).toBeGreaterThan(0)
  expect(result.testModules.map(module => module.state())).toEqual(result.testModules.map(() => 'passed'))
}

// 由外层工作流串行调度，本文件只创建并关闭明确拥有的 Node worker / Vitest runner。
describe('@mpcore/vitest real runner integration', { concurrent: false }, () => {
  it('imports the published config entry in an ordinary Node worker without Vitest state', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'mpcore-config-import-'))
    let worker: Worker | undefined
    try {
      const entry = path.join(root, 'import.mjs')
      await writeFile(entry, `import { parentPort } from 'node:worker_threads'\nimport { mpcoreTest } from ${JSON.stringify(configEntry.href)}\nconst plugin = mpcoreTest()\nparentPort.postMessage({ name: plugin.name, configure: typeof plugin.configureVitest })\n`)
      worker = new Worker(entry, { execArgv: [] })
      const message = await new Promise<unknown>((resolve, reject) => {
        let received = false
        worker!.once('message', (value) => {
          received = true
          resolve(value)
        })
        worker!.once('error', reject)
        worker!.once('exit', (code) => {
          if (!received) {
            reject(new Error(`Config import worker exited without a result (${code})`))
          }
        })
      })
      expect(message).toEqual({ name: 'mpcore:vitest', configure: 'function' })
    }
    finally {
      await worker?.terminate()
      await rm(root, { recursive: true, force: true })
    }
  }, 30_000)

  it('builds once and supplies an isolated runtime to every test through the real runner', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'mpcore-runner-once-'))
    let runner: Awaited<ReturnType<typeof createVitest>> | undefined
    try {
      const fixture = await createRunnerFixture(root)
      const { mpcoreTest } = await import(configEntry.href) as typeof import('./config')
      const build = vi.fn(async () => fixture.artifacts[0]!)
      const watch = vi.fn()
      runner = await createVitest({
        root,
        config: false,
        include: ['owned/*.test.mjs'],
        watch: false,
        pool: 'threads',
        isolate: false,
        maxWorkers: 1,
        coverage: { enabled: false },
        reporters: [],
      }, {
        plugins: [mpcoreTest({ artifact: { build, watch } })],
        server: { fs: { allow: [root, packageRoot] } },
      })
      assertPassed(await runner.start())
      expect(build).toHaveBeenCalledOnce()
      expect(watch).not.toHaveBeenCalled()
      expect((await fixture.events()).map(event => event.revision)).toEqual(['first', 'first'])
    }
    finally {
      await runner?.close()
      await rm(root, { recursive: true, force: true })
    }
  }, 60_000)

  it('updates provide on rerun, reruns only its project and closes its watcher once', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'mpcore-runner-watch-'))
    let runner: Awaited<ReturnType<typeof createVitest>> | undefined
    const close = vi.fn(async () => undefined)
    try {
      const fixture = await createRunnerFixture(root)
      const { mpcoreTest } = await import(configEntry.href) as typeof import('./config')
      const build = vi.fn(async () => fixture.artifacts[0]!)
      let callbacks!: MpcoreArtifactWatchCallbacks
      const watch = vi.fn(async (hooks: MpcoreArtifactWatchCallbacks) => {
        callbacks = hooks
        return { artifact: fixture.artifacts[0]!, close }
      })
      const results: TestRunResult[] = []
      const reporter: Reporter = {
        onTestRunEnd(testModules, unhandledErrors) {
          results.push({ testModules: [...testModules], unhandledErrors: [...unhandledErrors] })
        },
      }
      runner = await createVitest({
        root,
        config: false,
        watch: true,
        pool: 'threads',
        isolate: false,
        maxWorkers: 1,
        fileParallelism: false,
        coverage: { enabled: false },
        reporters: [reporter],
        projects: [
          {
            plugins: [mpcoreTest({ artifact: { build, watch } })],
            test: { name: 'owned', root, include: ['owned/*.test.mjs'], pool: 'threads', isolate: false },
          },
          { test: { name: 'other', root, include: ['other/*.test.mjs'], pool: 'threads', isolate: false } },
        ],
      }, {
        server: { fs: { allow: [root, packageRoot] }, watch: { ignored: ['**/events.log', '**/artifacts/**'] } },
      })
      assertPassed(await runner.start())
      expect(build).not.toHaveBeenCalled()
      expect(watch).toHaveBeenCalledOnce()
      const initial = await fixture.events()
      expect(initial.filter(event => event.project === 'other')).toHaveLength(1)
      expect(initial.filter(event => event.project === 'mpcore').map(event => event.revision)).toEqual(['first', 'first'])

      await callbacks.onRebuilt(fixture.artifacts[1]!)
      expect(results).toHaveLength(2)
      assertPassed(results[1]!)
      const updated = await fixture.events()
      const owned = updated.filter(event => event.project === 'mpcore')
      expect(updated.filter(event => event.project === 'other')).toHaveLength(1)
      expect(owned.map(event => event.revision)).toEqual(['first', 'first', 'second', 'second'])
      // Vitest 5 在一轮队列结束后退出 worker；每轮内共享 worker，跨轮线程身份由 runner 决定。
      for (const revision of ['first', 'second']) {
        expect(new Set(owned.filter(event => event.revision === revision).map(event => event.threadId)).size).toBe(1)
      }
      await runner.close()
      expect(close).toHaveBeenCalledOnce()
      await callbacks.onRebuilt(fixture.artifacts[0]!)
      expect(await fixture.events()).toEqual(updated)
    }
    finally {
      await runner?.close()
      await rm(root, { recursive: true, force: true })
    }
  }, 120_000)
})
