import { fs } from '@weapp-core/shared/fs'
import path from 'pathe'
import { afterAll, describe, expect, it } from 'vitest'
import { ensureWorkspacePackageLink } from '../../../test/utils'
import { createCompilerContext } from '../../createContext'

const APP_ROOT = path.resolve(import.meta.dirname, '../../../../../apps/plugin-demo')
const DIST_ROOT = path.join(APP_ROOT, 'dist')
const PLUGIN_DIST_ROOT = path.join(APP_ROOT, 'dist-plugin')

async function readFile(filePath: string) {
  return await fs.readFile(filePath, 'utf8')
}

async function resolvePluginWevuRuntimePath(pluginDistRoot: string) {
  const stableRuntimePath = path.join(pluginDistRoot, 'weapp-vendors/wevu-src.js')
  if (await fs.pathExists(stableRuntimePath)) {
    return stableRuntimePath
  }

  const pluginFiles = await fs.readdir(pluginDistRoot)
  const legacyRuntimeChunkName = pluginFiles.find(file => /^src-[\w-]+\.js$/.test(file))
  if (!legacyRuntimeChunkName) {
    return undefined
  }

  return path.join(pluginDistRoot, legacyRuntimeChunkName)
}

async function resolvePluginWevuSupportPath(pluginDistRoot: string) {
  const vendorRoot = path.join(pluginDistRoot, 'weapp-vendors')
  const files = await fs.readdir(vendorRoot)
  for (const file of files) {
    if (!file.endsWith('.js')) {
      continue
    }
    const filePath = path.join(vendorRoot, file)
    const code = await readFile(filePath)
    if (code.includes('miniprogram_npm/dayjs/index') && code.includes('npm(dayjs) 构建标记')) {
      return filePath
    }
  }

  return undefined
}

describe('plugin-demo build regression', () => {
  afterAll(async () => {
    await fs.remove(DIST_ROOT)
    await fs.remove(PLUGIN_DIST_ROOT)
  })

  it('emits isolated app/plugin outputs with plugin exports preserved', async () => {
    await ensureWorkspacePackageLink(APP_ROOT)

    const ctx = await createCompilerContext({
      cwd: APP_ROOT,
      isDev: false,
      mode: 'production',
    })

    await ctx.buildService.build()

    expect(await fs.pathExists(path.join(DIST_ROOT, 'app.json'))).toBe(true)
    expect(await fs.pathExists(path.join(DIST_ROOT, 'pages/index/index.js'))).toBe(true)
    expect(await fs.pathExists(path.join(PLUGIN_DIST_ROOT, 'plugin.json'))).toBe(true)
    expect(await fs.pathExists(path.join(PLUGIN_DIST_ROOT, 'index.js'))).toBe(true)
    expect(await fs.pathExists(path.join(PLUGIN_DIST_ROOT, 'miniprogram_npm/dayjs/index.js'))).toBe(true)
    expect(await fs.pathExists(path.join(PLUGIN_DIST_ROOT, 'miniprogram_npm/lodash/index.js'))).toBe(false)
    expect(await fs.pathExists(path.join(PLUGIN_DIST_ROOT, 'components/hello-component/index.json'))).toBe(true)
    expect(await fs.pathExists(path.join(PLUGIN_DIST_ROOT, 'pages/hello-page/index.wxml'))).toBe(true)
    expect(await fs.pathExists(path.join(PLUGIN_DIST_ROOT, 'pages/native-playground/index.js'))).toBe(true)
    expect(await fs.pathExists(path.join(PLUGIN_DIST_ROOT, 'components/native-meter/index.wxss'))).toBe(true)

    expect(await fs.pathExists(path.join(DIST_ROOT, 'common.js'))).toBe(false)
    expect(await fs.pathExists(path.join(PLUGIN_DIST_ROOT, 'common.js'))).toBe(false)
    expect(await fs.pathExists(path.join(PLUGIN_DIST_ROOT, 'app.js'))).toBe(false)
    expect(await fs.pathExists(path.join(PLUGIN_DIST_ROOT, 'pages/index/index.js'))).toBe(false)

    const pluginIndexCode = await readFile(path.join(PLUGIN_DIST_ROOT, 'index.js'))
    const pluginSupportPath = await resolvePluginWevuSupportPath(PLUGIN_DIST_ROOT)
    const pluginWevuRuntimePath = await resolvePluginWevuRuntimePath(PLUGIN_DIST_ROOT)
    expect(pluginSupportPath).toBeTruthy()
    const pluginVendorCode = await readFile(pluginSupportPath!)
    const pluginPageJson = JSON.parse(await readFile(path.join(PLUGIN_DIST_ROOT, 'pages/hello-page/index.json')))
    const nativePlaygroundJson = JSON.parse(await readFile(path.join(PLUGIN_DIST_ROOT, 'pages/native-playground/index.json')))
    const pluginJson = JSON.parse(await readFile(path.join(PLUGIN_DIST_ROOT, 'plugin.json')))

    expect(pluginWevuRuntimePath).toBeTruthy()
    const pluginWevuRuntimeCode = await readFile(pluginWevuRuntimePath!)
    expect(pluginIndexCode).toContain('exports.sayHello')
    expect(pluginIndexCode).toContain('exports.answer')
    expect(pluginIndexCode).toContain('exports.getFeatureCards')
    expect(pluginSupportPath).toContain('weapp-vendors/wevu-')
    expect(pluginVendorCode).toContain('miniprogram_npm/dayjs/index')
    expect(pluginVendorCode).toContain('2026-03-19T12:34:00')
    expect(pluginVendorCode).toContain('npm(dayjs) 构建标记')
    expect(pluginWevuRuntimeCode).toMatch(/Object\.defineProperty\(exports, ["'][A-Za-z_$][\w$]*["']/)
    expect(pluginWevuRuntimeCode).toContain('__wevu_runtime')
    expect(pluginPageJson.usingComponents ?? {}).toEqual({})
    expect(nativePlaygroundJson.usingComponents).toMatchObject({
      'hello-showcase': '../../components/hello-component/index',
      'native-meter': '../../components/native-meter/index',
    })
    expect(pluginJson.publicComponents).toMatchObject({
      'hello-component': 'components/hello-component/index',
      'native-meter': 'components/native-meter/index',
    })
    expect(pluginJson.pages).toMatchObject({
      'hello-page': 'pages/hello-page/index',
      'native-playground': 'pages/native-playground/index',
    })
  })
})
