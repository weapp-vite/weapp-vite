import type { PluginContext } from 'rolldown'
import type { CompilerContext } from '../../../../context'
import type { Entry } from '../../../../types'
import { mkdtemp, realpath, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'pathe'
import { expect, it, vi } from 'vitest'
import { resolveVueSfcHmrSignatures } from 'wevu/compiler'
import { createRuntimeState } from '../../../../runtime/runtimeState'
import { transformUniAppCompatibilitySource } from '../../../uniApp'
import { setCompilerSourceSnapshot } from '../../../utils/sourceSnapshot'
import { composeVueEntryJsonConfig } from '../../../vue/transform/bundle/shared/entryJson'
import { createExtendedLibManager } from '../extendedLib'
import { createEntryLoader } from './index'

const emitEntryOutput = vi.hoisted(() => vi.fn(async (options: { entryCodeSource?: string, normalizedEntries: string[] }) => options.entryCodeSource))
vi.mock('./emit', async importOriginal => ({
  ...await importOriginal<typeof import('./emit')>(),
  emitEntryOutput,
}))
vi.mock('../../../../utils', async importOriginal => ({
  ...await importOriginal<typeof import('../../../../utils')>(),
  findJsonEntry: async () => ({ path: undefined, predictions: [] }),
  findTemplateEntry: async () => ({ path: undefined, predictions: [] }),
}))
vi.mock('../../../vue/transform/pageLayout', async importOriginal => ({
  ...await importOriginal<typeof import('../../../vue/transform/pageLayout')>(),
  resolvePageLayoutPlan: async () => undefined,
}))
vi.mock('../../../vue/transform/usingComponentResolver', () => ({
  resolveUsingComponentReference: async (_plugin: unknown, _config: unknown, _cache: unknown, source: string) => ({
    from: `/components/${source.includes('Hidden') ? 'Hidden' : 'Active'}`,
  }),
}))

it('loads prepared conditional metadata while preserving raw transform inputs and HMR baselines', async () => {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'entry-uni-input-')))
  try {
    const filename = path.join(root, 'pages/index.vue')
    const source = (condition: string, marker = 'inactive') => `<script setup>
import Active from '../components/Active.vue'
import Hidden from '../components/Hidden.vue'
// #ifdef MP-WEIXIN
definePageJson({ navigationBarTitleText: 'wechat' })
// #endif
// #ifndef MP-WEIXIN
definePageJson({ navigationBarTitleText: 'foreign' })
// #endif
</script>
<template><Active />
<!-- #${condition} MP-WEIXIN -->
<Hidden /><view>${marker}</view>
<!-- #endif -->
</template>`
    const snapshots = new Map<string, string | null>([[filename, source('ifndef')]])
    const runtimeState = createRuntimeState()
    const entriesMap = runtimeState.build.hmr.entriesMap as Map<string, Entry | undefined>
    const ctx = {
      runtimeState,
      configService: {
        platform: 'weapp',
        isDev: true,
        absoluteSrcRoot: root,
        options: { cwd: root },
        weappViteConfig: { uniApp: { include: [] } },
        relativeCwd: (id: string) => path.relative(root, id),
        relativeAbsoluteSrcRoot: (id: string) => path.relative(root, id),
      },
      jsonService: { cache: new Map() },
      moduleGraphService: { replaceEntryDependencies: vi.fn() },
    } as unknown as CompilerContext
    setCompilerSourceSnapshot(ctx.configService, snapshots)
    const loader = createEntryLoader({
      ctx,
      entriesMap,
      loadedEntrySet: new Set(),
      dirtyEntrySet: new Set(),
      resolvedEntryMap: new Map(),
      replaceLayoutDependencies: vi.fn(),
      normalizeEntry: entry => entry.replace(/^\//, ''),
      registerJsonAsset: vi.fn(),
      scanTemplateEntry: vi.fn(),
      emitEntriesChunks: vi.fn(() => []),
      applyAutoImports: vi.fn(() => []),
      extendedLibManager: createExtendedLibManager(),
    })
    const plugin = { addWatchFile: vi.fn() } as unknown as PluginContext
    const inspect = async (raw: string, withHidden: boolean) => {
      snapshots.set(filename, raw)
      await loader.call(plugin, filename, 'page')
      const entry = entriesMap.get('pages/index')!
      const json = entry.json as { navigationBarTitleText?: string, usingComponents?: Record<string, string> }
      expect(json.navigationBarTitleText).toBe('wechat')
      expect(json.usingComponents).toEqual(withHidden
        ? { Active: '/components/Active', Hidden: '/components/Hidden' }
        : { Active: '/components/Active' })
      const emitted = emitEntryOutput.mock.calls.at(-1)![0]
      expect(emitted.entryCodeSource).toBe(raw)
      expect(emitted.normalizedEntries).toEqual(withHidden
        ? ['components/Active', 'components/Hidden']
        : ['components/Active'])
      const composed = JSON.parse(composeVueEntryJsonConfig(ctx, filename, '{"usingComponents":{"active":"/components/Active"}}')!) as { usingComponents: Record<string, string> }
      expect(composed.usingComponents).toEqual(withHidden
        ? { active: '/components/Active', hidden: '/components/Hidden' }
        : { active: '/components/Active' })
      expect(runtimeState.build.hmr.vueEntrySfcSignatures.get(filename)).toEqual(resolveVueSfcHmrSignatures(raw, filename).blockSignatures)
      expect(runtimeState.build.hmr.vueEntryContentSignatures?.get(filename)).toEqual(resolveVueSfcHmrSignatures(raw, filename).contentSignatures)
    }
    const initial = source('ifndef')
    await inspect(initial, false)
    expect(entriesMap.has('components/Hidden')).toBe(false)
    expect(transformUniAppCompatibilitySource(ctx.configService, initial, filename)).not.toBe(initial)
    await inspect(source('ifndef', 'inactive-edit'), false)
    await inspect(source('ifdef'), true)
    await inspect(initial, false)
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})
