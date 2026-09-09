import type { Plugin } from 'rolldown'
import type { CompilerContext } from '../../context'
import path from 'node:path'
import { rolldown } from 'rolldown'
import { describe, expect, it } from 'vitest'
import { createSidecarModuleId } from '../../moduleGraph/protocol'
import { resetEmittedOutputCaches } from '../../runtime/buildPlugin/outputs'
import { createRuntimeState } from '../../runtime/runtimeState'
import { createOutputFinalizerPlugin } from '../outputFinalizer'

describe.each(['graph-only', 'preprocessor'] as const)('output finalizer %s style writes through Rolldown', (kind) => {
  function createFixture() {
    const root = path.resolve('graph-style-fixture')
    const srcRoot = path.join(root, 'src')
    const runtimeState = createRuntimeState()
    const ctx = {
      runtimeState,
      configService: {
        isDev: true,
        platform: 'weapp',
        outputExtensions: { wxss: 'wxss' },
        relativeOutputPath: (file: string) => path.relative(srcRoot, file).replaceAll('\\', '/'),
      },
    } as unknown as CompilerContext
    const ownerId = path.join(srcRoot, 'pages/index/index.ts')
    const sidecarId = createSidecarModuleId(ownerId, path.join(srcRoot, 'pages/index/index.wxss'), 'style')
    const graphAsset = kind === 'graph-only'
      ? `weapp_vite_external/graph/${sidecarId.replace(/\.js$/, '.wxss')}`
      : 'pages/index/index.scss'
    const build = async (template: string, style = '.page{color:red}') => {
      const diagnostics: Array<{ level: string, message: string }> = []
      const bundle = await rolldown({
        input: 'virtual:entry',
        onLog(level, log) {
          diagnostics.push({ level, message: log.message })
        },
        plugins: [
          {
            name: 'fixture',
            resolveId: id => id === 'virtual:entry' ? id : null,
            load: id => id === 'virtual:entry' ? 'export const marker = 1' : null,
            generateBundle() {
              this.emitFile({ type: 'asset', fileName: graphAsset, source: style })
              this.emitFile({ type: 'asset', fileName: 'pages/index/index.wxml', source: template })
            },
          },
          createOutputFinalizerPlugin(ctx) as Plugin,
        ],
      })
      try {
        const output = await bundle.generate({ format: 'es', sourcemap: true })
        expect(diagnostics.filter(log => log.level === 'warn' || log.level === 'error')).toEqual([])
        return output
      }
      finally {
        await bundle.close()
      }
    }
    const beginUpdate = () => {
      runtimeState.build.hmr.profile = { event: 'update', file: path.join(srcRoot, 'pages/index/index.wxml'), dirtyReasonSummary: ['sidecar-direct:1'] }
    }
    return { build, beginUpdate, runtimeState }
  }

  it('does not rewrite unchanged styles during a template-only snapshot', async () => {
    const { build, beginUpdate, runtimeState } = createFixture()
    const initial = await build('<view>initial</view>')
    const chunk = initial.output.find(output => output.type === 'chunk')
    expect(chunk).toBeDefined()
    expect(initial.output.find(output => output.fileName === `${chunk!.fileName}.map`)).toMatchObject({ type: 'asset' })
    expect(initial.output.find(output => output.fileName === 'pages/index/index.wxss')).toMatchObject({ source: '.page{color:red}' })
    expect(runtimeState.build.output.emittedSource.get('pages/index/index.wxss')).toBe('.page{color:red}')
    beginUpdate()
    const updated = await build('<view>updated</view>')
    expect(updated.output.find(output => output.fileName === 'pages/index/index.wxml')).toMatchObject({ source: '<view>updated</view>' })
    expect(updated.output.find(output => output.fileName === 'pages/index/index.wxss')).toBeUndefined()
  })

  it('publishes a real style change and remembers its final source', async () => {
    const { build, beginUpdate, runtimeState } = createFixture()
    await build('<view>initial</view>')
    beginUpdate()
    const updated = await build('<view>initial</view>', '.page{color:blue}')
    expect(updated.output.find(output => output.fileName === 'pages/index/index.wxss')).toMatchObject({ source: '.page{color:blue}' })
    expect(runtimeState.build.output.emittedSource.get('pages/index/index.wxss')).toBe('.page{color:blue}')
    const unchanged = await build('<view>updated</view>', '.page{color:blue}')
    expect(unchanged.output.find(output => output.fileName === 'pages/index/index.wxss')).toBeUndefined()
  })

  it('restores unchanged styles after the full output cleanup clears emit caches', async () => {
    const { build, beginUpdate, runtimeState } = createFixture()
    await build('<view>initial</view>')
    beginUpdate()
    resetEmittedOutputCaches(runtimeState)
    const rebuilt = await build('<view>initial</view>')
    expect(rebuilt.output.find(output => output.fileName === 'pages/index/index.wxss')).toMatchObject({ source: '.page{color:red}' })
    expect(rebuilt.output.find(output => output.fileName === 'pages/index/index.wxml')).toMatchObject({ source: '<view>initial</view>' })
  })
})
