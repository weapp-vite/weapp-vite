import type { OutputBundle } from 'rolldown'
import type { CompilerContext } from '../context'
import type { WxmlValidate } from '../types'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { createRuntimeState } from '../runtime/runtimeState'
import { getWxmlWatchFiles } from '../wxml/processing/dependencies'
import { createOutputFinalizerPlugin, createOutputPublicationPlugin } from './outputFinalizer'

function context(validate: WxmlValidate) {
  const root = path.join(os.tmpdir(), 'wxml-publish')
  return {
    configService: {
      cwd: root,
      outDir: path.join(root, 'dist'),
      platform: 'weapp',
      isDev: true,
      mode: 'development',
      weappViteConfig: { wxml: { validate, remove: { attr: ['data-clean'] } } },
    },
    runtimeState: createRuntimeState(),
  } as unknown as CompilerContext
}

const bundle = (source: string) => ({ 'page.wxml': { type: 'asset', fileName: 'page.wxml', source } }) as unknown as OutputBundle
const pluginContext = () => ({ emitFile: vi.fn(), warn: vi.fn(), addWatchFile: vi.fn() })
async function publish(ctx: CompilerContext, output: OutputBundle, plugin = pluginContext(), subPackageMeta?: any) {
  const hook = createOutputPublicationPlugin(ctx, subPackageMeta).generateBundle
  const handler = typeof hook === 'function' ? hook : hook?.handler
  await handler?.call(plugin as any, {} as any, output, false)
  return plugin
}

describe('final template validation publication boundary', () => {
  it('observes cleanup and output plugin changes before HMR pruning, without mutating output', async () => {
    const seen: string[] = []
    const ctx = context((code) => {
      seen.push(code)
    })
    const output = bundle('<view data-clean="gone"/>')
    const hook = createOutputFinalizerPlugin(ctx).generateBundle
    const handler = typeof hook === 'function' ? hook : hook?.handler
    await handler?.call(pluginContext() as any, {} as any, output, false)
    ;(output['page.wxml'] as any).source += '<text>compiler output</text>'
    await publish(ctx, output)
    const code = '<view /><text>compiler output</text>'
    expect(seen).toEqual([code])
    expect(output['page.wxml']).toMatchObject({ source: code })
    ctx.runtimeState.build.hmr.profile.event = 'update'
    const unchanged = bundle(code)
    await publish(ctx, unchanged)
    expect(seen).toEqual([code, code])
    expect(unchanged['page.wxml']).toBeUndefined()
  })

  it('blocks publication/cache updates on rule errors and publishes the corrected retry', async () => {
    let fail = true
    const ctx = context((_, options) => {
      if (fail) {
        options.report({ severity: 'error', message: 'invalid' })
      }
    })
    ctx.runtimeState.build.output.emittedSource.set('page.wxml', '<view>previous</view>')
    ctx.runtimeState.build.hmr.profile.event = 'update'
    const output = bundle('<view>next</view>')
    const plugin = pluginContext()
    await expect(publish(ctx, output, plugin)).rejects.toThrow('invalid')
    expect(plugin.emitFile).not.toHaveBeenCalled()
    expect(ctx.runtimeState.build.output.emittedSource.get('page.wxml')).toBe('<view>previous</view>')
    fail = false
    await publish(ctx, output, plugin)
    expect(output['page.wxml']).toBeDefined()
    expect(ctx.runtimeState.build.output.emittedSource.get('page.wxml')).toBe('<view>next</view>')
  })

  it('waits for child validation before updating parent fingerprints and does not revalidate merged children', async () => {
    const validate = vi.fn<WxmlValidate>()
    const ctx = context(validate)
    ctx.runtimeState.build.hmr.profile.event = 'update'
    ctx.runtimeState.build.output.emittedSource.set('page.wxml', '<view>previous</view>')
    ctx.runtimeState.build.independent.pendingOutputs = [Promise.reject(new Error('child validation failed'))]
    const plugin = pluginContext()
    await expect(publish(ctx, bundle('<view>next</view>'), plugin)).rejects.toThrow('child validation failed')
    expect(ctx.runtimeState.build.output.emittedSource.get('page.wxml')).toBe('<view>previous</view>')
    expect(plugin.emitFile).not.toHaveBeenCalled()
    ctx.runtimeState.build.independent.pendingOutputs = [Promise.resolve({ output: [{ type: 'asset', fileName: 'sub/index.wxml', source: '<view>child</view>', names: [], originalFileNames: [] }] })]
    const next = bundle('<view>next</view>')
    await publish(ctx, next, plugin)
    expect(next['page.wxml']).toBeDefined()
    expect(validate).toHaveBeenCalledTimes(2)
    expect(plugin.emitFile).toHaveBeenCalledWith(expect.objectContaining({ fileName: 'sub/index.wxml' }))
  })

  it('retains pending dependencies through failure and commits both phases after successful publication', async () => {
    let fail = true
    const ctx = context((_, options) => {
      options.addWatchFile('validation.json')
      if (fail) {
        options.report({ severity: 'error', message: 'retry' })
      }
    })
    const wxml = ctx.configService.weappViteConfig.wxml
    if (typeof wxml !== 'object') {
      throw new TypeError('Missing config')
    }
    wxml.transform = (code, options) => {
      options.addWatchFile('transform.json')
      return code
    }
    const run = async () => {
      const output = bundle('<view/>')
      const hook = createOutputFinalizerPlugin(ctx).generateBundle
      const handler = typeof hook === 'function' ? hook : hook?.handler
      await handler?.call(pluginContext() as any, {} as any, output, false)
      return publish(ctx, output)
    }
    await expect(run()).rejects.toThrow('retry')
    expect(ctx.runtimeState.wxmlProcessing.dependencies.size).toBe(0)
    expect(getWxmlWatchFiles(ctx).map(file => path.basename(file)).sort()).toEqual(['transform.json', 'validation.json'])
    fail = false
    await run()
    expect(ctx.runtimeState.wxmlProcessing.dependencies.size).toBe(2)
    expect(ctx.runtimeState.wxmlProcessing.pending.size).toBe(0)
  })
})

it('measures completed async template and validation stages without changing publication', async () => {
  let now = 100
  const clock = vi.spyOn(performance, 'now').mockImplementation(() => now)
  try {
    const ctx = context(async () => {
      await Promise.resolve()
      now += 11
    })
    ctx.configService.weappViteConfig.wxml = {
      ...ctx.configService.weappViteConfig.wxml as object,
      transform: async (code) => {
        await Promise.resolve()
        now += 7
        return code
      },
    }
    const output = bundle('<view data-clean="gone"/>')
    const hook = createOutputFinalizerPlugin(ctx).generateBundle
    const handler = typeof hook === 'function' ? hook : hook?.handler
    await handler?.call(pluginContext() as any, {} as any, output, false)
    await publish(ctx, output)
    expect(ctx.runtimeState.build.hmr.profile).toMatchObject({ finalizeTemplateMs: 7, publicationValidateMs: 11 })
    expect(output['page.wxml']).toMatchObject({ source: '<view />' })
  }
  finally {
    clock.mockRestore()
  }
})
