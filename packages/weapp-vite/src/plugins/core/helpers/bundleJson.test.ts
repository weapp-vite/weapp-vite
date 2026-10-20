import type { CorePluginState } from './types'
import { expect, it, vi } from 'vitest'
import { createJsonEmitManager } from '../../hooks/useLoadEntry/jsonEmit'
import { emitJsonAssets } from './bundle'

it('publishes core JSON once while leaving Vue configuration to its final compiler publisher', () => {
  const manager = createJsonEmitManager({ isDev: true } as any)
  manager.register({ fileName: 'pages/native.json', json: { component: false }, type: 'page' })
  manager.register({ fileName: 'pages/vue.json', json: { component: false }, type: 'page', publisher: 'vue' })
  const resolve = vi.fn((entry: { json: unknown }) => JSON.stringify(entry.json))
  const emitFile = vi.fn()
  const state = {
    ctx: {
      configService: { isDev: true },
      jsonService: { resolve },
      runtimeState: { json: { emittedSource: new Map() } },
    },
    hmrState: { hasBuiltOnce: false, didEmitAllEntries: true },
    jsonEmitFilesMap: manager.map,
    pendingJsonEmitFilesMap: manager.pendingMap,
  } as unknown as CorePluginState

  emitJsonAssets.call({ emitFile }, state)
  expect(emitFile).toHaveBeenCalledExactlyOnceWith({ type: 'asset', fileName: 'pages/native.json', source: '{"component":false}' })
  expect(resolve).toHaveBeenCalledTimes(1)
  expect(manager.pendingMap.size).toBe(0)
})
