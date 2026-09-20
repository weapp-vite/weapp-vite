import type { CompilerContext } from '../../context'
import path from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resolveVueSfcHmrSignatures } from 'wevu/compiler'
import { createRuntimeState } from '../../runtime/runtimeState'
import { normalizeFsResolvedId } from '../../utils/resolvedId'
import { createVueResolverPlugin, getVirtualModuleId } from './resolver'

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
      configService: { cwd, absoluteSrcRoot: path.join(cwd, 'src'), isDev: true },
      runtimeState: createRuntimeState(),
    } as CompilerContext
    const plugin = createVueResolverPlugin(ctx)
    const load = typeof plugin.load === 'function' ? plugin.load : plugin.load!.handler
    return { ctx, filename, load: (id: string) => load.call({} as any, id) }
  }

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

  it('leaves custom virtual SFC and style subrequests to their source owners', async () => {
    const { filename, load } = createFixture()
    expect(await load('\0custom-component.vue')).toBeNull()
    expect(await load(`${filename}?vue&type=style`)).toBeNull()
    expect(readFileMock).not.toHaveBeenCalled()
  })
})
