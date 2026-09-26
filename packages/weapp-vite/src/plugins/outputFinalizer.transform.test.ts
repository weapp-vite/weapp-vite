import type { OutputBundle } from 'rolldown'
import type { CompilerContext } from '../context'
import type { WxmlTransform } from '../types'
import { Buffer } from 'node:buffer'
import { describe, expect, it, vi } from 'vitest'
import { createRuntimeState } from '../runtime/runtimeState'
import { createOutputFinalizerPlugin, createOutputPublicationPlugin } from './outputFinalizer'

function context(transform: WxmlTransform | WxmlTransform[]) {
  return {
    configService: {
      platform: 'weapp',
      isDev: true,
      mode: 'development',
      weappViteConfig: { wxml: { transform, remove: { attr: ['data-clean'], comment: true } } },
    },
    runtimeState: createRuntimeState(),
  } as unknown as CompilerContext
}

function bundle(source: string) {
  return { 'page.wxml': { type: 'asset', fileName: 'page.wxml', source: Buffer.from(source) } } as unknown as OutputBundle
}

async function run(ctx: CompilerContext, output: OutputBundle, emitFile = vi.fn()) {
  for (const plugin of [createOutputFinalizerPlugin(ctx), createOutputPublicationPlugin(ctx)]) {
    const hook = plugin.generateBundle
    const handler = typeof hook === 'function' ? hook : hook?.handler
    await handler?.call({ emitFile, warn: vi.fn(), addWatchFile: vi.fn() } as any, {} as any, output, false)
  }
}

describe('WXML transform output pipeline', () => {
  it('runs after platform normalization and before cleanup and HMR comparison', async () => {
    const seen: string[] = []
    const ctx = context([async (code) => {
      await Promise.resolve()
      seen.push(code)
      return `${code}<text data-clean="remove">中文</text>`
    }, code => `${code}<!-- removed -->`])
    const first = bundle('<!-- #ifdef alipay --><view id="excluded"/><!-- #endif --><view/>')
    await run(ctx, first)
    expect(seen[0]).toBe('<view/>')
    expect(first['page.wxml']).toMatchObject({ source: '<view/><text >中文</text>' })
    ctx.runtimeState.build.hmr.profile.event = 'update'
    const next = bundle('<view/>')
    await run(ctx, next)
    expect(seen).toEqual(['<view/>', '<view/>'])
    expect(next['page.wxml']).toBeUndefined()
  })

  it('aborts publication on rejection and retains the last successful HMR fingerprint', async () => {
    const failure = new Error('rule unavailable')
    const ctx = context(async () => {
      throw failure
    })
    ctx.runtimeState.build.output.emittedSource.set('page.wxml', '<view>previous</view>')
    const emitFile = vi.fn()
    await expect(run(ctx, bundle('<view>next</view>'), emitFile)).rejects.toThrow('page.wxml (callback 1): rule unavailable')
    expect(emitFile).not.toHaveBeenCalled()
    expect(ctx.runtimeState.build.output.emittedSource.get('page.wxml')).toBe('<view>previous</view>')
  })
})
