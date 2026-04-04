import { fs } from '@weapp-core/shared'
import path from 'pathe'
import { afterAll, describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const TEMPLATE_ROOT = path.resolve(import.meta.dirname, '../../templates/weapp-vite-wevu-template')
const DIST_ROOT = path.join(TEMPLATE_ROOT, 'dist')
const ROUTE = '/pages/layouts/index'

async function runBuild() {
  await fs.remove(DIST_ROOT)
  await runWeappViteBuildWithLogCapture({
    cliPath: CLI_PATH,
    projectRoot: TEMPLATE_ROOT,
    platform: 'weapp',
    cwd: TEMPLATE_ROOT,
    label: 'ide:template-weapp-vite-wevu-template-layouts',
  })
}

async function readPageWxml(page: any) {
  const root = await page.$('page')
  if (!root) {
    throw new Error('Failed to find page root')
  }
  return await root.wxml()
}

async function expectNoLayoutProps(page: any) {
  const props = await page.data('__wv_page_layout_props')
  if (props == null) {
    expect(props).toBeFalsy()
    return
  }

  expect(props).toMatchObject({
    title: null,
    subtitle: null,
  })
}

let sharedMiniProgram: any = null
let sharedBuildPrepared = false

async function getSharedMiniProgram() {
  if (!sharedBuildPrepared) {
    await runBuild()
    sharedBuildPrepared = true
  }
  if (!sharedMiniProgram) {
    sharedMiniProgram = await launchAutomator({
      projectPath: TEMPLATE_ROOT,
    })
  }
  return sharedMiniProgram
}

async function releaseSharedMiniProgram(miniProgram: any) {
  if (!sharedMiniProgram || sharedMiniProgram === miniProgram) {
    return
  }
  await miniProgram.close()
}

async function closeSharedMiniProgram() {
  if (!sharedMiniProgram) {
    return
  }
  const miniProgram = sharedMiniProgram
  sharedMiniProgram = null
  await miniProgram.close()
}

describe.sequential('template e2e: weapp-vite-wevu-template layouts runtime', () => {
  afterAll(async () => {
    await closeSharedMiniProgram()
  })

  it('switches between default/admin/none layouts at runtime', async () => {
    const miniProgram = await getSharedMiniProgram()

    try {
      const page = await miniProgram.reLaunch(ROUTE)
      if (!page) {
        throw new Error(`Failed to launch route: ${ROUTE}`)
      }

      await page.waitFor(200)
      let wxml = await readPageWxml(page)
      expect(wxml).toContain('<weapp-layout-default')
      expect(wxml).not.toContain('<weapp-layout-admin')
      expect(wxml).toContain('基础模板已接入 src/layouts 约定')
      expect(wxml).toContain('当前状态：default')
      await expectNoLayoutProps(page)

      await page.callMethod('applyAdminLayout')
      await page.waitFor(120)
      wxml = await readPageWxml(page)
      expect(wxml).toContain('<weapp-layout-admin')
      expect(wxml).toContain('当前状态：admin')
      expect(await page.data('__wv_page_layout_props')).toMatchObject({
        title: '业务后台布局',
        subtitle: '这个标题来自 setPageLayout() 传入的 props。',
      })

      await page.callMethod('clearLayout')
      await page.waitFor(120)
      wxml = await readPageWxml(page)
      expect(wxml).not.toContain('<weapp-layout-default')
      expect(wxml).not.toContain('<weapp-layout-admin')
      expect(wxml).toContain('基础模板已接入 src/layouts 约定')
      expect(wxml).toContain('当前状态：none')
      await expectNoLayoutProps(page)

      await page.callMethod('applyDefaultLayout')
      await page.waitFor(120)
      wxml = await readPageWxml(page)
      expect(wxml).toContain('<weapp-layout-default')
      expect(wxml).not.toContain('<weapp-layout-admin')
      expect(wxml).toContain('当前状态：default')
      await expectNoLayoutProps(page)
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })
})
