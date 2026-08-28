import { describe, expect, it, vi } from 'vitest'
import { createRuntimeState } from '../../runtime/runtimeState'
import { flushIndependentOutputs } from './independent'

function createContext() {
  return {
    runtimeState: createRuntimeState(),
  } as any
}

describe('output finalizer independent outputs', () => {
  it('emits completed child chunks and assets once with available provenance', async () => {
    const ctx = createContext()
    const emitAsset = vi.fn()
    ctx.runtimeState.build.independent.pendingOutputs = [
      Promise.resolve({
        output: [
          {
            type: 'chunk',
            code: 'Page({})',
            fileName: 'pkg/pages/index.js',
            name: 'pages/index',
          },
          {
            type: 'asset',
            fileName: 'pkg/pages/index.wxss',
            names: ['index.wxss'],
            originalFileNames: ['/project/src/pkg/pages/index.css'],
            source: '.page{}',
          },
        ],
      }),
      Promise.resolve({
        output: [
          {
            type: 'asset',
            fileName: 'other/index.wxml',
            names: [],
            originalFileNames: [],
            source: '<view />',
          },
        ],
      }),
    ]

    await flushIndependentOutputs(ctx, undefined, emitAsset)
    await flushIndependentOutputs(ctx, undefined, emitAsset)

    expect(emitAsset).toHaveBeenCalledTimes(3)
    expect(emitAsset).toHaveBeenNthCalledWith(1, {
      type: 'asset',
      fileName: 'pkg/pages/index.js',
      name: 'pages/index',
      source: 'Page({})',
    })
    expect(emitAsset).toHaveBeenNthCalledWith(2, {
      type: 'asset',
      fileName: 'pkg/pages/index.wxss',
      name: 'index.wxss',
      originalFileName: '/project/src/pkg/pages/index.css',
      source: '.page{}',
    })
    expect(emitAsset).toHaveBeenNthCalledWith(3, {
      type: 'asset',
      fileName: 'other/index.wxml',
      source: '<view />',
    })
    expect(ctx.runtimeState.build.independent.pendingOutputs).toEqual([])
  })

  it('clears the pending queue when a child build rejects', async () => {
    const ctx = createContext()
    const emitAsset = vi.fn()
    ctx.runtimeState.build.independent.pendingOutputs = [
      Promise.reject(new Error('child build failed')),
    ]

    await expect(flushIndependentOutputs(ctx, undefined, emitAsset)).rejects.toThrow('child build failed')

    expect(emitAsset).not.toHaveBeenCalled()
    expect(ctx.runtimeState.build.independent.pendingOutputs).toEqual([])
  })

  it('does not consume the parent queue from a child finalizer', async () => {
    const ctx = createContext()
    const pendingOutput = Promise.resolve({ output: [] })
    ctx.runtimeState.build.independent.pendingOutputs = [pendingOutput]
    const emitAsset = vi.fn()

    await flushIndependentOutputs(ctx, { subPackage: { root: 'pkg' } } as any, emitAsset)

    expect(emitAsset).not.toHaveBeenCalled()
    expect(ctx.runtimeState.build.independent.pendingOutputs).toEqual([pendingOutput])
  })
})
