import type { CompilerContext } from '../../../context'
import type { JsonResolvableEntry } from '../../../utils'
import type { WxmlEmitRuntime } from '../../utils/wxmlEmit'
import type { CorePluginState } from './types'
import { expect, it, vi } from 'vitest'
import { createRuntimeState } from '../../../runtime/runtimeState'
import { resolveJson } from '../../../utils'
import { createJsonEmitManager } from '../../hooks/useLoadEntry/jsonEmit'
import { createRenderStartHook } from '../lifecycle/emit'

vi.mock('../../utils/wxmlEmit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/wxmlEmit')>()
  return { ...actual, emitWxmlAssetsWithCache: () => [] }
})

it('publishes removed component bindings during script HMR and restores retained JSON on a full write', async () => {
  // 页面使用显式输出文件名，夹具只提供本次 JSON 发布会读取的编译服务。
  const configService = { isDev: true } as CompilerContext['configService']
  const manager = createJsonEmitManager(configService)
  const runtimeState = createRuntimeState()
  // 模板输出在本用例中隔离，只构造真实 JSON 发布需要的状态。
  const state = {
    ctx: {
      configService,
      jsonService: { resolve: (entry: JsonResolvableEntry) => resolveJson(entry, undefined, 'weapp') },
      runtimeState,
    },
    jsonEmitFilesMap: manager.map,
    pendingJsonEmitFilesMap: manager.pendingMap,
    entriesMap: new Map(),
    hmrState: { hasBuiltOnce: false, didEmitAllEntries: false },
    buildTarget: 'app',
    watchFilesSnapshot: [],
  } as unknown as CorePluginState
  const published = new Map<string, unknown>()
  const emittedNames: string[] = []
  const emitFile: WxmlEmitRuntime['emitFile'] = (asset) => {
    if (!asset.fileName || typeof asset.source !== 'string') {
      throw new Error('Expected a named JSON asset')
    }
    const json: unknown = JSON.parse(asset.source)
    published.set(asset.fileName, json)
    emittedNames.push(asset.fileName)
  }
  const renderStart = createRenderStartHook(state)
  const pageFileName = 'packageB/pages/index/index.json'
  const componentFileName = 'components/card/index.json'
  manager.register({
    fileName: pageFileName,
    type: 'page',
    json: { usingComponents: { 'probe-card': '/components/probe-card/index' } },
  })
  manager.register({ fileName: componentFileName, type: 'component', json: { component: true } })
  await renderStart.call({ emitFile })
  expect(published.get(pageFileName)).toEqual({
    usingComponents: { 'probe-card': '/components/probe-card/index' },
  })
  expect(published.get(componentFileName)).toEqual({ component: true })

  state.hmrState.hasBuiltOnce = true
  runtimeState.build.hmr.profile.dirtyReasonSummary = ['entry-direct:1']
  manager.register({ fileName: pageFileName, type: 'page', json: {} })
  emittedNames.length = 0
  await renderStart.call({ emitFile })
  expect(published.get(pageFileName)).toEqual({})
  expect(emittedNames).toEqual([pageFileName])

  manager.register({ fileName: pageFileName, type: 'page', json: {} })
  emittedNames.length = 0
  await renderStart.call({ emitFile })
  expect(emittedNames).toEqual([])

  state.hmrState.didEmitAllEntries = true
  runtimeState.json.emittedSource.clear()
  published.clear()
  await renderStart.call({ emitFile })
  expect(published.get(pageFileName)).toEqual({})
  expect(published.get(componentFileName)).toEqual({ component: true })
})
