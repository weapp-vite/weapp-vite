import type { DomPage, DomSession } from '../../utils/domAcceptance/types'
import fs from 'node:fs/promises'
import path from 'node:path'
import { setTimeout } from 'node:timers/promises'
import { expect } from 'vitest'
import { PLUGIN_TEMPLATE_ROUTE } from './cases'

type JsonObject = Record<string, unknown>

async function readObject(file: string): Promise<JsonObject> {
  const value: unknown = JSON.parse(await fs.readFile(file, 'utf8'))
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Expected a JSON object: ${file}`)
  }
  return value as JsonObject
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value) || !value.every(item => typeof item === 'string' && item.length > 0)) {
    throw new Error('Plugin acceptance requires an explicit list of emitted page paths.')
  }
  return value
}

async function assertPageFiles(root: string, route: string) {
  for (const extension of ['js', 'json', 'wxml']) {
    await expect(fs.access(path.join(root, `${route}.${extension}`))).resolves.toBeUndefined()
  }
}

/** P 和 W 共享全部宿主/插件产物断言，只由实际 owner 目录选择合法布局。 */
export async function assertPluginTemplateLayout(source: string, effective: string, layout: 'source' | 'snapshot') {
  const sourceConfig = await readObject(path.join(source, 'project.config.json'))
  expect(typeof sourceConfig.appid).toBe('string')
  expect(sourceConfig.appid).toMatch(/^wx[\da-f]{16}$/)
  const config = await readObject(path.join(effective, 'project.config.json'))
  expect(config).toMatchObject({
    appid: sourceConfig.appid,
    compileType: 'plugin',
    miniprogramRoot: layout === 'source' ? 'dist/' : './',
    srcMiniprogramRoot: layout === 'source' ? 'dist/' : './',
    pluginRoot: 'dist-plugin/',
    setting: { localPlugins: true },
  })
  if (layout === 'snapshot') {
    expect(config).toMatchObject({ setting: { packNpmManually: false, packNpmRelationList: [] } })
  }
  const hostRoot = layout === 'source' ? path.join(effective, 'dist') : effective
  const sourceApp = await readObject(path.join(source, 'src/app.json'))
  const builtApp = await readObject(path.join(source, 'dist/app.json'))
  const app = await readObject(path.join(hostRoot, 'app.json'))
  expect(app.pages).toEqual(sourceApp.pages)
  expect(app.plugins).toEqual(sourceApp.plugins)
  expect(app.pages).toEqual(builtApp.pages)
  expect(app.plugins).toEqual(builtApp.plugins)
  const plugins = app.plugins as Record<string, { provider: string, version: string }>
  expect(Object.values(plugins).length).toBeGreaterThan(0)
  for (const plugin of Object.values(plugins)) {
    expect(plugin).toMatchObject({ provider: sourceConfig.appid, version: 'dev' })
  }
  for (const page of stringList(app.pages)) {
    await assertPageFiles(hostRoot, page)
  }
  const subPackages = app.subPackages ?? []
  expect(Array.isArray(subPackages)).toBe(true)
  for (const entry of subPackages as Array<{ root: string, pages: unknown }>) {
    expect(typeof entry.root).toBe('string')
    for (const page of stringList(entry.pages)) {
      await assertPageFiles(hostRoot, path.join(entry.root, page))
    }
  }
  if (layout === 'snapshot') {
    expect(app.subPackages).toEqual(builtApp.subPackages ?? [])
  }
  const pluginRoot = path.join(effective, 'dist-plugin')
  const plugin = await readObject(path.join(pluginRoot, 'plugin.json'))
  const sourcePlugin = await readObject(path.join(source, 'plugin/plugin.json'))
  expect(plugin).toMatchObject({ main: sourcePlugin.main, publicComponents: sourcePlugin.publicComponents, pages: sourcePlugin.pages })
  expect(typeof plugin.main).toBe('string')
  await expect(fs.access(path.join(pluginRoot, plugin.main as string))).resolves.toBeUndefined()
  for (const field of ['publicComponents', 'pages']) {
    for (const route of Object.values(plugin[field] as Record<string, string>)) {
      await assertPageFiles(pluginRoot, route)
    }
  }
}

interface PluginRuntimePage extends DomPage {
  data: (field?: string, options?: { routeOnly: true, timeout: number }) => Promise<unknown>
  waitForRendered: (options: { text: string, timeout: number }) => Promise<unknown>
}

export interface PluginRuntimeSession extends DomSession {
  currentPage: () => Promise<PluginRuntimePage | null | undefined>
}

async function waitForFirstPage(miniProgram: PluginRuntimeSession, timeout = 15_000) {
  const deadline = Date.now() + timeout
  let route = ''
  while (Date.now() < deadline) {
    const page = await miniProgram.currentPage()
    route = page?.path.replace(/^\/+/, '') ?? ''
    if (page && route === PLUGIN_TEMPLATE_ROUTE.slice(1)) {
      return page
    }
    await setTimeout(Math.min(100, Math.max(1, deadline - Date.now())))
  }
  throw new Error(`Plugin template first page is not ready: ${route || '<none>'}`)
}

/** 两条策略均验收首次页面；不得额外导航或用 data 代替 DOM checkpoint。 */
export async function assertPluginTemplateRuntime(
  miniProgram: PluginRuntimeSession,
  dom: { check: (id: string, session: DomSession, page: DomPage) => Promise<unknown> },
) {
  const page = await waitForFirstPage(miniProgram)
  await page.waitForRendered({ text: '插件能力混合演示', timeout: 90_000 })
  expect(await page.data(undefined, { routeOnly: true, timeout: 30_000 })).toMatchObject({ pluginAnswer: 42 })
  await dom.check('opened', miniProgram, page)
}
