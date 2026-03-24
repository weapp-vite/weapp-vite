import fs from 'node:fs/promises'
import path from 'pathe'
import { afterAll, describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'
import { attachRuntimeErrorCollector } from './runtimeErrors'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const TEMPLATE_ROOT = path.resolve(import.meta.dirname, '../../templates/weapp-vite-wevu-tailwindcss-tdesign-template')
const DIST_ROOT = path.join(TEMPLATE_ROOT, 'dist')
const ROUTE = '/pages/layout-feedback/index'

async function runBuild() {
  await fs.rm(DIST_ROOT, { recursive: true, force: true })
  await runWeappViteBuildWithLogCapture({
    cliPath: CLI_PATH,
    projectRoot: TEMPLATE_ROOT,
    platform: 'weapp',
    cwd: TEMPLATE_ROOT,
    label: 'ide:template-wevu-tdesign-layout-feedback-dialog',
  })
}

async function tapElement(page: any, selector: string | string[]) {
  const selectors = Array.isArray(selector) ? selector : [selector]
  for (const currentSelector of selectors) {
    const element = await page.$(currentSelector)
    if (!element) {
      continue
    }
    await element.tap()
    return
  }
  throw new Error(`Failed to find tap element: ${selectors.join(' | ')}`)
}

async function inspectDialogHost(page: any) {
  return await page.callMethod('inspectDialogHostE2E')
}

async function waitForDialogVisibility(page: any, visible: boolean, timeoutMs = 8_000) {
  const start = Date.now()
  while (Date.now() - start <= timeoutMs) {
    const state = await inspectDialogHost(page)
    if (state?.visible === visible) {
      return state
    }
    await page.waitFor(180)
  }
  throw new Error(`Timed out waiting for dialog visible=${String(visible)}`)
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

async function closeSharedMiniProgram() {
  if (!sharedMiniProgram) {
    return
  }
  const miniProgram = sharedMiniProgram
  sharedMiniProgram = null
  await miniProgram.close()
}

describe.sequential('template e2e: weapp-vite-wevu-tailwindcss-tdesign-template layout feedback dialog', () => {
  afterAll(async () => {
    await closeSharedMiniProgram()
  })

  it('closes page alert dialog after confirming', async () => {
    const miniProgram = await getSharedMiniProgram()
    const collector = attachRuntimeErrorCollector(miniProgram)

    try {
      const page = await miniProgram.reLaunch(ROUTE)
      if (!page) {
        throw new Error(`Failed to launch route: ${ROUTE}`)
      }

      await page.waitFor(400)
      const marker = collector.mark()

      await tapElement(page, '#layout-feedback-page-alert-trigger')
      expect(await waitForDialogVisibility(page, true)).toMatchObject({
        hasHost: true,
        visible: true,
        hasOnConfirm: true,
      })

      expect(await page.callMethod('runDialogHostConfirmE2E')).toMatchObject({
        hasHost: true,
        visible: false,
      })
      const actionLogs = await page.data('actionLogs')
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
      let page = await miniProgram.reLaunch(ROUTE)
      if (!page) {
        throw new Error(`Failed to launch route: ${ROUTE}`)
      }

      await page.waitFor(400)
      let marker = collector.mark()

      await tapElement(page, '#layout-feedback-page-confirm-trigger')
      expect(await waitForDialogVisibility(page, true)).toMatchObject({
        hasHost: true,
        visible: true,
        hasOnConfirm: true,
        hasOnCancel: true,
      })

      expect(await page.callMethod('runDialogHostCancelE2E')).toMatchObject({
        hasHost: true,
        visible: false,
      })
      let actionLogs = await page.data('actionLogs')
      expect(actionLogs).toContainEqual(expect.stringContaining('页面 Confirm'))
      expect(actionLogs).toContainEqual(expect.stringContaining('点击取消'))
      expect(collector.getSince(marker)).toEqual([])

      page = await miniProgram.reLaunch(ROUTE)
      if (!page) {
        throw new Error(`Failed to relaunch route: ${ROUTE}`)
      }
      await page.waitFor(400)
      marker = collector.mark()

      await tapElement(page, '#layout-feedback-page-confirm-trigger')
      expect(await waitForDialogVisibility(page, true)).toMatchObject({
        hasHost: true,
        visible: true,
      })

      expect(await page.callMethod('runDialogHostConfirmE2E')).toMatchObject({
        hasHost: true,
        visible: false,
      })
      actionLogs = await page.data('actionLogs')
      expect(actionLogs).toContainEqual(expect.stringContaining('页面 Confirm'))
      expect(actionLogs).toContainEqual(expect.stringContaining('点击确认'))

      expect(collector.getSince(marker)).toEqual([])
    }
    finally {
      collector.dispose()
    }
  })

  it('can close dialog host via native confirm/cancel methods', async () => {
    const miniProgram = await getSharedMiniProgram()

    const page = await miniProgram.reLaunch(ROUTE)
    if (!page) {
      throw new Error(`Failed to launch route: ${ROUTE}`)
    }

    await page.waitFor(400)

    await tapElement(page, '#layout-feedback-page-alert-trigger')
    expect(await waitForDialogVisibility(page, true)).toMatchObject({
      hasHost: true,
      visible: true,
    })
    expect(await page.callMethod('runDialogHostConfirmE2E')).toMatchObject({
      hasHost: true,
      visible: false,
    })

    await tapElement(page, '#layout-feedback-page-confirm-trigger')
    expect(await waitForDialogVisibility(page, true)).toMatchObject({
      hasHost: true,
      visible: true,
    })
    expect(await page.callMethod('runDialogHostCancelE2E')).toMatchObject({
      hasHost: true,
      visible: false,
    })
  })
})
