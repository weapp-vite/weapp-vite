import type { CorePluginState } from './helpers'
import { expect, it, vi } from 'vitest'
import { createRequireAnalysisPlugin } from './requireAnalysis'

it('deduplicates concurrent async discovery and rolls back failed emission within a generation', async () => {
  const emitted = new Set<string>()
  const plugin = createRequireAnalysisPlugin({
    ctx: { configService: {}, scanService: {} },
    requireAsyncEmittedChunks: emitted,
  } as unknown as CorePluginState)
  const moduleParsed = plugin.moduleParsed as (this: unknown, info: unknown) => Promise<void>
  const info = { meta: { requireAsyncDependencies: [{ id: 'feature.ts', fileName: 'feature.js' }] } }
  const gate = Promise.withResolvers<void>()
  const load = vi.fn(async () => await gate.promise)
  const failure = new Error('native emission failed')
  const emitFile = vi.fn().mockImplementationOnce(() => {
    throw failure
  })
  const first = moduleParsed.call({ load, emitFile }, info)
  const duplicate = moduleParsed.call({ load, emitFile }, info)
  expect(load).toHaveBeenCalledTimes(1)
  gate.resolve()
  await expect(first).rejects.toBe(failure)
  await duplicate
  expect(emitted.size).toBe(0)

  await moduleParsed.call({ load, emitFile }, info)
  expect(emitFile).toHaveBeenCalledTimes(2)
  expect(emitFile).toHaveBeenLastCalledWith({ type: 'chunk', id: 'feature.ts', fileName: 'feature.js', preserveSignature: 'exports-only' })
  expect(emitted).toEqual(new Set(['feature.ts']))
})
