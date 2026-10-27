import type { Plugin } from 'vite'
import type { CompilerContext } from '../../../packages/weapp-vite/src/context'
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { build } from 'vite'
import { vi } from 'vitest'
import { createOutputPublicationPlugin } from '../../../packages/weapp-vite/src/plugins/outputFinalizer/publication'
import { createRuntimeState } from '../../../packages/weapp-vite/src/runtime/runtimeState'
import { NATIVE_PUBLICATION_PREFIX } from './files'
import { nativePublicationPlugin } from './plugin'

/** 使用真实 Vite 写出和发布裁剪，模拟构建中保存而不手写任何 dist 产物。 */
export async function createGenerationFixture(observerOrder: 'before' | 'after') {
  const project = await realpath(await mkdtemp(path.join(tmpdir(), 'native-publication-race-')))
  const src = path.join(project, 'src')
  const template = path.join(src, 'pages/index/index.wxml')
  const outputTemplate = path.join(project, 'dist/pages/index/index.wxml')
  const profilePath = path.join(project, 'hmr-profile.jsonl')
  const runtimeState = createRuntimeState()
  const ctx = {
    currentBuildTarget: 'app',
    runtimeState,
    scanService: { subPackageMap: new Map(), independentSubPackageMap: new Map() },
    configService: {
      cwd: project,
      absoluteSrcRoot: src,
      isDev: true,
      platform: 'weapp',
      weappViteConfig: { hmr: { runtime: 'classic' } },
      projectPrivateConfig: { setting: { compileHotReLoad: true } },
      outputExtensions: { wxss: 'wxss', wxml: 'wxml' },
      relativeOutputPath: (file: string) => path.relative(src, file).replaceAll('\\', '/'),
      relativeAbsoluteSrcRoot: (file: string) => path.relative(src, file).replaceAll('\\', '/'),
    },
  } as unknown as CompilerContext
  await mkdir(path.dirname(template), { recursive: true })
  await writeFile(path.join(src, 'app.js'), 'App({})')
  await writeFile(template, '<view>BASE</view>')
  let saveDuringBuild = false
  let emitTemplate = true
  let output = ''
  const nativeWrites: string[][] = []
  const nativeOutput = process.stdout.write.bind(process.stdout)
  const capture = vi.spyOn(process.stdout, 'write').mockImplementation(((chunk: string | Uint8Array, ...args: unknown[]) => {
    if (String(chunk).startsWith(NATIVE_PUBLICATION_PREFIX)) {
      output += String(chunk)
      return true
    }
    return (nativeOutput as (...values: unknown[]) => boolean)(chunk, ...args)
  }) as typeof process.stdout.write)
  const emitter: Plugin = {
    name: 'fixture:late-template-save',
    async renderStart() {
      if (saveDuringBuild) {
        saveDuringBuild = false
        await writeFile(template, '<view>FINAL</view>')
      }
    },
    async generateBundle() {
      if (emitTemplate) {
        this.emitFile({ type: 'asset', fileName: 'pages/index/index.wxml', source: await readFile(template, 'utf8') })
      }
    },
  }
  const publication = createOutputPublicationPlugin(ctx)
  const observer = nativePublicationPlugin({ profilePath })
  const probe: Plugin = {
    name: 'fixture:native-write-observation',
    enforce: 'post',
    writeBundle: {
      order: 'post',
      sequential: true,
      handler(_options, bundle) { nativeWrites.push(Object.keys(bundle).sort()) },
    },
  }
  const render = (options: { afterPlugins?: Plugin[], betweenPlugins?: Plugin[], foreign?: boolean } = {}) => build({
    root: project,
    configFile: false,
    publicDir: false,
    logLevel: 'silent',
    plugins: options.foreign
      ? [{ name: 'fixture:foreign-native-output', renderChunk: code => `${code}\nconsole.info("foreign native output")` }]
      : [emitter, ...(observerOrder === 'before'
          ? [observer, ...(options.betweenPlugins ?? []), publication]
          : [publication, ...(options.betweenPlugins ?? []), observer]), probe, ...(options.afterPlugins ?? [])],
    build: {
      emptyOutDir: false,
      minify: false,
      rolldownOptions: { input: path.join(src, 'app.js'), output: { entryFileNames: 'app.js' } },
    },
  })
  return {
    project,
    template,
    outputTemplate,
    profilePath,
    runtimeState,
    nativeWrites,
    render,
    dev: { getOutput: () => output, waitFor: async <T>(task: Promise<T>) => await task },
    clearOutput() { output = '' },
    rebuild() {
      runtimeState.build.hmr.isRebuild = true
      runtimeState.build.hmr.didEmitAllEntries = true
    },
    saveDuringBuild() { saveDuringBuild = true },
    retireTemplateOutput() { emitTemplate = false },
    diagnostics() { nativeOutput(`[native-publication-race] ${JSON.stringify({ nativeWrites, receipts: output.split('\n').filter(Boolean) })}\n`) },
    async close() {
      capture.mockRestore()
      await rm(project, { recursive: true, force: true })
    },
  }
}
