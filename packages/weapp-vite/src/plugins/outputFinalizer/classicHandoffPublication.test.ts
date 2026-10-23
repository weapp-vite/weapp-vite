import type { Plugin } from 'vite'
import type { CompilerContext } from '../../context'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { WEAPP_VITE_STATEFUL_HMR_UPDATE_FILE } from '@weapp-core/constants'
import { build } from 'vite'
import { expect, it } from 'vitest'
import { resetEmittedOutputCaches } from '../../runtime/buildPlugin/outputs'
import { attachHmrRuntimeSession, getHmrRuntimeSession } from '../../runtime/hmrRuntimeSession'
import { createRuntimeState } from '../../runtime/runtimeState'
import { installIdeAssetWatch } from '../../runtime/statefulHmr/assetWatch'
import { writeStatefulHmrOutput } from '../../runtime/statefulHmr/outputWriter'
import { prepareOutputOwnership } from './ownership'
import { createOutputPublicationPlugin } from './publication'

it.each(['same-context', 'replacement-context'] as const)('switches IDE settings only between complete generation and native writing: %s', async (contextKind) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'weapp-classic-prewrite-'))
  const outDir = path.join(root, 'dist')
  const configPath = path.join(root, 'project.private.config.json')
  const context = () => ({
    runtimeState: createRuntimeState(),
    scanService: { independentSubPackageMap: new Map() },
    configService: {
      cwd: root,
      outDir,
      isDev: true,
      platform: 'weapp',
      multiPlatform: { enabled: false },
      projectPrivateConfigPath: configPath,
      weappViteConfig: {},
    },
  }) as unknown as CompilerContext
  const initial = context()
  const runtime = getHmrRuntimeSession(initial)
  const classic = contextKind === 'same-context' ? initial : context()
  attachHmrRuntimeSession(classic, runtime)
  const owner = runtime.classicIdeConfig
  const retired = WEAPP_VITE_STATEFUL_HMR_UPDATE_FILE
  const readConfig = async () => JSON.parse(await readFile(configPath, 'utf8')) as { setting: { compileHotReLoad: boolean }, watchOptions?: { ignore?: string[] } }
  const output = () => readFile(path.join(outDir, 'app.js'), 'utf8')
  let failGeneration = false
  let fullWrite = false
  let sawGeneration = false
  let sawNativeWrite = false
  const fixture: Plugin = {
    name: 'classic-prewrite-fixture',
    resolveId: id => id === 'virtual:app' ? id : undefined,
    load: id => id === 'virtual:app' ? 'globalThis.classicPrewrite = true' : undefined,
    async generateBundle() {
      expect((await readConfig()).setting.compileHotReLoad).toBe(true)
      expect(owner.hasPendingAssetHandoff(configPath, outDir)).toBe(true)
      expect(runtime.outputGenerations.size).toBe(0)
      if (failGeneration) {
        throw new Error('generation failed before IDE handoff')
      }
    },
  }
  const observation: Plugin = {
    name: 'classic-prewrite-observation',
    enforce: 'post',
    generateBundle: {
      order: 'post',
      async handler() {
        sawGeneration = true
        expect((await readConfig()).setting.compileHotReLoad).toBe(!fullWrite)
        expect(owner.hasPendingAssetHandoff(configPath, outDir)).toBe(!fullWrite)
        expect(runtime.outputGenerations.size).toBe(0)
        expect(await readFile(path.join(outDir, retired), 'utf8')).toBe('stateful update')
        if (fullWrite) {
          expect(await output()).toBe('stateful app')
          expect((await readConfig()).watchOptions?.ignore).toEqual(['user/**'])
        }
      },
    },
    writeBundle: {
      order: 'pre',
      async handler() {
        if (fullWrite) {
          sawNativeWrite = true
          expect((await readConfig()).setting.compileHotReLoad).toBe(false)
          expect(await output()).toContain('classicPrewrite')
          expect(runtime.outputGenerations.size).toBe(0)
          expect(await readFile(path.join(outDir, retired), 'utf8')).toBe('stateful update')
        }
      },
    },
  }
  const publication = createOutputPublicationPlugin(classic)
  const render = (write = true) => {
    resetEmittedOutputCaches(classic.runtimeState)
    return build({
      root,
      configFile: false,
      logLevel: 'silent',
      publicDir: false,
      plugins: [fixture, publication, observation],
      build: {
        outDir,
        emptyOutDir: false,
        minify: false,
        write,
        rolldownOptions: { input: 'virtual:app', output: { entryFileNames: 'app.js' } },
      },
    })
  }
  try {
    await writeFile(configPath, JSON.stringify({ setting: { compileHotReLoad: true }, watchOptions: { ignore: ['user/**'] } }))
    await writeStatefulHmrOutput(outDir, [
      { type: 'asset', fileName: 'app.js', source: 'stateful app' },
      { type: 'asset', fileName: retired, source: 'stateful update' },
    ])
    await prepareOutputOwnership(initial, outDir, ['app.js', retired], false, [], 'stateful-hmr')()
    const releaseAssetWatch = await installIdeAssetWatch({ configPath, outDir })
    runtime.requestClassic({ code: 'config-json', message: 'configuration changed' })
    await releaseAssetWatch(owner)
    expect((await readConfig()).setting.compileHotReLoad).toBe(true)
    expect(await output()).toBe('stateful app')
    failGeneration = true
    await expect(render()).rejects.toThrow('generation failed before IDE handoff')
    expect(sawGeneration).toBe(false)
    expect((await readConfig()).setting.compileHotReLoad).toBe(true)
    failGeneration = false
    await render(false)
    expect(sawGeneration).toBe(true)
    expect(await output()).toBe('stateful app')
    classic.runtimeState.build.hmr.isRebuild = true
    classic.runtimeState.build.hmr.didEmitAllEntries = false
    await expect(render()).rejects.toThrow('classic')
    expect(owner.hasPendingAssetHandoff(configPath, outDir)).toBe(true)
    expect(runtime.outputGenerations.size).toBe(0)
    expect(await output()).toBe('stateful app')
    classic.runtimeState.build.hmr.didEmitAllEntries = true
    fullWrite = true
    await render()
    expect(sawNativeWrite).toBe(true)
    expect(runtime.outputGenerations.size).toBe(1)
    await expect(readFile(path.join(outDir, retired))).rejects.toMatchObject({ code: 'ENOENT' })
    expect(owner.hasPendingAssetHandoff(configPath)).toBe(false)
    await owner.close()
    expect((await readConfig()).setting.compileHotReLoad).toBe(true)
  }
  finally {
    await owner.close()
    await rm(root, { recursive: true, force: true })
  }
})
