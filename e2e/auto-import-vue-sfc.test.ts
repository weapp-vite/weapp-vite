import { execa } from 'execa'
import fs from 'fs-extra'
import path from 'pathe'

const CLI_PATH = path.resolve(import.meta.dirname, '../packages/weapp-vite/src/cli.ts')
const APP_ROOT = path.resolve(import.meta.dirname, '../e2e-apps/auto-import-vue-sfc')
const DIST_ROOT = path.join(APP_ROOT, 'dist')

async function runBuild(root: string) {
  await execa('node', ['--import', 'tsx', CLI_PATH, 'build', root, '--platform', 'weapp', '--skipNpm'], {
    stdio: 'inherit',
  })
}

describe.sequential('auto import local components (e2e)', () => {
  it('covers vue sfc and native component auto-import scenarios', async () => {
    await fs.remove(DIST_ROOT)
    await runBuild(APP_ROOT)

    const vuePageJsonPath = path.join(DIST_ROOT, 'pages/index/index.json')
    const nativePageJsonPath = path.join(DIST_ROOT, 'pages/native/index.json')

    const sfcComponentJsonPath = path.join(DIST_ROOT, 'components/AutoCard/index.json')
    const sfcComponentTemplatePath = path.join(DIST_ROOT, 'components/AutoCard/index.wxml')
    const nativeComponentJsonPath = path.join(DIST_ROOT, 'components/NativeCard/index.json')
    const nativeComponentTemplatePath = path.join(DIST_ROOT, 'components/NativeCard/index.wxml')

    expect(await fs.pathExists(vuePageJsonPath)).toBe(true)
    expect(await fs.pathExists(nativePageJsonPath)).toBe(true)
    expect(await fs.pathExists(sfcComponentJsonPath)).toBe(true)
    expect(await fs.pathExists(sfcComponentTemplatePath)).toBe(true)
    expect(await fs.pathExists(nativeComponentJsonPath)).toBe(true)
    expect(await fs.pathExists(nativeComponentTemplatePath)).toBe(true)

    const vuePageJson = await fs.readJson(vuePageJsonPath)
    expect(vuePageJson.usingComponents).toMatchObject({
      AutoCard: '/components/AutoCard/index',
      NativeCard: '/components/NativeCard/index',
    })

    const nativePageJson = await fs.readJson(nativePageJsonPath)
    expect(nativePageJson.usingComponents).toMatchObject({
      NativeCard: '/components/NativeCard/index',
    })

    const sfcComponentJson = await fs.readJson(sfcComponentJsonPath)
    expect(sfcComponentJson).toMatchObject({
      component: true,
    })
    expect(sfcComponentJson.options).toMatchObject({
      virtualHost: true,
      multipleSlots: true,
    })
    expect(sfcComponentJson.styleIsolation).toBe('apply-shared')

    const nativeComponentJson = await fs.readJson(nativeComponentJsonPath)
    expect(nativeComponentJson).toMatchObject({
      component: true,
      styleIsolation: 'apply-shared',
    })
  })
})
