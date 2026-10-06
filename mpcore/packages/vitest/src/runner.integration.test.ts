import type { Reporter, TestRunResult } from 'vitest/node'
import type { MpcoreArtifactWatchCallbacks } from './config'
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
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
    const workspace = await realpath(await mkdtemp(path.join(os.tmpdir(), 'mpcore-runner-watch-')))
    const root = path.join(workspace, 'project')
    const externalManifest = path.join(workspace, 'dependency/package.json')
    let runner: Awaited<ReturnType<typeof createVitest>> | undefined
    const close = vi.fn(async () => undefined)
    try {
      await mkdir(root)
      await mkdir(path.dirname(externalManifest))
      await writeFile(externalManifest, JSON.stringify({ name: 'external-fixture' }))
      const fixture = await createRunnerFixture(root)
      const { mpcoreTest } = await import(configEntry.href) as typeof import('./config')
      const build = vi.fn(async () => fixture.artifacts[0]!)
      let callbacks!: MpcoreArtifactWatchCallbacks
      const watch = vi.fn(async (hooks: MpcoreArtifactWatchCallbacks) => {
        callbacks = hooks
        return { artifact: fixture.artifacts[0]!, close }
      })
      const results: TestRunResult[] = []
      const reruns: { files: string[], trigger?: string }[] = []
      const reporter: Reporter = {
        onWatcherRerun(files, trigger) {
          reruns.push({ files: files.map(file => path.relative(root, file).split(path.sep).join('/')), trigger })
        },
        onTestRunEnd(testModules, unhandledErrors) {
          results.push({ testModules: [...testModules], unhandledErrors: [...unhandledErrors] })
        },
      }
      runner = await createVitest({
        root,
        config: false,
        watch: true,
        // 仅本 fixture 的清单可触发全量重跑；外部依赖仍保留 Vitest 的模块图监听。
        forceRerunTriggers: [path.join(root, 'package.json').split(path.sep).join('/')],
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
      // 模拟宿主已观察到的外部清单变化，不修改共享仓库或依赖其他测试的写入时序。
      runner.vite.watcher.emit('change', externalManifest.split(path.sep).join('/'))
      // 在文件监听的防抖窗口后核对没有额外执行；原项目重跑与关闭断言均保持精确计数。
      await new Promise(resolve => setTimeout(resolve, 1_000))
      expect(results, JSON.stringify({ reruns, events: await fixture.events() })).toHaveLength(2)
      expect(await fixture.events()).toEqual(updated)
      await runner.close()
      expect(close).toHaveBeenCalledOnce()
      await callbacks.onRebuilt(fixture.artifacts[0]!)
      expect(await fixture.events()).toEqual(updated)
    }
    finally {
      await runner?.close()
      await rm(workspace, { recursive: true, force: true })
    }
  }, 120_000)
})
