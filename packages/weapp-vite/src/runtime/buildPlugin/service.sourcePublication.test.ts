import type { RolldownWatcher } from 'rolldown'
import type { MutableCompilerContext } from '../../context'
import type { DevModuleGraphObserver } from '../../moduleGraph/devProvider'
import { EventEmitter } from 'node:events'
import path from 'pathe'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { attachDevModuleGraphHost, connectDevModuleGraphHost, notifyDevModuleGraphHost } from '../../moduleGraph/host'
import { getDevModuleGraphSourceObservation } from '../../moduleGraph/sourceObservation'
import { compilerSourceId } from '../../plugins/compilerPlugin/hmr'
import { compilerNativeScriptVersion, readCompilerInput } from '../../plugins/utils/sourceSnapshot'
import { attachHmrRuntimeSession, getHmrRuntimeSession } from '../hmrRuntimeSession'
import { createContext, mocks } from './serviceRestart/fixture'

const rawRead = vi.hoisted(() => vi.fn())
vi.mock('../../plugins/compilerPlugin/rawInputs', async importOriginal => ({
  ...await importOriginal<typeof import('../../plugins/compilerPlugin/rawInputs')>(),
  readCompilerRawInput: rawRead,
}))

// 复用原生 service 的观测门禁；只替换外部构建器和 watcher，不复制资格判断。
const { createBuildService } = await import('./service')

beforeEach(() => {
  vi.stubEnv('WEAPP_VITE_HMR_PROFILE_JSON', '')
  mocks.watch.mockImplementation(() => {
    const watcher = Object.assign(new EventEmitter(), {
      add: vi.fn(),
      unwatch: vi.fn(async () => {}),
      close: vi.fn(async () => { watcher.removeAllListeners() }),
    })
    setImmediate(() => watcher.emit('ready'))
    return watcher
  })
  mocks.assets.mockImplementation(() => ({ ready: Promise.resolve(), close: vi.fn(async () => {}) }))
  mocks.provider.mockImplementation(async (...args) => {
    const [context, , onChange] = args
    const observe = (args as unknown[])[3] as DevModuleGraphObserver
    const provider = connectDevModuleGraphHost(context as Parameters<typeof connectDevModuleGraphHost>[0], onChange, observe)
    expect(provider).toBeDefined()
    return { close: vi.fn(async () => provider!.close()) }
  })
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.clearAllMocks()
  mocks.restarts.length = 0
})

it('observes a late old-host save through the real service gate after graph reset and completes it in the replacement cold publication', async () => {
  const previous = createContext()
  const replacement = createContext()
  const file = compilerSourceId(path.join(previous.configService.absoluteSrcRoot, 'pages/home/index.ts'))
  const unrelated = path.join(previous.configService.absoluteSrcRoot, 'unrelated.ts')
  const root = path.resolve(previous.configService.outDir)
  const runtime = getHmrRuntimeSession(previous)
  const releaseRuntime = attachHmrRuntimeSession(replacement, runtime)
  let previousGraphAvailable = true
  vi.spyOn(previous.moduleGraphService, 'hasModule').mockImplementation(id => previousGraphAvailable && id === file)
  previous.moduleGraphService.resetSession.mockImplementation(() => {
    previousGraphAvailable = false
  })
  Object.assign(previous.moduleGraphService, { bindDevServer: () => () => {} })
  Object.assign(replacement.moduleGraphService, { bindDevServer: () => () => {} })
  const previousHost = previous as unknown as Parameters<typeof attachDevModuleGraphHost>[0]
  const replacementHost = replacement as unknown as Parameters<typeof attachDevModuleGraphHost>[0]
  const oldObservation = getDevModuleGraphSourceObservation(previous)
  const detachPrevious = attachDevModuleGraphHost(previousHost, {} as never)
  const detachReplacement = attachDevModuleGraphHost(replacementHost, {} as never)
  let original: RolldownWatcher | undefined
  let current: RolldownWatcher | undefined
  let savedEventId: string | undefined
  let replacementInputEvents: unknown
  rawRead.mockImplementation(() => ({ source: 'A', digest: compilerNativeScriptVersion('A'), byteLength: 1, version: 'A' }))
  mocks.build.mockImplementation(async () => {
    const initial = mocks.build.mock.calls.length === 1
    const context = initial ? previous : replacement
    if (!initial) {
      // BASE 已成功发布，旧图随后关闭；A 在替换 cold begin 之后、实际输入之前才送达。
      expect(previous.moduleGraphService.hasModule(file)).toBe(false)
      const change = oldObservation.observe({ event: 'update', file })
      expect(change.sourceEvent).toBeDefined()
      savedEventId = change.sourceEvent?.eventId
      const pending = runtime.sourcePublication.capture(root)
      expect(pending).toHaveLength(1)
      expect(pending[0]?.version).toBe(compilerNativeScriptVersion('A'))
      const duplicate = oldObservation.observe({ event: 'update', file })
      expect(duplicate.sourceEvent).toBe(change.sourceEvent)
      expect(oldObservation.observe({ event: 'update', file: unrelated }).sourceEvent).toBeUndefined()
      expect(runtime.sourcePublication.capture(root)).toEqual(pending)
      // 迟到事件只能保留来源，旧宿主不再接收调度，也不能让新代额外构建一次。
      notifyDevModuleGraphHost(previousHost, change)
    }
    await readCompilerInput(context.configService, file, async () => initial ? 'BASE' : 'A')
    if (!initial) {
      replacementInputEvents = context.runtimeState.build.hmr.profile.sourceEvents
      expect(replacementInputEvents).toEqual([expect.objectContaining({ eventId: savedEventId, file })])
    }
    // 仅模拟 bundler 已提交的代际身份；测试不生成或补写任何产物。
    runtime.outputGenerations.set(root, { fingerprint: initial ? 'BASE' : 'A', scopes: new Map() })
    return { output: [] }
  })
  try {
    original = await createBuildService(previous as unknown as MutableCompilerContext).build({ skipNpm: true }) as RolldownWatcher
    expect(runtime.sourcePublication.capture(root)).toEqual([])
    expect(runtime.sourcePublication.knowsSource(root, file)).toBe(true)
    await original.close()
    await previous.watcherService.closeAll()
    detachPrevious()
    expect(previous.moduleGraphService.resetSession).toHaveBeenCalled()
    expect(previous.moduleGraphService.hasModule(file)).toBe(false)
    current = await createBuildService(replacement as unknown as MutableCompilerContext).build({ skipNpm: true }) as RolldownWatcher
    // 只有真实 service 的输入、原生提交和正式 END 全部通过，来源 token 才会被确认。
    expect(replacementInputEvents).toEqual([expect.objectContaining({ eventId: savedEventId, file })])
    expect(runtime.sourcePublication.capture(root)).toEqual([])
    expect(mocks.build).toHaveBeenCalledTimes(2)
    expect(mocks.logger.error).not.toHaveBeenCalled()
    expect(mocks.forbiddenIo).not.toHaveBeenCalled()
  }
  finally {
    await current?.close()
    await original?.close()
    await Promise.all([previous.watcherService.closeAll(), replacement.watcherService.closeAll()])
    detachPrevious()
    detachReplacement()
    releaseRuntime()
    runtime.sourcePublication.close()
  }
})
