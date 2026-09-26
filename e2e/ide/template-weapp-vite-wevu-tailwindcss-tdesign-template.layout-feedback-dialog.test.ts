import fs from 'node:fs/promises'
import path from 'pathe'
import { afterAll, describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'
import { createDomAcceptance } from '../utils/domAcceptance'
import { attachRuntimeErrorCollector } from './runtimeErrors'
import { dialogCheckpoint, feedbackCheckpoint, TDESIGN_FIXTURE } from './tdesignDom'
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

  it('closes page alert dialog after confirming', async (ctx) => {
    const acceptance = createDomAcceptance(ctx, TDESIGN_FIXTURE, [
      feedbackCheckpoint('initial', '重置后检查空日志与关闭状态'),
      dialogCheckpoint('alert-open', 'Alert'),
      feedbackCheckpoint('alert-confirmed', '确认后检查弹窗关闭和实际回调日志', '页面 Alert #1 已确认'),
    ])
    const miniProgram = await getSharedMiniProgram()
    const collector = attachRuntimeErrorCollector(miniProgram)

    try {
      const page = await getSharedPage()
      await resetSharedPage(page)
      await acceptance.check('initial', miniProgram, page)
      const marker = collector.mark()

      await callPageMethod(page, 'runPageAlertCloseE2E')
      await acceptance.check('alert-open', miniProgram, page)
      await page.waitFor(160)
      expect(await readDialogHost(page)).toMatchObject({
        hasHost: true,
        visible: true,
        hasOnConfirm: true,
      })

      await callPageMethod(page, 'runDialogHostConfirmE2E')
      await acceptance.check('alert-confirmed', miniProgram, page)
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

  it('closes page confirm dialog after canceling and confirming', async (ctx) => {
    const acceptance = createDomAcceptance(ctx, TDESIGN_FIXTURE, [
      feedbackCheckpoint('initial', '重置后检查空日志与关闭状态'),
      dialogCheckpoint('cancel-open', 'Confirm'),
      feedbackCheckpoint('canceled', '取消后检查弹窗消失和回调日志', '页面 Confirm #1 点击取消'),
      feedbackCheckpoint('reset', '再次重置后检查空日志和关闭状态'),
      dialogCheckpoint('confirm-open', 'Confirm'),
      feedbackCheckpoint('confirmed', '确认后检查弹窗消失和回调日志', '页面 Confirm #1 点击确认'),
    ])
    const miniProgram = await getSharedMiniProgram()
    const collector = attachRuntimeErrorCollector(miniProgram)

    try {
      const page = await getSharedPage()
      await resetSharedPage(page)
      await acceptance.check('initial', miniProgram, page)
      let marker = collector.mark()

      await callPageMethod(page, 'runPageConfirmOpenE2E')
      await acceptance.check('cancel-open', miniProgram, page)
      await page.waitFor(160)
      expect(await readDialogHost(page)).toMatchObject({
        hasHost: true,
        visible: true,
        hasOnConfirm: true,
        hasOnCancel: true,
      })

      await callPageMethod(page, 'runDialogHostCancelE2E')
      await acceptance.check('canceled', miniProgram, page)
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
      await acceptance.check('reset', miniProgram, page)
      marker = collector.mark()

      await callPageMethod(page, 'runPageConfirmOpenE2E')
      await acceptance.check('confirm-open', miniProgram, page)
      await page.waitFor(160)
      expect(await readDialogHost(page)).toMatchObject({
        hasHost: true,
        visible: true,
      })

      await callPageMethod(page, 'runDialogHostConfirmE2E')
      await acceptance.check('confirmed', miniProgram, page)
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

  it('can close dialog host via native confirm/cancel methods', async (ctx) => {
    const acceptance = createDomAcceptance(ctx, TDESIGN_FIXTURE, [
      feedbackCheckpoint('initial', '检查原生宿主初始关闭状态'),
      dialogCheckpoint('native-alert-open', 'Alert'),
      feedbackCheckpoint('native-alert-confirmed', '原生确认后检查实际日志和关闭状态', '页面 Alert #1 已确认'),
      dialogCheckpoint('native-confirm-open', 'Confirm', 2),
      feedbackCheckpoint('native-confirm-canceled', '原生取消后检查实际日志和关闭状态', '页面 Confirm #2 点击取消'),
    ])
    const miniProgram = await getSharedMiniProgram()
    const page = await getSharedPage()
    await resetSharedPage(page)
    await acceptance.check('initial', miniProgram, page)

    await callPageMethod(page, 'runPageAlertCloseE2E')
    await acceptance.check('native-alert-open', miniProgram, page)
    await page.waitFor(160)
    expect(await readDialogHost(page)).toMatchObject({
      hasHost: true,
      visible: true,
    })
    await callPageMethod(page, 'runDialogHostConfirmE2E')
    await acceptance.check('native-alert-confirmed', miniProgram, page)
    await page.waitFor(100)
    expect(await readDialogHost(page)).toMatchObject({
      hasHost: true,
      visible: false,
    })

    await callPageMethod(page, 'runPageConfirmOpenE2E')
    await acceptance.check('native-confirm-open', miniProgram, page)
    await page.waitFor(160)
    expect(await readDialogHost(page)).toMatchObject({
      hasHost: true,
      visible: true,
    })
    await callPageMethod(page, 'runDialogHostCancelE2E')
    await acceptance.check('native-confirm-canceled', miniProgram, page)
    await page.waitFor(100)
    expect(await readDialogHost(page)).toMatchObject({
      hasHost: true,
      visible: false,
    })
  })
})
