import type { MutableCompilerContext } from '../../context'
import os from 'node:os'
import { fs } from '@weapp-core/shared/fs'
import path from 'pathe'
import { afterEach, expect, it } from 'vitest'
import { getHmrRuntimeSession } from '../hmrRuntimeSession'
import { createRuntimeState } from '../runtimeState'
import { prepareClassicIdeConfig } from './prepare'

const cleanup: Array<() => Promise<unknown>> = []
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) {
    await close()
  }
})

it.each([
  { mode: 'classic', requested: true, fallback: false, classic: true },
  { mode: 'auto', requested: false, fallback: false, classic: true },
  { mode: 'auto', requested: true, fallback: false, classic: false },
  { mode: 'stateful-experimental', requested: true, fallback: false, classic: false },
  { mode: 'stateful-experimental', requested: true, fallback: true, classic: true },
] as const)('only disables native partial reload for effective classic: $mode / $requested / fallback $fallback', async ({ mode, requested, fallback, classic }) => {
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
  expect((await fs.readJSON(file) as { setting: { compileHotReLoad: boolean } }).setting.compileHotReLoad).toBe(classic ? false : requested)
  expect(await runtime.classicIdeConfig.readRequested(file)).toBe(original)
  await prepareClassicIdeConfig(ctx)
  await runtime.classicIdeConfig.close()
  expect(await fs.readFile(file, 'utf8')).toBe(original)
})
