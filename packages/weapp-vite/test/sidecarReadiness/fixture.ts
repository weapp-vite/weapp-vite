import type { EventEmitter } from 'node:events'
import type { BuildService } from '../../src/runtime/buildPlugin/service'
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'pathe'
import { vi } from 'vitest'
import { createTestCompilerContext } from '../utils'

export type ReadinessWatcher = EventEmitter & {
  asset: boolean
  closed: boolean
  close: ReturnType<typeof vi.fn>
}

export interface ReadinessHarness {
  build: ReturnType<typeof vi.fn>
  sidecars: ReadinessWatcher[]
  readinessHold?: {
    asset: boolean
    observe: (watcher: ReadinessWatcher) => void
  }
}

export function leafErrors(error: unknown): unknown[] {
  return error instanceof AggregateError ? error.errors.flatMap(leafErrors) : [error]
}

/** 每个清理步骤独立执行，仅过滤测试显式预期且保持原对象身份的错误。 */
export async function cleanupReadinessFixtures(cleanups: Array<() => Promise<void>>, expectedErrors: Set<unknown>) {
  const errors: unknown[] = []
  for (const cleanup of cleanups.splice(0).reverse()) {
    try {
      await cleanup()
    }
    catch (error) {
      if (!leafErrors(error).every(failure => expectedErrors.has(failure)) && !errors.includes(error)) {
        errors.push(error)
      }
    }
  }
  if (errors.length) {
    throw new AggregateError(errors, 'Sidecar readiness fixture cleanup failed')
  }
}

/** 以真实 ready 交付点通知测试；失败时只解除本例挂起的扫描，迟到 watcher 正常就绪。 */
export async function withHeldReadiness(harness: ReadinessHarness, kind: 'sidecar' | 'asset', run: (entered: Promise<ReadinessWatcher>) => Promise<void>) {
  const entered = Promise.withResolvers<ReadinessWatcher>()
  const held = new Set<ReadinessWatcher>()
  const hold = {
    asset: kind === 'asset',
    observe(watcher: ReadinessWatcher) {
      held.add(watcher)
      entered.resolve(watcher)
    },
  }
  try {
    harness.readinessHold = hold
    await run(entered.promise)
  }
  finally {
    if (harness.readinessHold === hold) {
      harness.readinessHold = undefined
    }
    for (const watcher of held) {
      if (!watcher.closed) {
        watcher.emit('ready')
      }
    }
  }
}

/** 首构使用真实 Vite；扫描交付由调用方的生命周期闸门控制。 */
export async function startInitialBuild(harness: ReadinessHarness, cleanups: Array<() => Promise<void>>, readiness: Promise<ReadinessWatcher>) {
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
  const building: ReturnType<BuildService['build']> = compiler.ctx.buildService.build({ skipNpm: true })
  // 关闭/扫描失败前立即接住启动结果，避免测试本身遗留未处理拒绝。
  const outcome = building.then(watcher => ({ watcher }), error => ({ error: error as unknown }))
  return { ctx: compiler.ctx, outcome, sidecar: await readiness }
}
