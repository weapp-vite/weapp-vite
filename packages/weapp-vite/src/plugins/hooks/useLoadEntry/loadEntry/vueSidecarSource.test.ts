import type { PluginContext } from 'rolldown'
import type { CompilerContext } from '../../../../context'
import type { CompilationCacheEntry } from '../../../vue/transform/bundle/shared/types'
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { build } from 'vite'
import { expect, it, vi } from 'vitest'
import { compileVueFile } from 'wevu/compiler'
import { createRuntimeState } from '../../../../runtime/runtimeState'
import { css } from '../../../css'
import { createOutputFinalizerPlugin, createOutputPublicationPlugin } from '../../../outputFinalizer'
import { readCompilerInput } from '../../../utils/sourceSnapshot'
import { refreshCompiledVueEntryCacheInDev } from '../../../vue/transform/bundle/shared/compile'
import { emitEntryOutput } from './emit'

it('keeps first-load and watch binding locations identical while natively publishing adjacent SFC styles', async () => {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'weapp-vue-style-source-')))
  const src = path.join(root, 'src')
  const filename = path.join(src, 'pages/index/index.vue')
  const style = path.join(src, 'pages/index/index.css')
  const entry = path.join(src, 'app.js')
  const source = [
    '<script setup>',
    'const message = "hello"',
    '</script>',
    '<template>',
    '<view :title="message">{{ message }}</view>',
    '</template>',
    '<style src="./index.css"></style>',
  ].join('\n')
  const runtimeState = createRuntimeState()
  const configService = {
    cwd: root,
    absoluteSrcRoot: src,
    isDev: true,
    platform: 'weapp',
    weappViteConfig: {},
    outputExtensions: { wxss: 'wxss', wxml: 'wxml' },
    relativeOutputPath: (file: string) => path.relative(src, file).replaceAll('\\', '/'),
    relativeAbsoluteSrcRoot: (file: string) => path.relative(src, file).replaceAll('\\', '/'),
  } as unknown as NonNullable<CompilerContext['configService']>
  const ctx = {
    configService,
    runtimeState,
    scanService: { subPackageMap: new Map() },
  } as unknown as CompilerContext
  const pluginCtx = { addWatchFile: vi.fn() } as unknown as PluginContext
  const load = () => emitEntryOutput({
    pluginCtx,
    id: filename,
    type: 'page',
    json: {},
    jsonPath: filename,
    templatePath: '',
    isPluginBuild: false,
    normalizedEntries: [],
    entriesMap: new Map(),
    resolveEntriesWithCache: async () => [],
    configService,
    runtimeState,
    resolvedEntryMap: new Map(),
    loadedEntrySet: new Set(),
    dirtyEntrySet: new Set(),
    replaceLayoutDependencies: () => {},
    replaceEntryDependencies: () => {},
    emitEntriesChunks: () => [],
    registerJsonAsset: () => {},
    existsCache: new Map(),
    pathExistsTtlMs: 0,
    relativeCwdId: 'src/pages/index/index.vue',
    getTime: () => '',
    entryResolveRoot: src,
  })
  const render = () => build({
    root,
    configFile: false,
    logLevel: 'silent',
    plugins: [...css(ctx), createOutputFinalizerPlugin(ctx), createOutputPublicationPlugin(ctx)],
    build: {
      emptyOutDir: false,
      minify: false,
      cssMinify: false,
      rolldownOptions: { input: entry, output: { format: 'es', entryFileNames: 'app.js' } },
    },
  })
  const outputStyle = () => readFile(path.join(root, 'dist/pages/index/index.wxss'), 'utf8')
  try {
    await mkdir(path.dirname(filename), { recursive: true })
    await writeFile(filename, source)
    await writeFile(entry, 'export const marker = "sidecar-output"')
    await writeFile(style, '.page { color: red; }')
    const loaded = await load()
    expect(loaded?.code).toBe(source)
    expect(runtimeState.css.sidecarImports).toContain(style)
    const first = await compileVueFile(loaded!.code, filename)
    const direct = await compileVueFile(await readCompilerInput(configService, filename), filename)
    expect(first.bindingManifest).toEqual(direct.bindingManifest)
    const binding = first.bindingManifest?.bindings.find(item => item.kind === 'attribute' && item.outputPath === 'message')
    expect(binding?.sourceLocation?.start).toMatchObject({
      offset: source.indexOf('message">'),
      line: 5,
    })
    const cached: CompilationCacheEntry = { result: first, source: loaded!.code, isPage: true }
    await render()
    expect(await outputStyle()).toContain('red')

    for (const color of ['blue', 'red']) {
      await writeFile(style, `.page { color: ${color}; }`)
      runtimeState.build.hmr.isRebuild = true
      runtimeState.build.hmr.didEmitAllEntries = true
      runtimeState.build.hmr.profile = { dirtyReasonSummary: ['style-sidecar:1'] }
      runtimeState.build.hmr.dirtyVueEntryIds.add(filename)
      const refreshed = await refreshCompiledVueEntryCacheInDev({
        filename,
        cached,
        ctx,
        pluginCtx,
        configService,
        compileOptionsState: { reExportResolutionCache: new Map(), classStyleRuntimeWarned: { value: false } },
      })
      expect(refreshed.bindingManifest).toEqual(first.bindingManifest)
      expect(refreshed.script).toBe(first.script)
      expect(cached.source).toBe(source)
      await render()
      expect(await outputStyle()).toContain(color)
    }
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})
