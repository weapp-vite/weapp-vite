import { EventEmitter } from 'node:events'
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'pathe'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createSnapshotTemplateFixture } from '../../../test/snapshotTemplates/fixture'
import { createTestCompilerContext } from '../../../test/utils'

const harness = vi.hoisted(() => ({
  build: vi.fn(),
  change: undefined as ((change: { event: 'update' | 'create', file: string }) => void) | undefined,
  sidecars: [] as Array<EventEmitter & { closed: boolean, close: ReturnType<typeof vi.fn> }>,
  holdReadiness: false,
}))

vi.mock('vite', async importOriginal => ({ ...await importOriginal<typeof import('vite')>(), build: harness.build }))
vi.mock('../../moduleGraph/devProvider', () => ({
  createDevModuleGraphProvider: vi.fn(async (_ctx, _config, onChange) => {
    harness.change = onChange
    return { close: vi.fn(async () => {}) }
  }),
}))
vi.mock('chokidar', () => ({
  default: {
    watch: vi.fn(() => {
      const watcher = Object.assign(new EventEmitter(), {
        closed: false,
        add: vi.fn(),
        unwatch: vi.fn(),
        close: vi.fn(async () => {
          watcher.closed = true
          // Chokidar 关闭时移除全部监听器，不会补发 ready 或 close 事件。
          watcher.removeAllListeners()
        }),
      })
      harness.sidecars.push(watcher)
      setImmediate(() => {
        if (!watcher.closed && !harness.holdReadiness) {
          watcher.emit('ready')
        }
      })
      return watcher
    }),
  },
}))

const cleanups: Array<() => Promise<void>> = []
const expectedCleanupErrors = new Set<unknown>()

function leafErrors(error: unknown): unknown[] {
  return error instanceof AggregateError ? error.errors.flatMap(leafErrors) : [error]
}

async function startInitialBuild() {
  const root = path.normalize(await realpath(await mkdtemp(path.join(os.tmpdir(), 'classic-sidecar-readiness-'))))
  cleanups.push(async () => await rm(root, { recursive: true, force: true }))
  const files = {
    'package.json': JSON.stringify({ name: 'classic-sidecar-readiness', private: true, type: 'module' }),
    'project.config.json': JSON.stringify({ appid: 'wxb3d842a4a7e3440d', compileType: 'miniprogram', miniprogramRoot: 'dist/', srcMiniprogramRoot: 'src/' }),
    'src/app.ts': 'App({})',
    'src/app.json': JSON.stringify({ pages: ['pages/home/index'] }),
    'src/pages/home/index.ts': 'Page({})',
    'src/pages/home/index.json': '{}',
    'src/pages/home/index.wxml': '<view>initial publication</view>',
  }
  for (const [file, source] of Object.entries(files)) {
    const absolute = path.join(root, file)
    await mkdir(path.dirname(absolute), { recursive: true })
    await writeFile(absolute, source)
  }
  const compiler = await createTestCompilerContext({
    cwd: root,
    isDev: true,
    inlineConfig: {
      configFile: false,
      publicDir: false,
      logLevel: 'silent',
      weapp: { srcRoot: 'src', autoRoutes: false, hmr: { runtime: 'classic' }, vue: { enable: false }, npm: { enable: false } },
    },
  })
  cleanups.push(async () => {
    try {
      await compiler.ctx.watcherService.closeAll()
    }
    finally {
      await compiler.dispose()
    }
  })
  const { build: nativeBuild } = await vi.importActual<typeof import('vite')>('vite')
  harness.build.mockImplementation(nativeBuild)
  harness.holdReadiness = true
  const initialSidecars = harness.sidecars.length
  const building = compiler.ctx.buildService.build({ skipNpm: true })
  // 关闭/扫描失败前立即接住启动结果，避免测试本身遗留未处理拒绝。
  const outcome = building.then(watcher => ({ watcher }), error => ({ error: error as unknown }))
  await vi.waitFor(() => expect(harness.sidecars.slice(initialSidecars).some(watcher => watcher.listenerCount('all') > 0 && watcher.listenerCount('ready') > 0)).toBe(true))
  const sidecar = harness.sidecars.slice(initialSidecars).find(watcher => watcher.listenerCount('all') > 0 && watcher.listenerCount('ready') > 0)!
  return { ctx: compiler.ctx, outcome, sidecar }
}

beforeEach(() => {
  harness.build.mockReset()
  harness.change = undefined
  harness.sidecars = []
  harness.holdReadiness = false
  expectedCleanupErrors.clear()
})

afterEach(async () => {
  const errors: unknown[] = []
  for (const cleanup of cleanups.splice(0).reverse()) {
    try {
      await cleanup()
    }
    catch (error) {
      if (!leafErrors(error).every(failure => expectedCleanupErrors.has(failure)) && !errors.includes(error)) {
        errors.push(error)
      }
    }
  }
  if (errors.length) {
    throw new AggregateError(errors, 'Sidecar readiness fixture cleanup failed')
  }
})

it('retains the original readiness error and cleanup failure during initial startup', async () => {
  const fixture = await startInitialBuild()
  const { sidecar } = fixture
  const scanFailure = new Error('initial registration failed')
  const closeFailure = new Error('initial cleanup failed')
  sidecar.close.mockImplementationOnce(async () => {
    sidecar.closed = true
    sidecar.removeAllListeners()
    throw closeFailure
  })
  sidecar.emit('error', scanFailure)
  const result = await fixture.outcome
  expect(result).toHaveProperty('error')
  const failure = 'error' in result ? result.error : undefined
  expectedCleanupErrors.add(scanFailure)
  expectedCleanupErrors.add(closeFailure)
  // 对象身份必须保留，不能只保留遮蔽首错后的关闭文案。
  expect(leafErrors(failure)).toContain(scanFailure)
  expect(leafErrors(failure)).toContain(closeFailure)
  expect(failure).toHaveProperty('cause', scanFailure)
  for (const watcher of harness.sidecars) {
    expect(watcher.closed).toBe(true)
    expect(watcher.listenerCount('ready')).toBe(0)
    expect(watcher.listenerCount('error')).toBe(0)
  }
})

it('does not register or subscribe a generation drained before initial readiness', async () => {
  const fixture = await startInitialBuild()
  const register = vi.spyOn(fixture.ctx.watcherService, 'setRollupWatcher')
  const closing = fixture.ctx.watcherService.closeAll()
  expect(fixture.ctx.watcherService.closeAll()).toBe(closing)
  await closing
  const result = await fixture.outcome
  expect(result).toHaveProperty('watcher')
  if (!('watcher' in result) || !result.watcher || !('close' in result.watcher)) {
    throw new Error('Expected a closed classic watcher')
  }
  const onEvent = vi.fn()
  result.watcher.on('event', onEvent)
  expect(onEvent).not.toHaveBeenCalled()
  expect(register).not.toHaveBeenCalled()
  await result.watcher.close()
  await fixture.ctx.watcherService.closeAll()
  expect(fixture.ctx.watcherService.sidecarWatcherMap.size).toBe(0)
  expect(fixture.ctx.watcherService.rollupWatcherMap.size).toBe(0)
  for (const watcher of harness.sidecars) {
    expect(watcher.closed).toBe(true)
    expect(watcher.close).toHaveBeenCalledOnce()
    expect(watcher.listenerCount('ready')).toBe(0)
    expect(watcher.listenerCount('error')).toBe(0)
  }
})

it('delivers replacement readiness and cleanup errors through the original close handle', async () => {
  const fixture = await createSnapshotTemplateFixture(harness, cleanups)
  const original = fixture.ctx.watcherService.getRollupWatcher()!
  const initialSidecars = harness.sidecars.length
  harness.holdReadiness = true
  fixture.ctx.buildService.requestConfigRestart()
  fixture.update('shared/card.wxml')
  const replacementWatchers = () => harness.sidecars.slice(initialSidecars)
  await vi.waitFor(() => expect(replacementWatchers().some(watcher => watcher.listenerCount('all') > 0 && watcher.listenerCount('ready') > 0)).toBe(true))
  const replacement = replacementWatchers().find(watcher => watcher.listenerCount('all') > 0 && watcher.listenerCount('ready') > 0)!
  const scanFailure = new Error('replacement registration failed')
  const closeFailure = new Error('replacement cleanup failed')
  replacement.close.mockImplementationOnce(async () => {
    replacement.closed = true
    replacement.removeAllListeners()
    throw closeFailure
  })
  replacement.emit('error', scanFailure)
  const closing = original.close()
  expect(original.close()).toBe(closing)
  const failure = await closing.then(() => undefined, error => error as unknown)
  expectedCleanupErrors.add(scanFailure)
  expectedCleanupErrors.add(closeFailure)
  expect(leafErrors(failure)).toContain(scanFailure)
  expect(leafErrors(failure)).toContain(closeFailure)
  await expect(original.close()).rejects.toBe(failure)
  for (const watcher of harness.sidecars) {
    expect(watcher.closed).toBe(true)
    expect(watcher.listenerCount('ready')).toBe(0)
    expect(watcher.listenerCount('error')).toBe(0)
  }
})

it.each(['original handle', 'service drain'])('closes a classic config restart before its replacement sidecar is ready through the %s', async (closeVia) => {
  const fixture = await createSnapshotTemplateFixture(harness, cleanups)
  const original = fixture.ctx.watcherService.getRollupWatcher()!
  const initialSidecars = harness.sidecars.length
  harness.holdReadiness = true
  fixture.ctx.buildService.requestConfigRestart()
  await fixture.save('shared/card.wxml', '<template name="card"><view>restart publication</view></template>')
  fixture.update('shared/card.wxml')
  await vi.waitFor(() => {
    const replacement = harness.sidecars.slice(initialSidecars)
    expect(replacement.length).toBeGreaterThan(0)
    expect(replacement.some(watcher => watcher.listenerCount('ready') > 0)).toBe(true)
  })
  // 第二代已真正发布新字节，但还没有取得 ready；这是原测试 finally 开始关闭的窗口。
  expect(await fixture.readOutput('shared/card.wxml')).toContain('restart publication')
  const close = closeVia === 'original handle' ? () => original.close() : () => fixture.ctx.watcherService.closeAll()
  const closing = close()
  expect(close()).toBe(closing)
  await expect(closing).resolves.toBeUndefined()
  expect(fixture.ctx.watcherService.sidecarWatcherMap.size).toBe(0)
  expect(fixture.ctx.watcherService.rollupWatcherMap.size).toBe(0)
  for (const watcher of harness.sidecars) {
    expect(watcher.closed).toBe(true)
    expect(watcher.close).toHaveBeenCalledOnce()
    expect(watcher.listenerCount('ready')).toBe(0)
    expect(watcher.listenerCount('error')).toBe(0)
  }
})
