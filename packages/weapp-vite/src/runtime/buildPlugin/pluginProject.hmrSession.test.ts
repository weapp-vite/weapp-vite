import os from 'node:os'
import { fs } from '@weapp-core/shared/fs'
import path from 'pathe'
import { afterEach, expect, it } from 'vitest'
import { classicIdeConfigLeasePath } from '../classicIdeConfig/leases'
import { prepareClassicIdeConfig } from '../classicIdeConfig/prepare'
import { CompilerSession } from '../compilerSession'
import { getHmrRuntimeSession, isBorrowedHmrRuntimeSession } from '../hmrRuntimeSession'
import { createPluginProjectSession } from './pluginProject'

const cleanup: Array<() => Promise<unknown>> = []
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) {
    await close()
  }
})

it.each([false, true])('borrows the parent command configuration before plugin initialization (explicit path=%s)', async (explicit) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'plugin-hmr-owner-'))
  cleanup.push(() => fs.remove(root))
  const projectConfigPath = explicit ? 'config/project.config.weapp.json' : undefined
  const privateFile = path.join(root, explicit ? 'config/project.private.config.weapp.json' : 'project.private.config.json')
  const original = '{"setting":{"compileHotReLoad":true,"urlCheck":false}}\r\n'
  await fs.outputJSON(path.join(root, projectConfigPath ?? 'project.config.json'), { miniprogramRoot: 'dist', pluginRoot: 'dist/plugin' })
  await fs.outputFile(privateFile, original)
  await fs.outputJSON(path.join(root, 'package.json'), { name: 'plugin-hmr-owner' })
  const parent = new CompilerSession()
  const runtime = getHmrRuntimeSession(parent.context)
  cleanup.push(() => runtime.classicIdeConfig.close())
  cleanup.push(() => parent.close())
  await parent.initialize({
    cwd: root,
    isDev: true,
    projectConfigPath,
    hostConfig: { config: { weapp: { pluginRoot: 'src/plugin', multiPlatform: false, autoRoutes: false, vue: { enable: false }, hmr: { runtime: 'classic' } } } },
    syncSupportFiles: false,
    preloadAppEntry: false,
  })
  await prepareClassicIdeConfig(parent.context)
  const installed = await fs.readFile(privateFile, 'utf8')
  const child = await createPluginProjectSession(parent.context)
  cleanup.push(() => child.close())
  expect(getHmrRuntimeSession(child.context)).toBe(runtime)
  expect(isBorrowedHmrRuntimeSession(child.context)).toBe(true)
  expect(child.context.configService.projectPrivateConfig.setting?.compileHotReLoad).toBe(true)
  await prepareClassicIdeConfig(child.context)
  const childPrivate = child.context.configService.projectPrivateConfigPath!
  expect(await fs.pathExists(classicIdeConfigLeasePath(childPrivate))).toBe(childPrivate === privateFile)
  await child.close()
  expect(await fs.readFile(privateFile, 'utf8')).toBe(installed)
  expect(await runtime.classicIdeConfig.readRequested(privateFile)).toBe(original)
  await parent.close()
  await runtime.classicIdeConfig.close()
  expect(await fs.readFile(privateFile, 'utf8')).toBe(original)
})
