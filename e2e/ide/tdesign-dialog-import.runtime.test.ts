import { rm } from 'node:fs/promises'
import path from 'pathe'
import { afterAll, describe, expect, it } from 'vitest'
import { isDevtoolsHttpPortError, launchAutomator } from '../utils/automator'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'
import { attachRuntimeErrorCollector } from './runtimeErrors'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const APP_ROOT = path.resolve(import.meta.dirname, '../../e2e-apps/tdesign-dialog-import')
const DIST_ROOT = path.join(APP_ROOT, 'dist')

let buildPrepared = false
let miniProgram: any = null
let sharedInfraUnavailableMessage = ''

async function ensureBuilt() {
  if (buildPrepared) {
    return
  }

  await rm(DIST_ROOT, { recursive: true, force: true })
  await runWeappViteBuildWithLogCapture({
    cliPath: CLI_PATH,
    projectRoot: APP_ROOT,
    platform: 'weapp',
    cwd: APP_ROOT,
    label: 'ide:tdesign-dialog-import',
  })
  buildPrepared = true
}

async function getMiniProgram(ctx: { skip: (message?: string) => void }) {
  if (sharedInfraUnavailableMessage) {
    ctx.skip(sharedInfraUnavailableMessage)
    throw new Error(sharedInfraUnavailableMessage)
  }

  if (miniProgram) {
    return miniProgram
  }

  await ensureBuilt()

  try {
    miniProgram = await launchAutomator({
      projectPath: APP_ROOT,
    })
    return miniProgram
  }
  catch (error) {
    if (isDevtoolsHttpPortError(error)) {
      sharedInfraUnavailableMessage = 'WeChat DevTools 服务端口未开启，跳过 tdesign-dialog-import IDE 自动化用例。'
      ctx.skip(sharedInfraUnavailableMessage)
    }
    throw error
  }
}

async function tapElement(page: any, selector: string) {
  const element = await page.$(selector)
  if (!element) {
    throw new Error(`Failed to find tap element: ${selector}`)
  }
  await element.tap()
  await page.waitFor(240)
}

async function waitForDialogRuntime(page: any, timeoutMs = 20_000) {
  const startedAt = Date.now()
  let lastRuntime: Record<string, any> | null = null

  while (Date.now() - startedAt <= timeoutMs) {
    try {
      const runtime = await page.callMethod('_runE2E')
      lastRuntime = runtime
      if (runtime?.confirmType === 'function') {
        return runtime
      }
    }
    catch {
    }

    try {
      await page.waitFor(220)
    }
    catch {
    }
  }

  throw new Error(`Timed out waiting for dialog runtime: ${JSON.stringify(lastRuntime, null, 2)}`)
}

async function verifyDialogPageFlow(
  page: any,
  collector: ReturnType<typeof attachRuntimeErrorCollector>,
  options: {
    openSelector: string
    title: string
  },
) {
  expect(await page.callMethod('_resetE2E')).toMatchObject({
    confirmType: 'function',
    openCount: 0,
    settleCount: 0,
    dialogVisible: false,
    lastAction: 'idle',
    lastTrigger: 'idle',
    lastError: '',
    lastPayload: '',
    lastReturnedPromise: false,
  })

  const openMarker = collector.mark()
  await tapElement(page, options.openSelector)
  const opened = await page.callMethod('_runE2E')
  expect(opened).toMatchObject({
    confirmType: 'function',
    openCount: 1,
    settleCount: 0,
    dialogVisible: true,
    lastAction: 'opening',
    lastTrigger: 'user-tap',
    lastError: '',
    lastPayload: '',
    lastTitle: options.title,
    lastReturnedPromise: true,
  })
  expect(collector.getSince(openMarker)).toEqual([])

  const cancelMarker = collector.mark()
  const cancelled = await page.callMethod('_cancelDialogE2E')
  expect(cancelled).toMatchObject({
    confirmType: 'function',
    openCount: 1,
    settleCount: 1,
    dialogVisible: false,
    lastAction: 'cancelled',
    lastTrigger: 'user-tap',
    lastError: '{"trigger":"cancel"}',
    lastPayload: '{"trigger":"cancel"}',
    lastTitle: options.title,
    lastReturnedPromise: true,
  })
  expect(collector.getSince(cancelMarker)).toEqual([])

  const reopenMarker = collector.mark()
  const reopened = await page.callMethod('_openDialogE2E')
  expect(reopened).toMatchObject({
    confirmType: 'function',
    openCount: 2,
    settleCount: 1,
    dialogVisible: true,
    lastAction: 'opening',
    lastTrigger: 'e2e',
    lastError: '',
    lastPayload: '',
    lastTitle: options.title,
    lastReturnedPromise: true,
  })
  expect(collector.getSince(reopenMarker)).toEqual([])

  const confirmMarker = collector.mark()
  const confirmed = await page.callMethod('_confirmDialogE2E')
  expect(confirmed).toMatchObject({
    confirmType: 'function',
    openCount: 2,
    settleCount: 2,
    dialogVisible: false,
    lastAction: 'confirmed',
    lastTrigger: 'e2e',
    lastError: '',
    lastTitle: options.title,
    lastReturnedPromise: true,
  })
  expect(collector.getSince(confirmMarker)).toEqual([])
}

afterAll(async () => {
  if (miniProgram) {
    await miniProgram.close()
  }
})

describe.sequential('e2e app: tdesign-dialog-import (runtime)', () => {
  it('keeps bare dialog import callable in DevTools runtime', async (ctx) => {
    const mini = await getMiniProgram(ctx)
    const collector = attachRuntimeErrorCollector(mini)

    try {
      const page = await mini.reLaunch('/pages/dialog-bare/index')
      if (!page) {
        throw new Error('Failed to launch /pages/dialog-bare/index')
      }

      await page.waitFor(600)
      await waitForDialogRuntime(page)
      await verifyDialogPageFlow(page, collector, {
        openSelector: '#dialog-bare-open',
        title: 'issue-dialog-bare confirm title',
      })
    }
    finally {
      collector.dispose()
    }
  })

  it('keeps explicit /index dialog import callable in DevTools runtime', async (ctx) => {
    const mini = await getMiniProgram(ctx)
    const collector = attachRuntimeErrorCollector(mini)

    try {
      const page = await mini.reLaunch('/pages/dialog-index/index')
      if (!page) {
        throw new Error('Failed to launch /pages/dialog-index/index')
      }

      await page.waitFor(600)
      await waitForDialogRuntime(page)
      await verifyDialogPageFlow(page, collector, {
        openSelector: '#dialog-index-open',
        title: 'issue-dialog-index confirm title',
      })
    }
    finally {
      collector.dispose()
    }
  })
})
