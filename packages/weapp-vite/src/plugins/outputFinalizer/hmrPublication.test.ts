import type { OutputBundle } from 'rolldown'
import type { CompilerContext } from '../../context'
import { describe, expect, it } from 'vitest'
import { createRuntimeState } from '../../runtime/runtimeState'
import { pruneUnchangedDevHmrOutputs } from '../outputFinalizer'

describe('HMR chunk publication', () => {
  it.each([false, true])('only forces unchanged chunks for script invalidation (%s)', (forceEmitUnchangedChunks) => {
    const runtimeState = createRuntimeState()
    runtimeState.build.hmr.profile.event = 'update'
    runtimeState.build.hmr.forceEmitUnchangedChunks = forceEmitUnchangedChunks
    const previous = {
      'pages/index/index.js': 'Page({ count: 0 })',
      'components/child/index.js': 'Component({ data: { count: 0 } })',
    }
    const current = {
      ...previous,
      'components/child/index.js': 'Component({ data: { count: 1 } })',
      'components/new/index.js': 'Component({})',
    }
    for (const [file, source] of Object.entries(previous)) {
      runtimeState.build.output.emittedSource.set(file, source)
    }
    const bundle = Object.fromEntries(Object.entries(current).map(([fileName, code]) => {
      runtimeState.build.hmr.lastEmittedChunkFileNames.add(fileName)
      return [fileName, { type: 'chunk', fileName, code }]
    })) as unknown as OutputBundle
    bundle['pages/index/index.wxml'] = {
      type: 'asset',
      fileName: 'pages/index/index.wxml',
      source: '<view>updated template</view>',
    } as OutputBundle[string]

    pruneUnchangedDevHmrOutputs({ configService: { isDev: true }, runtimeState } as CompilerContext, bundle)

    expect(Boolean(bundle['pages/index/index.js'])).toBe(forceEmitUnchangedChunks)
    expect(bundle['components/child/index.js']).toMatchObject({ code: current['components/child/index.js'] })
    expect(bundle['components/new/index.js']).toMatchObject({ code: 'Component({})' })
    expect(bundle['pages/index/index.wxml']).toMatchObject({ source: '<view>updated template</view>' })
  })
})
