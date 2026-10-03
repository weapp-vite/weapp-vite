import type { Reporter, TestRunResult } from 'vitest/node'
import type { MpcoreArtifactWatchCallbacks } from '../../vitest/src/config'
import type { WeappViteTestArtifact } from './index'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { describe, expect, it, vi } from 'vitest'
import { createVitest } from 'vitest/node'
import { buildWeappViteTestArtifact, clearWeappViteTestArtifactCache, watchWeappViteTestArtifact } from './index'

const vitestBridgeRoot = fileURLToPath(new URL('../../vitest', import.meta.url))
const configEntry = pathToFileURL(path.join(vitestBridgeRoot, 'dist/config.mjs'))
const testEntry = pathToFileURL(path.join(vitestBridgeRoot, 'dist/index.mjs'))
const vitestEntry = import.meta.resolve('vitest')
const weappRoot = path.dirname(fileURLToPath(import.meta.resolve('weapp-vite/package.json')))
const viteRoot = path.dirname(fileURLToPath(import.meta.resolve('vite/package.json')))

interface RuntimeEvent {
  project: string
  revision?: string
}

function assertPassed(result: TestRunResult) {
  expect(result.unhandledErrors).toEqual([])
  expect(result.testModules.length).toBeGreaterThan(0)
  expect(result.testModules.map(module => module.state())).toEqual(result.testModules.map(() => 'passed'))
}

async function createFixture(cwd: string, host: 'vite' | 'wv') {
  const files = {
    'package.json': JSON.stringify({ type: 'module', private: true }),
    'project.config.json': JSON.stringify({ appid: 'wxb3d842a4a7e3440d', miniprogramRoot: 'dist/', compileType: 'miniprogram' }),
    'vite.config.ts': host === 'vite'
      ? `import { defineConfig } from 'vite'
import { weapp } from 'weapp-vite/vite'
export default defineConfig({ plugins: [weapp()], weapp: { srcRoot: 'src', autoRoutes: false, vue: { enable: false }, npm: { enable: false } } })`
      : `import { defineConfig } from 'weapp-vite'
export default defineConfig({ weapp: { srcRoot: 'src', autoRoutes: false, vue: { enable: false }, npm: { enable: false } } })`,
    'src/app.ts': 'App({})',
    'src/app.json': JSON.stringify({ pages: ['pages/home/index'] }),
    'src/value.ts': 'export default "first"',
    'src/pages/home/index.ts': `import value from '../../value'
Page({ data: { value, count: 0 }, tap() { this.setData({ count: this.data.count + 1 }) } })`,
    'src/pages/home/index.json': '{}',
    'src/pages/home/index.wxml': '<view>{{value}}</view><button bindtap="tap">{{count}}</button>',
    'events.log': '',
    'owned/runtime.test.mjs': `import { access, appendFile, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { inject } from ${JSON.stringify(vitestEntry)}
import { createMpcoreTest } from ${JSON.stringify(testEntry.href)}
const test = createMpcoreTest()
test('renders the explicitly built artifact', async ({ mpcore, expect }) => {
  const artifact = inject('mpcoreArtifact')
  for (const file of ['app.json', 'app.js', 'pages/home/index.json', 'pages/home/index.js', 'pages/home/index.wxml']) {
    await access(join(artifact.miniprogramRootPath, file))
  }
  const revision = JSON.parse((await readFile(${JSON.stringify(path.join(cwd, 'src/value.ts'))}, 'utf8')).replace('export default ', ''))
  const page = await mpcore.renderPage('/pages/home/index')
  expect(page.screen.getByText(revision)).toBeInTheMiniProgram()
  expect(page.screen.getByText('0')).toBeInTheMiniProgram()
  await page.user.tap(page.screen.getByRole('button'))
  expect(page.screen.getByText('1')).toBeInTheMiniProgram()
  await appendFile(${JSON.stringify(path.join(cwd, 'events.log'))}, JSON.stringify({ project: 'owned', revision }) + '\\n')
})`,
    'other/runtime.test.mjs': `import { appendFile } from 'node:fs/promises'
import { test } from ${JSON.stringify(vitestEntry)}
test('unrelated project', async () => {
  await appendFile(${JSON.stringify(path.join(cwd, 'events.log'))}, JSON.stringify({ project: 'other' }) + '\\n')
})`,
  }
  for (const [file, source] of Object.entries(files)) {
    const target = path.join(cwd, file)
    await fs.mkdir(path.dirname(target), { recursive: true })
    await fs.writeFile(target, source)
  }
  await fs.mkdir(path.join(cwd, 'node_modules'))
  await fs.symlink(weappRoot, path.join(cwd, 'node_modules/weapp-vite'), 'junction')
  await fs.symlink(viteRoot, path.join(cwd, 'node_modules/vite'), 'junction')
  return {
    options: { cwd, configFile: 'vite.config.ts', skipNpm: true },
    async events(): Promise<RuntimeEvent[]> {
      return (await fs.readFile(path.join(cwd, 'events.log'), 'utf8')).trim().split('\n').filter(Boolean).map(line => JSON.parse(line) as RuntimeEvent)
    },
  }
}

// 此文件由外层工作流串行调度，所有临时 Vitest runner / artifact watcher 都在 finally 关闭。
describe('explicit artifacts from Vite configuration in the real Vitest host', { concurrent: false }, () => {
  it.each(['vite', 'wv'] as const)('compiles and renders explicit artifacts in run mode with %s configuration', async (host) => {
    const cwd = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'mpcore-vite-host-')))
    let runner: Awaited<ReturnType<typeof createVitest>> | undefined
    try {
      const fixture = await createFixture(cwd, host)
      const { mpcoreTest } = await import(configEntry.href) as typeof import('../../vitest/src/config')
      const artifacts: WeappViteTestArtifact[] = []
      const build = vi.fn(async () => {
        const artifact = await buildWeappViteTestArtifact(fixture.options)
        artifacts.push(artifact)
        return artifact
      })
      const watch = vi.fn()
      runner = await createVitest({
        root: cwd,
        config: path.join(cwd, 'vite.config.ts'),
        include: ['owned/*.test.mjs'],
        watch: false,
        pool: 'threads',
        maxWorkers: 1,
        coverage: { enabled: false },
        reporters: [],
      }, {
        plugins: [mpcoreTest({ artifact: { build, watch } })],
        server: { fs: { allow: [cwd, vitestBridgeRoot, weappRoot] } },
      })
      assertPassed(await runner.start())
      expect(build).toHaveBeenCalledOnce()
      expect(watch).not.toHaveBeenCalled()
      expect(await fixture.events()).toEqual([{ project: 'owned', revision: 'first' }])
      expect(artifacts[0]?.miniprogramRootPath).not.toBe(path.join(cwd, 'dist'))
      await expect(fs.access(path.join(cwd, 'dist/app.json'))).rejects.toMatchObject({ code: 'ENOENT' })
    }
    finally {
      await runner?.close()
      clearWeappViteTestArtifactCache({ cwd, configFile: 'vite.config.ts', skipNpm: true })
      await fs.rm(cwd, { recursive: true, force: true })
    }
  }, 90_000)

  it('rebuilds a changed source once and reruns only the owning project through the real watcher', async () => {
    const cwd = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'mpcore-vite-watch-')))
    let runner: Awaited<ReturnType<typeof createVitest>> | undefined
    try {
      const fixture = await createFixture(cwd, 'vite')
      const { mpcoreTest } = await import(configEntry.href) as typeof import('../../vitest/src/config')
      const build = vi.fn(() => buildWeappViteTestArtifact(fixture.options))
      const rebuilt = vi.fn()
      const errors: unknown[] = []
      const close = vi.fn(async (): Promise<void> => undefined)
      const watch = vi.fn(async (callbacks: MpcoreArtifactWatchCallbacks) => {
        const watcher = await watchWeappViteTestArtifact({
          ...fixture.options,
          async onRebuilt(artifact) {
            await callbacks.onRebuilt(artifact)
            rebuilt(artifact)
          },
          onError(error) {
            errors.push(error)
            callbacks.onError(error)
          },
        })
        close.mockImplementation(() => watcher.close())
        return { artifact: watcher.artifact, close }
      })
      const results: TestRunResult[] = []
      const reruns: { files: string[], trigger?: string }[] = []
      const runs: { files: string[], reason: string, states: string[] }[] = []
      const reporter: Reporter = {
        onWatcherRerun(files, trigger) {
          reruns.push({ files: files.map(file => path.relative(cwd, file).split(path.sep).join('/')), trigger })
        },
        onTestRunEnd(testModules, unhandledErrors, reason) {
          runs.push({ files: testModules.map(module => module.relativeModuleId), reason, states: testModules.map(module => module.state()) })
          results.push({ testModules: [...testModules], unhandledErrors: [...unhandledErrors] })
        },
      }
      runner = await createVitest({
        root: cwd,
        config: path.join(cwd, 'vite.config.ts'),
        watch: true,
        pool: 'threads',
        maxWorkers: 1,
        fileParallelism: false,
        coverage: { enabled: false },
        reporters: [reporter],
        projects: [
          {
            extends: true,
            plugins: [mpcoreTest({ artifact: { build, watch } })],
            test: { name: 'owned', root: cwd, include: ['owned/*.test.mjs'] },
          },
          { test: { name: 'other', root: cwd, include: ['other/*.test.mjs'] } },
        ],
      }, {
        server: { fs: { allow: [cwd, vitestBridgeRoot, weappRoot] }, watch: { ignored: ['**/events.log', '**/.weapp-vite/**'] } },
      })
      assertPassed(await runner.start())
      expect(results, JSON.stringify({ reruns, runs })).toHaveLength(1)
      expect(watch).toHaveBeenCalledOnce()
      expect(build).not.toHaveBeenCalled()
      expect((await fixture.events()).filter(event => event.project === 'other')).toHaveLength(1)
      await fs.writeFile(path.join(cwd, 'src/value.ts'), 'export default "second"')
      await expect.poll(() => rebuilt.mock.calls.length, { timeout: 45_000 }).toBe(1)
      // 给源码事件防抖及 runner 的文件监听留出稳定窗口，排除一次编辑重复触发。
      await new Promise(resolve => setTimeout(resolve, 1_000))
      expect(errors).toEqual([])
      expect(rebuilt).toHaveBeenCalledOnce()
      expect(results, JSON.stringify({ reruns, runs, events: await fixture.events() })).toHaveLength(2)
      assertPassed(results[1]!)
      const events = await fixture.events()
      expect(events.filter(event => event.project === 'owned').map(event => event.revision)).toEqual(['first', 'second'])
      expect(events.filter(event => event.project === 'other')).toHaveLength(1)
      await runner.close()
      expect(close).toHaveBeenCalledOnce()
    }
    finally {
      await runner?.close()
      clearWeappViteTestArtifactCache({ cwd, configFile: 'vite.config.ts', skipNpm: true })
      await fs.rm(cwd, { recursive: true, force: true })
    }
  }, 120_000)
})
