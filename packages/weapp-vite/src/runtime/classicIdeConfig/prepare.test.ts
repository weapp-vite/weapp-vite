import type { MutableCompilerContext } from '../../context'
import os from 'node:os'
import { fs } from '@weapp-core/shared/fs'
import path from 'pathe'
import { afterEach, expect, it } from 'vitest'
import { getHmrRuntimeSession } from '../hmrRuntimeSession'
import { createRuntimeState } from '../runtimeState'
import { installIdeAssetWatch } from '../statefulHmr/assetWatch'
import { classicIdeConfigLeasePath, ideAssetWatchLeasePath } from './leases'
import { prepareClassicIdeConfig } from './prepare'

const cleanup: Array<() => Promise<unknown>> = []
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) {
    await close()
  }
})

it.each([false, true])('defers a pending asset handoff only when the same output root has a published stateful baseline: %s', async (published) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'prepare-pending-classic-'))
  cleanup.push(() => fs.remove(root))
  const file = path.join(root, 'project.private.config.json')
  const outDir = path.join(root, 'dist')
  const original = '{"setting":{"compileHotReLoad":true}}'
  await fs.writeFile(file, original)
  const ctx = {
    runtimeState: createRuntimeState(),
    configService: {
      isDev: true,
      platform: 'weapp',
      projectPrivateConfigPath: file,
      multiPlatform: { enabled: false },
      outDir,
      weappViteConfig: { hmr: { runtime: 'auto' } },
      projectPrivateConfig: { setting: { compileHotReLoad: true } },
    },
  } as unknown as MutableCompilerContext
  const runtime = getHmrRuntimeSession(ctx)
  cleanup.push(() => runtime.classicIdeConfig.close())
  const restore = await installIdeAssetWatch({ configPath: file, outDir })
  await restore(runtime.classicIdeConfig)
  const installed = await fs.readFile(file, 'utf8')
  runtime.requestClassic({ code: 'runtime-contract', message: 'unsupported update' })
  if (published) {
    runtime.outputOwnership.set(outDir, new Map([['stateful-hmr', new Set(['app.js'])]]))
  }
  await prepareClassicIdeConfig(ctx)
  expect(runtime.classicIdeConfig.hasPendingAssetHandoff(file)).toBe(published)
  if (published) {
    expect(await fs.readFile(file, 'utf8')).toBe(installed)
  }
  else {
    expect(await fs.readJSON(file)).toEqual({ setting: { compileHotReLoad: false } })
  }
  await runtime.classicIdeConfig.close()
  expect(await fs.readFile(file, 'utf8')).toBe(original)
})

it.each(['changed', 'missing'] as const)('rejects %s private config paths while the same output root has a pending handoff', async (replacement) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'prepare-classic-path-'))
  cleanup.push(() => fs.remove(root))
  const file = path.join(root, 'project.private.config.json')
  const nextFile = path.join(root, 'next.private.config.json')
  const outDir = path.join(root, 'dist')
  const original = '{"setting":{"compileHotReLoad":true}}'
  const nextOriginal = '{"setting":{"compileHotReLoad":true},"description":"next config"}'
  await fs.writeFile(file, original)
  await fs.writeFile(nextFile, nextOriginal)
  const configService = {
    isDev: true,
    platform: 'weapp',
    projectPrivateConfigPath: file as string | undefined,
    multiPlatform: { enabled: false },
    outDir,
    weappViteConfig: { hmr: { runtime: 'auto' } },
    projectPrivateConfig: { setting: { compileHotReLoad: true } },
  }
  const ctx = { runtimeState: createRuntimeState(), configService } as unknown as MutableCompilerContext
  const runtime = getHmrRuntimeSession(ctx)
  const owner = runtime.classicIdeConfig
  cleanup.push(() => owner.close())
  const restore = await installIdeAssetWatch({ configPath: file, outDir })
  await restore(owner)
  const installed = await fs.readFile(file, 'utf8')
  runtime.requestClassic({ code: 'runtime-contract', message: 'unsupported update' })
  runtime.outputOwnership.set(outDir, new Map([['stateful-hmr', new Set(['app.js'])]]))
  configService.projectPrivateConfigPath = replacement === 'changed' ? nextFile : undefined
  await expect(prepareClassicIdeConfig(ctx)).rejects.toThrow('IDE 配置路径')
  expect(await fs.readFile(file, 'utf8')).toBe(installed)
  expect(await fs.readFile(nextFile, 'utf8')).toBe(nextOriginal)
  expect(owner.hasPendingAssetHandoff(file, outDir)).toBe(true)
  expect(await fs.pathExists(ideAssetWatchLeasePath(file))).toBe(true)
  expect(await fs.pathExists(classicIdeConfigLeasePath(file))).toBe(false)
  expect(await fs.pathExists(classicIdeConfigLeasePath(nextFile))).toBe(false)
  configService.projectPrivateConfigPath = file
  await prepareClassicIdeConfig(ctx)
  await owner.close()
  expect(await fs.readFile(file, 'utf8')).toBe(original)
  expect(await fs.readFile(nextFile, 'utf8')).toBe(nextOriginal)
})

it.each([
  { mode: 'classic', requested: true, fallback: false, reason: undefined },
  { mode: 'auto', requested: false, fallback: false, reason: undefined },
  { mode: 'auto', requested: true, fallback: false, reason: 'ide-classic-handoff' },
  { mode: 'stateful-experimental', requested: true, fallback: false, reason: 'ide-classic-handoff' },
  { mode: 'stateful-experimental', requested: false, fallback: false, reason: 'ide-classic-handoff' },
  { mode: 'stateful-experimental', requested: true, fallback: true, reason: 'runtime-contract' },
] as const)('prepares classic before startup while preserving the $mode request ($requested / existing fallback $fallback)', async ({ mode, requested, fallback, reason }) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'prepare-classic-ide-'))
  cleanup.push(() => fs.remove(root))
  const file = path.join(root, 'project.private.config.json')
  const original = JSON.stringify({ setting: { compileHotReLoad: requested } })
  await fs.writeFile(file, original)
  const ctx = {
    runtimeState: createRuntimeState(),
    configService: {
      isDev: true,
      platform: 'weapp',
      projectPrivateConfigPath: file,
      multiPlatform: { enabled: false },
      outDir: path.join(root, 'dist'),
      weappViteConfig: { hmr: { runtime: mode } },
      projectPrivateConfig: { setting: { compileHotReLoad: requested } },
    },
  } as unknown as MutableCompilerContext
  const runtime = getHmrRuntimeSession(ctx)
  cleanup.push(() => runtime.classicIdeConfig.close())
  if (fallback) {
    runtime.requestClassic({ code: 'runtime-contract', message: 'test unsupported update' })
  }
  await prepareClassicIdeConfig(ctx)
  expect((await fs.readJSON(file) as { setting: { compileHotReLoad: boolean } }).setting.compileHotReLoad).toBe(false)
  expect(runtime.fallback?.code).toBe(reason)
  if (reason) {
    expect(runtime.phase).toBe('switching')
    expect(runtime.resolve({ configured: mode, runtime: 'stateful-experimental', reason: 'explicit' })).toEqual({ configured: mode, runtime: 'classic', reason: 'capability-fallback' })
  }
  expect(await runtime.classicIdeConfig.readRequested(file)).toBe(original)
  await prepareClassicIdeConfig(ctx)
  await runtime.classicIdeConfig.close()
  expect(await fs.readFile(file, 'utf8')).toBe(original)
})
