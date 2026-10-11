import type { Plugin } from 'vite'
import type { CompilerContext } from '../../context'
import type { WxmlTransform } from '../../types'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { build } from 'vite'
import { expect, it } from 'vitest'
import { resetEmittedOutputCaches, shouldCleanOutputs } from '../../runtime/buildPlugin/outputs'
import { createRuntimeState } from '../../runtime/runtimeState'
import { createOutputFinalizerPlugin, createOutputPublicationPlugin } from '../outputFinalizer'

it.each([undefined, true, false])('retains failed native output and retires removed routes and chunks after recovery with emptyOutDir=%s', async (emptyOutDir) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'weapp-rebuild-retention-'))
  const outDir = path.join(root, 'dist')
  const rules = path.join(root, 'transform-rules.txt')
  const runtimeState = createRuntimeState()
  let includeRetiredPage = true
  const transform: WxmlTransform = async (code, hooks) => {
    hooks.addWatchFile(rules)
    return `${code}<text>${await readFile(rules, 'utf8')}</text>`
  }
  const ctx = {
    runtimeState,
    scanService: { subPackageMap: new Map(), independentSubPackageMap: new Map() },
    configService: {
      cwd: root,
      outDir,
      absoluteSrcRoot: path.join(root, 'src'),
      isDev: true,
      platform: 'weapp',
      inlineConfig: { build: { emptyOutDir } },
      weappViteConfig: { wxml: { transform, remove: false } },
      outputExtensions: { wxml: 'wxml', wxss: 'wxss' },
    },
  } as unknown as CompilerContext
  const fixture: Plugin = {
    name: 'fixture-retired-page',
    resolveId: id => id.startsWith('virtual:') ? id : undefined,
    load(id) {
      if (id === 'virtual:app') {
        return 'globalThis.fixtureApp = true'
      }
      if (id === 'virtual:retired-page') {
        return 'export const load = () => import("virtual:retired-shared")'
      }
      if (id === 'virtual:retired-shared') {
        return 'export const value = "retired shared module"'
      }
    },
    generateBundle() {
      const pages = ['pages/home/index', ...(includeRetiredPage ? ['pages/retired/index'] : [])]
      this.emitFile({ type: 'asset', fileName: 'app.json', source: JSON.stringify({ pages }) })
      for (const page of pages) {
        this.emitFile({ type: 'asset', fileName: `${page}.wxml`, source: `<view>${page}</view>` })
      }
    },
  }
  const plugins = [fixture, createOutputFinalizerPlugin(ctx), createOutputPublicationPlugin(ctx)]
  const render = async () => {
    resetEmittedOutputCaches(runtimeState)
    const input: Record<string, string> = { app: 'virtual:app' }
    if (includeRetiredPage) {
      input['pages/retired/index'] = 'virtual:retired-page'
    }
    const result = await build({
      root,
      configFile: false,
      publicDir: false,
      logLevel: 'silent',
      plugins,
      build: {
        outDir,
        emptyOutDir: shouldCleanOutputs(ctx.configService, runtimeState.build.hmr.isRebuild ? 'rebuild' : 'startup'),
        minify: false,
        rolldownOptions: { input, preserveEntrySignatures: 'strict', output: { entryFileNames: '[name].js' } },
      },
    })
    if (Array.isArray(result) || !('output' in result)) {
      throw new Error('Expected one completed native output')
    }
    return result.output
  }
  try {
    await writeFile(rules, 'initial')
    const initial = await render()
    const shared = initial.find(output => output.type === 'chunk' && output.isDynamicEntry)
    expect(shared).toBeDefined()
    const previous = await Promise.all(initial.map(async output => ({
      file: output.fileName,
      contents: await readFile(path.join(outDir, output.fileName), 'utf8'),
    })))
    runtimeState.build.hmr.isRebuild = true
    runtimeState.build.hmr.didEmitAllEntries = true
    includeRetiredPage = false
    await rm(rules)
    await expect(render()).rejects.toThrow('transform-rules.txt')
    for (const output of previous) {
      expect(await readFile(path.join(outDir, output.file), 'utf8')).toBe(output.contents)
    }
    await writeFile(rules, 'restored')
    await render()
    expect(await readFile(path.join(outDir, 'pages/home/index.wxml'), 'utf8')).toContain('restored')
    const app = JSON.parse(await readFile(path.join(outDir, 'app.json'), 'utf8')) as { pages: string[] }
    expect(app.pages).toEqual(['pages/home/index'])
    for (const file of ['pages/retired/index.js', 'pages/retired/index.wxml', shared!.fileName]) {
      await expect(readFile(path.join(outDir, file))).rejects.toMatchObject({ code: 'ENOENT' })
    }
    await render()
    expect(await readFile(path.join(outDir, 'pages/home/index.wxml'), 'utf8')).toContain('restored')
    expect(await readFile(path.join(outDir, 'app.js'), 'utf8')).toContain('fixtureApp')
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})
