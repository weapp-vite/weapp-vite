import type { PluginContext } from 'rolldown'
import type { CompilerContext } from '../../context'
import { realpath } from 'node:fs/promises'
import os from 'node:os'
import { fs } from '@weapp-core/shared/fs'
import path from 'pathe'
import { afterEach, expect, it, vi } from 'vitest'
import { getHmrRuntimeSession } from '../../runtime/hmrRuntimeSession'
import { installIdeAssetWatch } from '../../runtime/statefulHmr/assetWatch'
import { createProjectConfigDirectoryPlugin } from './directory'

const cleanup: Array<() => Promise<void>> = []

afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) {
    await close()
  }
})

async function fixture(source: string, existingOutput = false) {
  const root = await realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'classic-platform-config-')))
  cleanup.push(() => fs.remove(root))
  const sourceDir = path.join(root, 'config/weapp')
  const outputRoot = path.join(root, 'dist/weapp')
  const sourcePrivate = path.join(sourceDir, 'project.private.config.json')
  const outputPrivate = path.join(outputRoot, 'project.private.config.json')
  await fs.outputJSON(path.join(sourceDir, 'project.config.json'), { miniprogramRoot: 'dist' })
  await fs.writeFile(sourcePrivate, source)
  if (existingOutput) {
    await fs.outputFile(outputPrivate, source)
  }
  const ctx = {
    configService: {
      isDev: true,
      platform: 'weapp',
      multiPlatform: { enabled: true },
      projectConfigPath: path.join(sourceDir, 'project.config.json'),
      projectPrivateConfigPath: sourcePrivate,
      outDir: path.join(outputRoot, 'dist'),
      pluginOnly: false,
    },
  } as unknown as CompilerContext
  const owner = getHmrRuntimeSession(ctx).classicIdeConfig
  cleanup.push(() => owner.close())
  const plugin = createProjectConfigDirectoryPlugin(ctx)
  const hook = plugin.writeBundle
  const handler = typeof hook === 'function' ? hook : hook?.handler
  if (!handler) {
    throw new Error('Missing platform config publication hook')
  }
  const watchFile = vi.fn()
  const publish = () => handler.call({ addWatchFile: watchFile } as unknown as PluginContext, {} as never, {
    'app.json': { type: 'asset', fileName: 'app.json', source: '{}' },
  } as never)
  return { owner, publish, sourcePrivate, outputPrivate, watchFile, outDir: ctx.configService.outDir }
}

it.each([false, true])('keeps native directory publication classic and restores the source request: existing output %s', async (existingOutput) => {
  const source = '{\r\n  "setting": { "compileHotReLoad": true, "urlCheck": false }\r\n}\r\n'
  const project = await fixture(source, existingOutput)
  await project.owner.activate(project.outputPrivate)
  await project.publish()
  expect(await fs.readJSON(project.outputPrivate)).toEqual({ setting: { compileHotReLoad: false, urlCheck: false } })
  expect(await project.owner.readRequested(project.outputPrivate)).toBe(source)
  expect(await fs.readFile(project.sourcePrivate, 'utf8')).toBe(source)
  expect(project.watchFile).toHaveBeenCalledWith(project.sourcePrivate)
  await project.owner.close()
  expect(await fs.readFile(project.outputPrivate, 'utf8')).toBe(source)
})

it('keeps later source fields and the latest requested bytes through repeated native publication', async () => {
  const project = await fixture('{"setting":{"compileHotReLoad":true}}')
  await project.owner.activate(project.outputPrivate)
  await project.publish()
  const changed = '{\n  "setting": { "compileHotReLoad": true, "urlCheck": false },\n  "description": "source update"\n}\n'
  await fs.writeFile(project.sourcePrivate, changed)
  await project.publish()
  await project.publish()
  expect(await fs.readJSON(project.outputPrivate)).toEqual({
    setting: { compileHotReLoad: false, urlCheck: false },
    description: 'source update',
  })
  expect(await project.owner.readRequested(project.outputPrivate)).toBe(changed)
  expect(await fs.readFile(project.sourcePrivate, 'utf8')).toBe(changed)
  await project.owner.close()
  expect(await fs.readFile(project.outputPrivate, 'utf8')).toBe(changed)
})

it('publishes the original private configuration when no classic owner holds the generated project', async () => {
  const source = '{"setting":{"compileHotReLoad":true},"description":"stateful"}\n'
  const project = await fixture(source)
  await project.publish()
  expect(await fs.readFile(project.outputPrivate, 'utf8')).toBe(source)
  await project.owner.close()
  expect(await fs.readFile(project.outputPrivate, 'utf8')).toBe(source)
})

it.each([false, true])('keeps pending private config and ownership intact before the full native handoff: source removed=%s', async (removeSource) => {
  const source = '{"setting":{"compileHotReLoad":true}}\n'
  const project = await fixture(source)
  await project.publish()
  const restore = await installIdeAssetWatch({ configPath: project.outputPrivate, outDir: project.outDir })
  await restore(project.owner)
  const installed = await fs.readFile(project.outputPrivate, 'utf8')
  if (removeSource) {
    await fs.remove(project.sourcePrivate)
  }
  else {
    await fs.writeFile(project.sourcePrivate, '{"setting":{"compileHotReLoad":true},"description":"new request"}\n')
  }
  await project.publish()
  expect(await fs.readFile(project.outputPrivate, 'utf8')).toBe(installed)
  expect(project.owner.hasPendingAssetHandoff(project.outputPrivate)).toBe(true)
  await fs.writeFile(project.sourcePrivate, source)
  await project.owner.activatePendingAssetHandoff(project.outputPrivate, project.outDir)
  await project.publish()
  expect(await fs.readJSON(project.outputPrivate)).toEqual({ setting: { compileHotReLoad: false } })
  await project.owner.close()
  expect(await fs.readFile(project.outputPrivate, 'utf8')).toBe(source)
})
