import fs from 'node:fs/promises'
import path from 'pathe'
import { afterAll, describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'
import { attachRuntimeErrorCollector } from './runtimeErrors'
import {
  createTemplateWevuTdesignRegressionLaunchOptions,
} from './template-wevu-tdesign-regression.shared'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const TEMPLATE_ROOT = path.resolve(import.meta.dirname, '../../e2e-apps/template-wevu-tdesign-regression')
const DIST_ROOT = path.join(TEMPLATE_ROOT, 'dist')
const ROUTE = '/pages/layout-feedback/index'
const PAGE_METHOD_TIMEOUT = 10_000
let sharedMiniProgram: any = null
let sharedBuildPrepared = false
let sharedPage: any = null

async function callPageMethod(page: any, method: string) {
  return await page.callMethodWithOptions(method, {
    routeOnly: true,
    timeout: PAGE_METHOD_TIMEOUT,
  })
}

async function readDialogHost(page: any) {
  return JSON.parse(await callPageMethod(page, 'inspectDialogHostJsonE2E'))
}

async function readActionLogs(page: any) {
  return JSON.parse(await callPageMethod(page, 'getLayoutFeedbackLogsE2E'))
}

async function waitForPageMethodReady(page: any) {
  await readDialogHost(page)
}

async function runBuild() {
  await fs.rm(DIST_ROOT, { recursive: true, force: true })
  await runWeappViteBuildWithLogCapture({
    cliPath: CLI_PATH,
    projectRoot: TEMPLATE_ROOT,
    platform: 'weapp',
    cwd: TEMPLATE_ROOT,
    label: 'ide:template-wevu-tdesign-regression-layout-feedback-dialog',
  })
}

async function getSharedMiniProgram() {
  if (!sharedBuildPrepared) {
    await runBuild()
    sharedBuildPrepared = true
  }
  if (!sharedMiniProgram) {
    sharedMiniProgram = await launchAutomator({
      ...createTemplateWevuTdesignRegressionLaunchOptions(TEMPLATE_ROOT),
      warmupRoute: ROUTE,
    })
  }
  return sharedMiniProgram
}

async function getSharedPage() {
  if (sharedPage) {
    return sharedPage
  }
  const miniProgram = await getSharedMiniProgram()
  const page = await miniProgram.currentPage({
    retries: 3,
    timeout: PAGE_METHOD_TIMEOUT,
  })
  if (String(page?.path ?? '').replace(/^\/+/, '') !== ROUTE.replace(/^\/+/, '')) {
    throw new Error(`Expected warmup route ${ROUTE}, received ${page?.path ?? '<none>'}`)
  }
  sharedPage = page
  await waitForPageMethodReady(page)
  return page
}

async function resetSharedPage(page: any) {
  await callPageMethod(page, 'resetLayoutFeedbackE2E')
  await page.waitFor(100)
  expect(await readDialogHost(page)).toMatchObject({
    hasHost: true,
    visible: false,
  })
}

async function closeSharedMiniProgram() {
  if (!sharedMiniProgram) {
    return
  }
  const miniProgram = sharedMiniProgram
  sharedMiniProgram = null
  sharedPage = null
  await miniProgram.close()
}

describe('e2e app: template-wevu-tdesign-regression layout feedback dialog', { concurrent: false }, () => {
  afterAll(async () => {
    await closeSharedMiniProgram()
  })

  it('closes page alert dialog after confirming', async () => {
    const miniProgram = await getSharedMiniProgram()
    const collector = attachRuntimeErrorCollector(miniProgram)

    try {
      const page = await getSharedPage()
      await resetSharedPage(page)
      const marker = collector.mark()

      await callPageMethod(page, 'runPageAlertCloseE2E')
      await page.waitFor(160)
      expect(await readDialogHost(page)).toMatchObject({
        hasHost: true,
        visible: true,
        hasOnConfirm: true,
      })

      await callPageMethod(page, 'runDialogHostConfirmE2E')
      await page.waitFor(100)
      expect(await readDialogHost(page)).toMatchObject({
        hasHost: true,
        visible: false,
      })
      const actionLogs = await readActionLogs(page)
      expect(actionLogs).toContainEqual(expect.stringContaining('页面 Alert'))
      expect(actionLogs).toContainEqual(expect.stringContaining('已确认'))
      expect(collector.getSince(marker)).toEqual([])
    }
    finally {
      collector.dispose()
    }
  })

  it('closes page confirm dialog after canceling and confirming', async () => {
    const miniProgram = await getSharedMiniProgram()
    const collector = attachRuntimeErrorCollector(miniProgram)

    try {
      const page = await getSharedPage()
      await resetSharedPage(page)
      let marker = collector.mark()

      await callPageMethod(page, 'runPageConfirmOpenE2E')
      await page.waitFor(160)
      expect(await readDialogHost(page)).toMatchObject({
        hasHost: true,
        visible: true,
        hasOnConfirm: true,
        hasOnCancel: true,
      })

      await callPageMethod(page, 'runDialogHostCancelE2E')
      await page.waitFor(100)
      expect(await readDialogHost(page)).toMatchObject({
        hasHost: true,
        visible: false,
      })
      let actionLogs = await readActionLogs(page)
      expect(actionLogs).toContainEqual(expect.stringContaining('页面 Confirm'))
      expect(actionLogs).toContainEqual(expect.stringContaining('点击取消'))
      expect(collector.getSince(marker)).toEqual([])

      await resetSharedPage(page)
      marker = collector.mark()

      await callPageMethod(page, 'runPageConfirmOpenE2E')
      await page.waitFor(160)
      expect(await readDialogHost(page)).toMatchObject({
        hasHost: true,
        visible: true,
      })

      await callPageMethod(page, 'runDialogHostConfirmE2E')
      await page.waitFor(100)
      expect(await readDialogHost(page)).toMatchObject({
        hasHost: true,
        visible: false,
      })
      actionLogs = await readActionLogs(page)
      expect(actionLogs).toContainEqual(expect.stringContaining('页面 Confirm'))
      expect(actionLogs).toContainEqual(expect.stringContaining('点击确认'))

      expect(collector.getSince(marker)).toEqual([])
    }
    finally {
      collector.dispose()
    }
  })

  it('can close dialog host via native confirm/cancel methods', async () => {
    const page = await getSharedPage()
    await resetSharedPage(page)

    await callPageMethod(page, 'runPageAlertCloseE2E')
    await page.waitFor(160)
    expect(await readDialogHost(page)).toMatchObject({
      hasHost: true,
      visible: true,
    })
    await callPageMethod(page, 'runDialogHostConfirmE2E')
    await page.waitFor(100)
    expect(await readDialogHost(page)).toMatchObject({
      hasHost: true,
      visible: false,
    })

    await callPageMethod(page, 'runPageConfirmOpenE2E')
    await page.waitFor(160)
    expect(await readDialogHost(page)).toMatchObject({
      hasHost: true,
      visible: true,
    })
    await callPageMethod(page, 'runDialogHostCancelE2E')
    await page.waitFor(100)
    expect(await readDialogHost(page)).toMatchObject({
      hasHost: true,
      visible: false,
    })
  })
})
