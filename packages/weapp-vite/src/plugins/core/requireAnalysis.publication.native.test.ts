import type { CompilerContext } from '../../context'
import type { CorePluginState } from './helpers'
import { mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'pathe'
import { build } from 'vite'
import { expect, it } from 'vitest'
import { createRuntimeState } from '../../runtime/runtimeState'
import { createOutputPublicationPlugin } from '../outputFinalizer'
import { createRequireAnalysisPlugin } from './requireAnalysis'

it('publishes, retires and restores native async outputs through successful bundler writes', async () => {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'require-async-publication-')))
  const app = path.join(root, 'app.js')
  const outDir = path.join(root, 'dist')
  const source = 'exports.open = () => require.async("./feature.js");'
  await writeFile(app, source)
  await writeFile(path.join(root, 'feature.js'), 'exports.value = "published-async-value";')
  const relativePath = (id: string) => path.relative(root, id)
  const ctx = {
    configService: {
      cwd: root,
      outDir,
      platform: 'weapp',
      isDev: true,
      relativeOutputPath: relativePath,
      relativeAbsoluteSrcRoot: relativePath,
      weappViteConfig: { hmr: { runtime: 'classic' } },
    },
    scanService: { independentSubPackageMap: new Map() },
    runtimeState: createRuntimeState(),
  } as unknown as CompilerContext
  const plugins = [
    createRequireAnalysisPlugin({ ctx, requireAsyncEmittedChunks: new Set() } as unknown as CorePluginState),
    createOutputPublicationPlugin(ctx),
  ]
  const render = () => build({
    root,
    configFile: false,
    publicDir: false,
    logLevel: 'silent',
    plugins,
    build: {
      outDir,
      emptyOutDir: false,
      minify: false,
      rolldownOptions: { input: { app }, output: { format: 'cjs', entryFileNames: '[name].js' } },
    },
  })
  const readTarget = () => readFile(path.join(outDir, 'feature.js'), 'utf8')
  try {
    for (let generation = 1; generation <= 3; generation++) {
      ctx.runtimeState.build.hmr.isRebuild = generation > 1
      ctx.runtimeState.build.hmr.didEmitAllEntries = true
      await render()
      expect(await readTarget(), `generation ${generation} retains the native async target`).toContain('published-async-value')
    }
    await writeFile(app, 'exports.value = "reference-removed";')
    await render()
    await expect(readTarget()).rejects.toMatchObject({ code: 'ENOENT' })

    await writeFile(app, source)
    await render()
    expect(await readTarget()).toContain('published-async-value')
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})
