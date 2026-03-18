import fs from 'fs-extra'
import path from 'pathe'
import { afterAll, describe, expect, it } from 'vitest'
import { createCompilerContext } from '../../createContext'

const APP_ROOT = path.resolve(import.meta.dirname, '../../../../../apps/plugin-demo')
const DIST_ROOT = path.join(APP_ROOT, 'dist')
const PLUGIN_DIST_ROOT = path.join(APP_ROOT, 'dist-plugin')

async function readFile(filePath: string) {
  return await fs.readFile(filePath, 'utf8')
}

describe('plugin-demo build regression', () => {
  afterAll(async () => {
    await fs.remove(DIST_ROOT)
    await fs.remove(PLUGIN_DIST_ROOT)
  })

  it('emits isolated app/plugin outputs with plugin exports preserved', async () => {
    const ctx = await createCompilerContext({
      cwd: APP_ROOT,
      isDev: false,
      mode: 'production',
    })

    await ctx.buildService.build({ skipNpm: true })

    expect(await fs.pathExists(path.join(DIST_ROOT, 'app.json'))).toBe(true)
    expect(await fs.pathExists(path.join(DIST_ROOT, 'pages/index/index.js'))).toBe(true)
    expect(await fs.pathExists(path.join(PLUGIN_DIST_ROOT, 'plugin.json'))).toBe(true)
    expect(await fs.pathExists(path.join(PLUGIN_DIST_ROOT, 'index.js'))).toBe(true)
    expect(await fs.pathExists(path.join(PLUGIN_DIST_ROOT, 'components/hello-component/index.json'))).toBe(true)
    expect(await fs.pathExists(path.join(PLUGIN_DIST_ROOT, 'pages/hello-page/index.wxml'))).toBe(true)
    expect(await fs.pathExists(path.join(PLUGIN_DIST_ROOT, 'pages/native-playground/index.js'))).toBe(true)
    expect(await fs.pathExists(path.join(PLUGIN_DIST_ROOT, 'components/native-meter/index.wxss'))).toBe(true)

    expect(await fs.pathExists(path.join(DIST_ROOT, 'common.js'))).toBe(false)
    expect(await fs.pathExists(path.join(PLUGIN_DIST_ROOT, 'common.js'))).toBe(true)
    expect(await fs.pathExists(path.join(PLUGIN_DIST_ROOT, 'app.js'))).toBe(false)
    expect(await fs.pathExists(path.join(PLUGIN_DIST_ROOT, 'pages/index/index.js'))).toBe(false)

    const pluginIndexCode = await readFile(path.join(PLUGIN_DIST_ROOT, 'index.js'))
    const pluginPageJson = JSON.parse(await readFile(path.join(PLUGIN_DIST_ROOT, 'pages/hello-page/index.json')))
    const nativePlaygroundJson = JSON.parse(await readFile(path.join(PLUGIN_DIST_ROOT, 'pages/native-playground/index.json')))
    const pluginJson = JSON.parse(await readFile(path.join(PLUGIN_DIST_ROOT, 'plugin.json')))

    expect(pluginIndexCode).toContain('exports.sayHello')
    expect(pluginIndexCode).toContain('exports.answer')
    expect(pluginIndexCode).toContain('exports.getFeatureCards')
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
