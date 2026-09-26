import type { RolldownOutput } from 'rolldown'
import type { CompilerContext } from '../../context'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { createRuntimeState } from '../../runtime/runtimeState'
import { createOutputPublicationPlugin } from './publication'

describe('independent source ownership at publication', () => {
  it.each([false, true])('keeps precise child dependencies when the child fails=%s', async (fails) => {
    const runtimeState = createRuntimeState()
    const source = path.resolve('fixture/src/pkg/index.wxml')
    const removed = path.resolve('fixture/src/removed/index.wxml')
    runtimeState.build.independent.watchFiles.set('pkg', new Set([source]))
    runtimeState.build.independent.watchFiles.set('removed', new Set([removed]))
    const failure = new Error('child compilation failed')
    const child = Promise.withResolvers<RolldownOutput>()
    runtimeState.build.independent.pendingOutputs.push(child.promise)
    const ctx = {
      runtimeState,
      configService: { isDev: true },
      scanService: { independentSubPackageMap: new Map([['pkg', {}]]) },
    } as unknown as CompilerContext
    const plugin = createOutputPublicationPlugin(ctx)
    const hook = plugin.generateBundle!
    const handler = typeof hook === 'function' ? hook : hook.handler
    const addWatchFile = vi.fn()
    const emitFile = vi.fn()
    const publication = handler.call({ addWatchFile, emitFile } as never, {} as never, {}, false)
    if (fails) {
      child.reject(failure)
      await expect(publication).rejects.toBe(failure)
    }
    else {
      child.resolve({ output: [] })
      await publication
    }
    expect(addWatchFile).toHaveBeenCalledExactlyOnceWith(source)
    expect(emitFile).not.toHaveBeenCalled()
    expect(runtimeState.build.independent.watchFiles.has('removed')).toBe(false)
  })
})
