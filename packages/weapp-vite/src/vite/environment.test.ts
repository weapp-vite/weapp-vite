import type { Plugin } from 'vite'
import type { PreparedNpmOutput } from './npm'
import type { WeappBuildSession } from './session'
import { describe, expect, it, vi } from 'vitest'
import { createSessionEnvironmentPlugin } from './environment'

type Phase = 'options' | 'buildStart' | 'generateBundle' | 'writeBundle'

function fixture(watchMode = false, serve = false) {
  const dependencies: PreparedNpmOutput = {
    assets: [{ type: 'asset', fileName: 'miniprogram_npm/mini-card/index.js', source: 'Component({})' }],
    external: new Map(),
    watchFiles: ['node_modules/mini-card/miniprogram/index.js', 'node_modules/mini-card/package.json'],
  }
  const session = {
    validateEntries: vi.fn(async () => {}),
    buildDependencies: vi.fn(async () => dependencies),
    publishDependencies: vi.fn(async () => {}),
    close: vi.fn(async () => {}),
  }
  const context = {
    meta: { watchMode },
    addWatchFile: vi.fn<(file: string) => void>(),
    emitFile: vi.fn<(asset: PreparedNpmOutput['assets'][number]) => string>(() => 'asset-reference'),
  }
  const plugin = createSessionEnvironmentPlugin(session as unknown as WeappBuildSession, serve)
  const run = async (phase: Phase, ...args: unknown[]) => {
    const hook: Plugin[Phase] = plugin[phase]
    const handler = typeof hook === 'function' ? hook : hook?.handler
    if (!handler) {
      throw new Error(`Missing environment hook: ${phase}`)
    }
    return await (handler as (this: typeof context, ...args: unknown[]) => unknown).apply(context, args)
  }
  return { dependencies, session, context, run }
}

describe('standard Vite environment dependency publication', () => {
  it.each([false, true])('finishes dependency input registration before scanning and emits during generate (write: %s)', async (write) => {
    const { dependencies, session, context, run } = fixture()
    const prepared = Promise.withResolvers<PreparedNpmOutput>()
    session.buildDependencies.mockReturnValue(prepared.promise)
    await run('options')
    let scanStarted = false
    context.addWatchFile.mockImplementation(() => {
      expect(scanStarted).toBe(false)
    })
    const starting = run('buildStart').then(() => {
      scanStarted = true
    })
    expect(scanStarted).toBe(false)
    expect(context.addWatchFile).not.toHaveBeenCalled()
    expect(context.emitFile).not.toHaveBeenCalled()

    prepared.resolve(dependencies)
    await starting
    expect(context.addWatchFile.mock.calls.map(([file]) => file)).toEqual(dependencies.watchFiles)
    expect(context.emitFile).not.toHaveBeenCalled()
    // 生成阶段复用已经完成的准备结果；新输入不能拖到写盘后才交给原生 watcher。
    await run('generateBundle', {}, {}, write)
    expect(context.addWatchFile).toHaveBeenCalledTimes(dependencies.watchFiles.length)
    expect(context.emitFile.mock.calls.map(([asset]) => asset)).toEqual(dependencies.assets)
    expect(session.publishDependencies).not.toHaveBeenCalled()
    expect(session.validateEntries).toHaveBeenCalledOnce()
    if (write) {
      await run('writeBundle', {}, {})
      expect(session.publishDependencies).toHaveBeenCalledOnce()
    }
  })

  it('waits for watch entry validation before preparing dependencies for the next scan', async () => {
    const { dependencies, session, context, run } = fixture(true)
    await run('options')
    const validated = Promise.withResolvers<void>()
    session.validateEntries.mockReturnValueOnce(validated.promise)
    const starting = run('buildStart')
    expect(session.buildDependencies).not.toHaveBeenCalled()
    expect(context.addWatchFile).not.toHaveBeenCalled()
    validated.resolve()
    await starting
    expect(session.validateEntries).toHaveBeenCalledTimes(2)
    expect(context.addWatchFile.mock.calls.map(([file]) => file)).toEqual(dependencies.watchFiles)
  })

  it('preserves a watch validation failure without starting dependency work or closing the session', async () => {
    const { session, context, run } = fixture(true)
    const failure = new Error('invalid app entry')
    session.validateEntries.mockRejectedValueOnce(failure)
    await expect(run('buildStart')).rejects.toBe(failure)
    expect(session.buildDependencies).not.toHaveBeenCalled()
    expect(context.addWatchFile).not.toHaveBeenCalled()
    expect(context.emitFile).not.toHaveBeenCalled()
    expect(session.close).not.toHaveBeenCalled()
  })

  it.each([false, true])('propagates npm preparation failure before registering inputs or publishing outputs (watch: %s)', async (watchMode) => {
    const { session, context, run } = fixture(watchMode)
    const failure = new Error('dependency compilation failed')
    session.buildDependencies.mockRejectedValueOnce(failure)
    await run('options')
    await expect(run('buildStart')).rejects.toBe(failure)
    expect(context.addWatchFile).not.toHaveBeenCalled()
    expect(context.emitFile).not.toHaveBeenCalled()
    expect(session.publishDependencies).not.toHaveBeenCalled()
    expect(session.close).not.toHaveBeenCalled()
  })

  it('leaves dependency preparation and publication to the serving host', async () => {
    const { session, context, run } = fixture(true, true)
    await run('options')
    await run('buildStart')
    await run('generateBundle', {}, {}, false)
    await run('writeBundle', {}, {})
    expect(session.validateEntries).not.toHaveBeenCalled()
    expect(session.buildDependencies).not.toHaveBeenCalled()
    expect(session.publishDependencies).not.toHaveBeenCalled()
    expect(context.addWatchFile).not.toHaveBeenCalled()
    expect(context.emitFile).not.toHaveBeenCalled()
  })
})
