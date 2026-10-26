import type { CompilerContext } from '../../context'
import path from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resolveVueSfcHmrSignatures } from 'wevu/compiler'
import { getInitialBuildInputObservation, startInitialBuildInputObservation } from '../../runtime/buildPlugin/initialBuildChanges'
import { bindRequestedIdeConfigReader } from '../../runtime/classicIdeConfig/reader'
import { createRuntimeState } from '../../runtime/runtimeState'
import { normalizeFsResolvedId } from '../../utils/resolvedId'
import { compilerSourceId } from '../compilerPlugin/hmr'
import { withCompilerSourceSnapshot } from '../utils/sourceSnapshot'
import { createVueResolverPlugin, getVirtualModuleId } from './resolver'
import { buildWeappVueStyleRequest } from './transform/styleRequest'

const readFileMock = vi.hoisted(() => vi.fn())
vi.mock('../utils/cache', () => ({
  readFile: readFileMock,
  pathExists: vi.fn(),
}))

describe('Vue resolver raw source ownership', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function createFixture() {
    const cwd = path.resolve('sfc-source-fixture')
    const filename = normalizeFsResolvedId(path.join(cwd, 'src/Component.vue'))
    const ctx = {
      configService: { cwd, absoluteSrcRoot: path.join(cwd, 'src'), isDev: true, packageJson: { dependencies: { wevu: 'workspace:*' } } },
      runtimeState: createRuntimeState(),
    } as CompilerContext
    const plugin = createVueResolverPlugin(ctx)
    const load = typeof plugin.load === 'function' ? plugin.load : plugin.load!.handler
    return { ctx, filename, plugin, load: (id: string) => load.call({} as any, id) }
  }

  it.each([
    { command: 'serve', bundledDev: true, stable: true },
    { command: 'serve', bundledDev: false, stable: false },
    { command: 'build', bundledDev: true, stable: false },
  ])('keeps style factory identity across edit and recovery only in native dev ($command/$bundledDev)', async ({ command, bundledDev, stable }) => {
    const { filename, plugin } = createFixture()
    if (typeof plugin.configResolved === 'function') {
      await plugin.configResolved.call({} as any, { command, experimental: { bundledDev } } as any)
    }
    const resolveId = typeof plugin.resolveId === 'function' ? plugin.resolveId : plugin.resolveId!.handler
    const ids = await Promise.all([undefined, 'style-edit', 'dependency-recovery', undefined].map(async hmrToken => resolveId.call({} as any, buildWeappVueStyleRequest(filename, { module: 'theme', scoped: true, lang: 'scss' } as any, 0, { hmrToken }), filename, {} as any)))
    expect(new Set(ids).size).toBe(stable ? 1 : 3)
    for (const id of ids) {
      expect(id).toContain('?weapp-vite-vue&type=style&index=0&scoped=true&module=theme')
      expect(id).toMatch(/&lang\.scss$/)
      if (stable) {
        expect(id).not.toContain('&hmr=')
      }
    }
    const otherBlock = await resolveId.call({} as any, buildWeappVueStyleRequest(filename, { module: 'other', lang: 'scss' } as any, 1, { hmrToken: 'style-edit' }), filename, {} as any)
    expect(otherBlock).not.toBe(ids[1])
  })

  it.each([false, true])('captures the exact returned source before later disk changes, legacy virtual=%s', async (legacy) => {
    const { ctx, filename, load } = createFixture()
    const sourceA = '<script setup>const count = 1</script><template><view>A</view></template>'
    const sourceB = sourceA.replace('count = 1', 'count = 2')
    readFileMock.mockResolvedValueOnce(sourceA).mockResolvedValue(sourceB)
    const id = legacy ? getVirtualModuleId(filename) : filename
    const loaded = await load(id)
    expect(loaded).toMatchObject({ code: sourceA })
    expect(ctx.runtimeState.build.hmr.vueEntrySfcSignatures.get(filename)).toEqual(resolveVueSfcHmrSignatures(sourceA, filename).blockSignatures)
    expect(readFileMock).toHaveBeenCalledOnce()

    await load(id)
    expect(ctx.runtimeState.build.hmr.vueEntrySfcSignatures.get(filename)).toEqual(resolveVueSfcHmrSignatures(sourceB, filename).blockSignatures)
  })

  it.each(['update', 'create'] as const)('deduplicates a consumed SFC startup %s and retains later content changes', async (event) => {
    const { ctx, filename, load } = createFixture()
    const source = '<script setup>const count = 1</script><template><view>A</view></template>'
    let current = source
    readFileMock.mockImplementation(async () => current)
    bindRequestedIdeConfigReader(ctx.configService, async () => current)
    const release = startInitialBuildInputObservation(ctx.configService)
    const observation = getInitialBuildInputObservation(ctx.configService)!
    try {
      observation.begin()
      expect(await load(filename)).toMatchObject({ code: source })
      observation.commit('initial-routes')
      const change = { file: filename, event, verifyInitialInput: true, initialRoute: { signature: 'initial-routes' } }
      expect(await observation.filter([change])).toEqual([])
      current = source.replace('count = 1', 'count = 2')
      expect(await observation.filter([change])).toEqual([change])
      current = source
      expect(await observation.filter([change])).toEqual([change])
    }
    finally {
      release()
    }
  })

  it.each([false, true])('uses the compiler generation raw input for SFC loads, legacy virtual=%s', async (legacy) => {
    const { ctx, filename, load } = createFixture()
    const pinned = '<template><view>published generation</view></template>'
    readFileMock.mockResolvedValue('<template><view>new disk input</view></template>')
    await withCompilerSourceSnapshot(ctx.configService, new Map([[compilerSourceId(filename), pinned]]), async () => {
      expect(await load(legacy ? getVirtualModuleId(filename) : filename)).toMatchObject({ code: pinned })
    })
    expect(readFileMock).not.toHaveBeenCalled()
  })

  it('leaves custom virtual SFC and style subrequests to their source owners', async () => {
    const { filename, load } = createFixture()
    expect(await load('\0custom-component.vue')).toBeNull()
    expect(await load(`${filename}?vue&type=style`)).toBeNull()
    expect(readFileMock).not.toHaveBeenCalled()
  })
})
