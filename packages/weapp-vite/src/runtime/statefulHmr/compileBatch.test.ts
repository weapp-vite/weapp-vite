import type { CompilerContext } from '../../context'
import type { WeappCompilerHmrPreparation } from '../../types/compilerPlugin'
import type { StatefulHmrSnapshot } from './globalStyles'
import type { HmrPreparationObservation } from './preparationProfile'
import path from 'pathe'
import { afterEach, expect, it, vi } from 'vitest'
import { compileHmrBatch } from './compileBatch'

afterEach(() => vi.restoreAllMocks())

function compile(snapshot: StatefulHmrSnapshot, preparation: WeappCompilerHmrPreparation) {
  return compileHmrBatch({
    ctx: { configService: { outputExtensions: { wxml: 'wxml', wxss: 'wxss' } } } as CompilerContext,
    input: { revision: 1, changedFiles: ['page.vue'], sources: new Map() },
    needsSnapshot: true,
    patches: [],
    prepareProviders: async () => [preparation],
    rebuild: async () => snapshot,
    sourcemap: false,
  })
}

it('transforms getter-only native assets without mutating the producer snapshot', async () => {
  const asset = {
    type: 'asset' as const,
    fileName: 'pages/index.wxml',
    get source() { return '<view>before</view>' },
  }
  const output = [asset]
  const snapshot: StatefulHmrSnapshot = { output, componentPageGlobalStyleRoutes: [], glassEaselAnalysisByOwner: new Map() }
  const dispose = vi.fn()
  const result = await compile(snapshot, {
    transformTemplate: async ({ code }) => ({ code: code.replace('before', 'after') }),
    dispose,
  })

  expect(result.snapshot).not.toBe(snapshot)
  expect(result.snapshot?.output[0]).toMatchObject({ fileName: asset.fileName, source: '<view>after</view>' })
  expect(snapshot.output).toBe(output)
  expect(snapshot.output[0]).toBe(asset)
  expect(asset.source).toBe('<view>before</view>')
  await result.dispose()
  await result.dispose()
  expect(dispose).toHaveBeenCalledOnce()
})

it('preserves frozen snapshot assets and releases preparations when a later transform fails', async () => {
  const output = [
    { type: 'asset' as const, fileName: 'app.wxss', source: '.before{}' },
    { type: 'asset' as const, fileName: 'pages/index.wxml', source: '<view>before</view>' },
  ]
  const snapshot: StatefulHmrSnapshot = Object.freeze({ output, componentPageGlobalStyleRoutes: [], glassEaselAnalysisByOwner: new Map() })
  const failure = new Error('template transform rejected')
  const dispose = vi.fn()
  await expect(compile(snapshot, {
    assets: [{ fileName: 'app.wxss', code: '.after{}' }],
    transformTemplate: async () => { throw failure },
    dispose,
  })).rejects.toBe(failure)

  expect(snapshot.output).toBe(output)
  expect(output.map(asset => asset.source)).toEqual(['.before{}', '<view>before</view>'])
  expect(dispose).toHaveBeenCalledOnce()
})

it('attributes sequential preparation work to the captured input without changing the snapshot', async () => {
  let now = 10
  vi.spyOn(performance, 'now').mockImplementation(() => now)
  const observations: HmrPreparationObservation[] = []
  const snapshot: StatefulHmrSnapshot = {
    output: [{ type: 'asset', fileName: 'page.wxml', source: '<view>before</view>' }],
  }
  const result = await compileHmrBatch({
    ctx: { configService: { cwd: path.resolve('.'), absoluteSrcRoot: path.resolve('src'), packageJson: {}, outputExtensions: { wxml: 'wxml', wxss: 'wxss' } } } as CompilerContext,
    input: { revision: 42, changedFiles: ['page.vue'], sources: new Map() },
    needsSnapshot: true,
    patches: [{ clientId: 'test', update: { type: 'Patch', code: 'globalThis.value = 1;', filename: 'update.js', changedIds: ['page.vue'] } }],
    prepareProviders: async () => {
      now += 3
      return [{
        transformTemplate: async ({ code }) => {
          now += 7
          return { code: code.replace('before', 'after') }
        },
        transformJavaScript: async ({ code }) => {
          now += 11
          return { code: code.replace('value = 1', 'value = 2') }
        },
      }]
    },
    rebuild: async () => {
      now += 5
      return snapshot
    },
    sourcemap: false,
    onPreparationStage: observation => observations.push(observation),
  })

  expect(observations.map(({ stage, startedAtMs, elapsedMs, status }) => ({ stage, startedAtMs, elapsedMs, status }))).toEqual([
    { stage: 'provider-wait', startedAtMs: 10, elapsedMs: 3, status: 'resolved' },
    { stage: 'snapshot-build', startedAtMs: 13, elapsedMs: 5, status: 'resolved' },
    { stage: 'template-transform', startedAtMs: 18, elapsedMs: 7, status: 'resolved' },
    { stage: 'patch-prepare', startedAtMs: 25, elapsedMs: 11, status: 'resolved' },
  ])
  expect(result.snapshot?.output[0]).toMatchObject({ source: '<view>after</view>' })
  expect(snapshot.output[0]).toMatchObject({ source: '<view>before</view>' })
  expect(result.code).toContain('globalThis.value = 2;')
  expect(result.changedIds).toEqual(['page.vue'])
  expect(result.filenames).toEqual(['update.js'])
  await result.dispose()
})

it('keeps failed snapshot evidence and preparation disposal when the diagnostic sink rejects', async () => {
  let now = 0
  vi.spyOn(performance, 'now').mockImplementation(() => now)
  const error = new Error('snapshot failure')
  const dispose = vi.fn()
  const observations: HmrPreparationObservation[] = []
  await expect(compileHmrBatch({
    ctx: {} as CompilerContext,
    input: { revision: 1, changedFiles: ['page.vue'], sources: new Map() },
    needsSnapshot: true,
    patches: [],
    prepareProviders: async () => {
      now += 2
      return [{ dispose }]
    },
    rebuild: async () => {
      now += 4
      throw error
    },
    sourcemap: false,
    onPreparationStage: (observation) => {
      observations.push(observation)
      throw new Error('diagnostic sink failure')
    },
  })).rejects.toBe(error)
  expect(observations.map(({ stage, status, elapsedMs }) => ({ stage, status, elapsedMs }))).toEqual([
    { stage: 'provider-wait', status: 'resolved', elapsedMs: 2 },
    { stage: 'snapshot-build', status: 'rejected', elapsedMs: 4 },
  ])
  expect(observations[1]!.error).toBe(error)
  expect(dispose).toHaveBeenCalledOnce()
})

it('does not read the preparation clock when observation is disabled', async () => {
  const clock = vi.spyOn(performance, 'now')
  const result = await compile({
    output: [{ type: 'asset', fileName: 'page.wxml', source: '<view>before</view>' }],
  }, {
    transformTemplate: async ({ code }) => ({ code: code.replace('before', 'after') }),
  })
  expect(clock).not.toHaveBeenCalled()
  expect(result.snapshot?.output[0]).toMatchObject({ source: '<view>after</view>' })
  await result.dispose()
})
