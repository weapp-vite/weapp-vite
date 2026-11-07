import type { CompilerContext } from '../../../../context'
import type { VueBundleCompileOptionsState } from '../bundle/shared'
import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { WEVU_APP_SHELL_VIRTUAL_PREFIX } from '@weapp-core/constants'
import path from 'pathe'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { parse } from 'vue/compiler-sfc'
import { compileVueFile } from 'wevu/compiler'
import { withCompilerSourceSnapshot } from '../../../utils/sourceSnapshot'
import { compileAppShellRuntime } from './index'
import { usesNativeSlotOwnerRuntime } from './options'

vi.mock('wevu/compiler', async (importOriginal) => {
  const original = await importOriginal<typeof import('wevu/compiler')>()
  return { ...original, compileVueFile: vi.fn(original.compileVueFile) }
})

vi.mock('../compileOptions', () => ({
  createCompileVueFileOptions: vi.fn((
    _ctx: CompilerContext,
    _pluginCtx: unknown,
    _filename: string,
    isPage: boolean,
    isApp: boolean,
    configService: CompilerContext['configService'],
  ) => ({
    isPage,
    isApp,
    template: configService.weappViteConfig.vue?.template,
    minify: false,
  })),
}))

const roots: string[] = []

beforeEach(() => {
  vi.mocked(compileVueFile).mockClear()
})

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

async function fixture(source: string, platform: CompilerContext['configService']['platform'] = 'weapp') {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), 'weapp-shell-runtime-')))
  roots.push(root)
  const sourceId = path.join(root, 'app.vue')
  await writeFile(sourceId, source)
  const ctx = {
    configService: {
      isDev: true,
      platform,
      absoluteSrcRoot: root,
      outputExtensions: { js: 'js', json: 'json', wxml: 'wxml', wxss: 'wxss' },
      weappViteConfig: { vue: { template: { nativeSlotContext: true, scopedSlotsRequireProps: true } } },
      relativeOutputPath: (file: string) => path.relative(root, file),
    },
    scanService: { loadAppEntry: vi.fn(async () => ({ path: sourceId })) },
  } as unknown as CompilerContext
  const appShell = {
    file: path.join(root, '__weapp_vite_app_shell'),
    importPath: '/__weapp_vite_app_shell',
    tagName: 'weapp-app-shell',
  }
  const compileOptionsState: VueBundleCompileOptionsState = {
    reExportResolutionCache: new Map(),
    classStyleRuntimeWarned: { value: false },
  }
  const pluginCtx = {
    resolve: vi.fn(async (id: string, importer: string) => ({ id: path.resolve(path.dirname(importer), id) })),
  }
  return { root, sourceId, ctx, appShell, compileOptionsState, pluginCtx }
}

describe('App shell native slot runtime', () => {
  it('does not load an App when no shell is present', async () => {
    const f = await fixture('<template><view><slot /></view></template>')

    expect(await compileAppShellRuntime({ ...f, appShell: undefined })).toBeUndefined()
    expect(f.ctx.scanService.loadAppEntry).not.toHaveBeenCalled()
    expect(compileVueFile).not.toHaveBeenCalled()
  })

  it.each([
    { platform: 'weapp', nativeSlotContext: false, scopedSlotsRequireProps: true },
    { platform: 'weapp', nativeSlotContext: true, scopedSlotsRequireProps: false },
    { platform: 'weapp', nativeSlotContext: true, scopedSlotsRequireProps: undefined },
    { platform: 'alipay', nativeSlotContext: true, scopedSlotsRequireProps: true },
  ])('does not compile outside the explicit opt-in: %j', async (options) => {
    const f = await fixture('<template><view><slot /></view></template>', options.platform as CompilerContext['configService']['platform'])
    f.ctx.configService.weappViteConfig.vue = { template: {
      nativeSlotContext: options.nativeSlotContext,
      scopedSlotsRequireProps: options.scopedSlotsRequireProps,
    } }

    expect(usesNativeSlotOwnerRuntime(f.ctx.configService)).toBe(false)
    expect(await compileAppShellRuntime(f)).toBeUndefined()
    expect(f.ctx.scanService.loadAppEntry).not.toHaveBeenCalled()
    expect(compileVueFile).not.toHaveBeenCalled()
  })

  it('compiles a component registration while excluding App scripts, styles and app-only JSON', async () => {
    const f = await fixture(`
<script>globalThis.appModuleExecutions += 1; export default {}</script>
<script setup>globalThis.appSetupExecutions += 1</script>
<template><view class="shell"><slot /></view></template>
<style scoped>.shell { color: red; }</style>
<json>{
  "pages": ["pages/home/index"],
  "window": { "navigationBarTitleText": "App only" },
  "usingComponents": { "native-card": "/components/native-card/index" },
  "componentGenerics": { "row": true }
}</json>`)

    const result = await compileAppShellRuntime(f)
    const [source, filename, options] = vi.mocked(compileVueFile).mock.calls[0]!
    const { descriptor, errors } = parse(source, { filename })

    expect(errors).toEqual([])
    expect(descriptor.script).toBeNull()
    expect(descriptor.scriptSetup).toBeNull()
    expect(descriptor.styles).toEqual([])
    expect(descriptor.template?.content).toBe('<view class="shell"><slot /></view>')
    expect(JSON.parse(descriptor.customBlocks.find(block => block.type === 'json')!.content)).toEqual({
      usingComponents: { 'native-card': '/components/native-card/index' },
      componentGenerics: { row: true },
    })
    expect(options).toMatchObject({ isPage: false, isApp: false, skipComponentTransform: false })
    expect(result?.code).toContain('createWevuComponent')
    expect(result?.code).not.toContain('appModuleExecutions')
    expect(result?.code).not.toContain('appSetupExecutions')
    expect(result?.code).not.toContain('createApp')
  })

  it('retains the original App identity and output path independently of the component compilation filename', async () => {
    const f = await fixture('<template><view><slot /></view></template>')
    f.ctx.configService.outputExtensions.js = 'cjs'

    const result = await compileAppShellRuntime(f)

    expect(result).toMatchObject({
      id: `${WEVU_APP_SHELL_VIRTUAL_PREFIX}${f.sourceId}`,
      sourceId: f.sourceId,
      fileName: '__weapp_vite_app_shell.cjs',
    })
    expect(result?.dependencies).toContain(f.sourceId)
    expect(vi.mocked(compileVueFile).mock.calls[0]?.[1]).toBe(`${f.appShell.file}.vue`)
    expect(path.dirname(vi.mocked(compileVueFile).mock.calls[0]![1])).toBe(path.dirname(f.sourceId))
  })

  it('uses the frozen App and external template inputs after the files change on disk', async () => {
    const original = '<script setup>const appOnly = true</script><template src="./shell.html" />'
    const f = await fixture(original)
    const templateId = path.join(f.root, 'shell.html')
    const frozenTemplate = '<view class="frozen"><slot /></view>'
    await writeFile(templateId, '<view class="newer"><slot /></view>')
    await writeFile(f.sourceId, '<template><view class="new-app"><slot /></view></template>')

    const result = await withCompilerSourceSnapshot(f.ctx.configService, new Map([
      [f.sourceId, original],
      [templateId, frozenTemplate],
    ]), async () => await compileAppShellRuntime(f))

    expect(vi.mocked(compileVueFile).mock.calls[0]?.[0]).toContain(frozenTemplate)
    expect(vi.mocked(compileVueFile).mock.calls[0]?.[0]).not.toContain('newer')
    expect(vi.mocked(compileVueFile).mock.calls[0]?.[0]).not.toContain('new-app')
    expect(result?.dependencies).toEqual(expect.arrayContaining([f.sourceId, templateId]))
    expect(f.pluginCtx.resolve).toHaveBeenCalledWith('./shell.html', f.sourceId)

    await compileAppShellRuntime(f)
    expect(vi.mocked(compileVueFile).mock.calls[1]?.[0]).toContain('new-app')
    expect(vi.mocked(compileVueFile).mock.calls[1]?.[0]).not.toContain('frozen')
  })

  it.each(['<script setup>const appOnly = true</script>', '<template> </template>'])('does not emit a runtime for an App without a shell template: %s', async (source) => {
    const f = await fixture(source)

    expect(await compileAppShellRuntime(f)).toBeUndefined()
    expect(compileVueFile).not.toHaveBeenCalled()
  })
})
