import type { CompilerContext } from '../../context'
import type { WeappCompilerHmrPreparation } from '../../types/compilerPlugin'
import type { StatefulHmrSnapshot } from './globalStyles'
import { expect, it, vi } from 'vitest'
import { compileHmrBatch } from './compileBatch'

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
