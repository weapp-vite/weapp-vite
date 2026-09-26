import { expect, it, vi } from 'vitest'
import { emitJsonAssets } from './bundle'

it('emits empty page configuration and keeps unchanged JSON emission deduplicated', () => {
  const state = {
    ctx: {
      jsonService: { resolve: (entry: { json: unknown }) => JSON.stringify(entry.json) },
      configService: {},
      runtimeState: { json: { emittedSource: new Map() } },
    },
    jsonEmitFilesMap: new Map([
      ['page', { fileName: 'packageB/pages/index/index.json', entry: { type: 'page', json: {} } }],
      ['component', { fileName: 'components/card/index.json', entry: { type: 'component', json: { component: true } } }],
    ]),
  } as unknown as Parameters<typeof emitJsonAssets>[0]
  const emitFile = vi.fn()
  emitJsonAssets.call({ emitFile }, state)
  expect(emitFile).toHaveBeenCalledWith(expect.objectContaining({
    type: 'asset',
    fileName: 'packageB/pages/index/index.json',
    source: '{}',
  }))
  expect(emitFile).toHaveBeenCalledWith(expect.objectContaining({
    type: 'asset',
    fileName: 'components/card/index.json',
    source: '{"component":true}',
  }))
  emitFile.mockClear()
  emitJsonAssets.call({ emitFile }, state)
  expect(emitFile).not.toHaveBeenCalled()
})
