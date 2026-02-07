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

describe.sequential('auto import local vue sfc components (e2e)', () => {
  it('emits dist/components and injects usingComponents without manual definePageJson', async () => {
    await fs.remove(DIST_ROOT)
    await runBuild(APP_ROOT)

    const pageJsonPath = path.join(DIST_ROOT, 'pages/index/index.json')
    const componentJsonPath = path.join(DIST_ROOT, 'components/AutoCard/index.json')
    const componentTemplatePath = path.join(DIST_ROOT, 'components/AutoCard/index.wxml')

    expect(await fs.pathExists(pageJsonPath)).toBe(true)
    expect(await fs.pathExists(componentJsonPath)).toBe(true)
    expect(await fs.pathExists(componentTemplatePath)).toBe(true)

    const pageJson = await fs.readJson(pageJsonPath)
    expect(pageJson.usingComponents).toMatchObject({
      AutoCard: '/components/AutoCard/index',
    })

    const componentJson = await fs.readJson(componentJsonPath)
    expect(componentJson).toMatchObject({
      component: true,
    })
    expect(componentJson.options).toMatchObject({
      virtualHost: true,
      multipleSlots: true,
    })
    expect(componentJson.styleIsolation).toBe('apply-shared')
  })
})
