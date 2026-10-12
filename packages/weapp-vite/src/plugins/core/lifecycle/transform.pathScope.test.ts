import type { MutableCompilerContext } from '../../../context'
import type { CorePluginState } from '../helpers'
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'pathe'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createConfigService } from '../../../runtime/config/createConfigService'
import { createRuntimeState } from '../../../runtime/runtimeState'
import { createTransformHook } from './transform'

const temporaryRoots: string[] = []
const source = 'export const url = import.meta.url; export const response = fetch("/api")'

afterEach(() => {
  vi.restoreAllMocks()
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true })
  }
})

function createFixture(options: { requestGlobals?: boolean, platformApis?: boolean } = {}) {
  const root = path.normalize(realpathSync.native(mkdtempSync(path.join(tmpdir(), 'transform-path-'))))
  temporaryRoots.push(root)
  const srcRoot = path.join(root, 'src')
  mkdirSync(srcRoot)
  const runtimeState = createRuntimeState()
  Object.assign(runtimeState.config.options, {
    cwd: root,
    srcRoot: 'src',
    config: {
      weapp: {
        injectWebRuntimeGlobals: options.requestGlobals === false ? undefined : { enabled: true, targets: ['fetch'] },
        injectWeapi: options.platformApis ? { enabled: true, replaceWx: true, globalName: 'platformApi' } : undefined,
      },
    },
  })
  const ctx = { runtimeState } as unknown as MutableCompilerContext
  ctx.configService = createConfigService(ctx)
  const state = {
    ctx,
    entriesMap: new Map(),
    loadedEntrySet: new Set<string>(),
  } as unknown as CorePluginState
  const transform = createTransformHook(state)
  const write = (file: string) => {
    const id = path.join(srcRoot, file)
    mkdirSync(path.dirname(id), { recursive: true })
    writeFileSync(id, source)
    return id
  }
  const prepare = async (id: string, outputFile: string) => {
    state.loadedEntrySet.add(id)
    const result = await transform(source, id)
    expect(result).toMatchObject({ code: expect.stringContaining(`"/${outputFile}"`), map: null })
    expect(result).toMatchObject({ code: expect.stringContaining('installWebRuntimeGlobals') })
    expect(result).toMatchObject({ code: expect.stringContaining('fetch("/api")') })
  }
  return { ctx, state, srcRoot, transform, write, prepare }
}

describe('core transform preparation path scope', () => {
  it('prepares request globals without resolving unused import.meta output paths', async () => {
    const fixture = createFixture()
    const id = fixture.write('pages/home.ts')
    fixture.state.loadedEntrySet.add(id)
    const outputPath = vi.spyOn(fixture.ctx.configService, 'relativeOutputPath').mockImplementation(() => {
      throw new Error('unused import.meta output path')
    })
    const relative = vi.spyOn(fixture.ctx.configService, 'relativeAbsoluteSrcRoot')

    const result = await fixture.transform('export const response = fetch("/api")', id)
    expect(result).toMatchObject({ code: expect.stringContaining('installWebRuntimeGlobals'), map: null })
    expect(result).toMatchObject({ code: expect.stringContaining('fetch("/api")') })
    expect(outputPath).not.toHaveBeenCalled()
    expect(relative).toHaveBeenCalledExactlyOnceWith(id)
  })

  it('transforms platform APIs without canonicalizing unused output paths', async () => {
    const fixture = createFixture({ requestGlobals: false, platformApis: true })
    const id = fixture.write('pages/home.ts')
    const outputPath = vi.spyOn(fixture.ctx.configService, 'relativeOutputPath')
    const relative = vi.spyOn(fixture.ctx.configService, 'relativeAbsoluteSrcRoot')
    const native = vi.spyOn(realpathSync, 'native')

    const result = await fixture.transform('export const info = wx.getSystemInfoSync()', id)
    expect(result).toMatchObject({ code: expect.stringContaining('.getSystemInfoSync()'), map: null })
    expect(result).toMatchObject({ code: expect.stringContaining('["platformApi"]') })
    expect(result).toMatchObject({ code: expect.not.stringContaining('wx.getSystemInfoSync()') })
    expect(outputPath).not.toHaveBeenCalled()
    expect(relative).not.toHaveBeenCalled()
    expect(native).not.toHaveBeenCalled()
  })

  it('shares successful paths between import.meta and request global preparation', async () => {
    const fixture = createFixture()
    const id = fixture.write('pages/home.ts')
    const native = vi.spyOn(realpathSync, 'native')

    await fixture.prepare(id, 'pages/home.js')
    expect(native.mock.calls.filter(([file]) => file === fixture.srcRoot)).toHaveLength(1)
    expect(native.mock.calls.filter(([file]) => file === id)).toHaveLength(1)
    await fixture.prepare(id, 'pages/home.js')
    expect(native.mock.calls.filter(([file]) => file === fixture.srcRoot)).toHaveLength(2)
    expect(native.mock.calls.filter(([file]) => file === id)).toHaveLength(2)
  })

  it('rereads redirected source symlinks before the next transform', async () => {
    const fixture = createFixture()
    fixture.write('first/page.ts')
    fixture.write('second/page.ts')
    const link = path.join(fixture.srcRoot, 'shared')
    symlinkSync(path.join(fixture.srcRoot, 'first'), link, 'junction')
    const id = path.join(link, 'page.ts')

    await fixture.prepare(id, 'first/page.js')
    unlinkSync(link)
    symlinkSync(path.join(fixture.srcRoot, 'second'), link, 'junction')
    await fixture.prepare(id, 'second/page.js')
  })

  it('retries missing paths created before the next transform', async () => {
    const fixture = createFixture()
    const link = path.join(fixture.srcRoot, 'later')
    const id = path.join(link, 'page.ts')
    const native = vi.spyOn(realpathSync, 'native')

    await fixture.prepare(id, 'later/page.js')
    expect(native.mock.calls.filter(([file]) => file === id)).toHaveLength(2)
    fixture.write('created/page.ts')
    symlinkSync(path.join(fixture.srcRoot, 'created'), link, 'junction')
    native.mockClear()
    await fixture.prepare(id, 'created/page.js')
    expect(native.mock.calls.filter(([file]) => file === id)).toHaveLength(1)
  })

  it('propagates preparation errors and releases the scope before retry', async () => {
    const fixture = createFixture()
    const id = fixture.write('pages/home.ts')
    fixture.state.loadedEntrySet.add(id)
    const relative = fixture.ctx.configService.relativeAbsoluteSrcRoot.bind(fixture.ctx.configService)
    const failure = new Error('entry path unavailable')
    const mapping = vi.spyOn(fixture.ctx.configService, 'relativeAbsoluteSrcRoot')
      .mockImplementationOnce(relative)
      .mockImplementationOnce(() => { throw failure })
    const native = vi.spyOn(realpathSync, 'native')

    await expect(fixture.transform(source, id)).rejects.toThrow(failure)
    expect(native.mock.calls.filter(([file]) => file === fixture.srcRoot)).toHaveLength(1)
    mapping.mockRestore()
    await fixture.prepare(id, 'pages/home.js')
    expect(native.mock.calls.filter(([file]) => file === fixture.srcRoot)).toHaveLength(2)
  })
})
