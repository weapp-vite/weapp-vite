import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import {
  resolveProjectAutomatorPort,
  startForwardConsole,
} from 'weapp-ide-cli'
import { launchAutomator } from '../utils/automator'
import {
  cleanupTrackedDevProcesses,
  startDevProcess,
} from '../utils/dev-process'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { createDomAcceptance } from '../utils/domAcceptance'
import { waitForFileContains } from '../utils/hmr-helpers'
import { cleanupResidualIdeProcesses } from '../utils/ide-devtools-cleanup'
import { appendIdeReportEvent } from '../utils/ideWarningReport'

const WORKSPACE_ROOT = path.resolve(import.meta.dirname, '../..')
const APP_ROOT = path.resolve(WORKSPACE_ROOT, 'apps/forward-console-demo')
const INDEX_TS = path.resolve(APP_ROOT, 'src/pages/index/index.ts')
const INDEX_WXML = path.resolve(APP_ROOT, 'src/pages/index/index.wxml')
const DIST_INDEX_JS = path.resolve(APP_ROOT, 'dist/pages/index/index.js')
const HMR_UPDATE_JS = path.resolve(APP_ROOT, 'dist/__weapp_vite_hmr/update.js')
const INDEX_ROUTE = '/pages/index/index'
const APP_AUTOMATOR_PORT = resolveProjectAutomatorPort(APP_ROOT)
const INITIAL_DESCRIPTION = '点击按钮，日志同步回当前终端。'
const INITIAL_LOG_MESSAGE = ['`[forward-console-demo] $', '{action.title} clicked`'].join('')
const LOG_CLICKED_RE = /\[mini:log\s*\]\s+\[forward-console-demo\] Log clicked/

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function waitForOutputAfter(
  getOutput: () => string,
  since: number,
  matcher: RegExp,
  timeoutMs = 30_000,
) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const nextOutput = getOutput().slice(since)
    if (matcher.test(nextOutput)) {
      return
    }
    await delay(200)
  }
  throw new Error(`Timed out waiting for output; recent output=${getOutput().slice(since)}`)
}

async function waitForIndexPage(miniProgram: any, timeoutMs = 30_000) {
  const start = Date.now()
  let lastPath = ''
  while (Date.now() - start < timeoutMs) {
    const page = await miniProgram.currentPage().catch(() => null)
    lastPath = String(page?.path ?? '')
    if (page && lastPath.replace(/^\/+/, '') === INDEX_ROUTE.replace(/^\/+/, '')) {
      return page
    }
    await delay(300)
  }
  throw new Error(`Timed out waiting for ${INDEX_ROUTE}; lastPath=${lastPath}`)
}

async function waitForPageDescription(miniProgram: any, expected: string, timeoutMs = 60_000) {
  const start = Date.now()
  let lastValue: unknown
  let lastText = ''
  while (Date.now() - start < timeoutMs) {
    const page = await waitForIndexPage(miniProgram, 5_000).catch(() => null)
    if (page) {
      lastValue = await page.data('description').catch((error: unknown) => {
        return error instanceof Error ? error.message : String(error)
      })
      if (lastValue === expected) {
        return page
      }
      const description = await page.$('.description').catch(() => null)
      lastText = description ? String(await description.text().catch(() => '')) : ''
      if (lastText.trim() === expected) {
        return page
      }
      await page.waitFor(300).catch(() => delay(300))
    }
    else {
      await delay(300)
    }
  }
  throw new Error(`Timed out waiting for page description "${expected}"; lastValue=${String(lastValue)}; lastText=${lastText}`)
}

async function emitLogClick(miniProgram: any) {
  const page = await miniProgram.currentPage()
  const buttons = await page.$$('.action-log', { fallback: false })
  expect(buttons).toHaveLength(1)
  await buttons[0].tap()
}

async function captureForwardConsoleFailure(miniProgram: any, rawEventCount: number, forwardedCount: number) {
  const page = await miniProgram.currentPage()
  const observations = await Promise.allSettled([
    Promise.resolve(page.path),
    page.data('eventCount'),
    page.$('.action-log').then((button: any) => button.attribute('data-level')),
    page.$('.status-pill text').then((element: any) => element.text()),
    page.$('.terminal-line').then((element: any) => element.text()),
  ])
  const text = JSON.stringify({
    rawEventCount,
    forwardedCount,
    observations: Object.fromEntries(['route', 'eventCount', 'buttonLevel', 'statusText', 'terminalText'].map((key, index) => {
      const result = observations[index]!
      return [key, result.status === 'fulfilled' ? result.value : { error: String(result.reason) }]
    })),
  })
  appendIdeReportEvent({ source: 'runtime', kind: 'message', level: 'info', channel: 'forward-console-diagnostics', project: 'apps/forward-console-demo', text })
  process.stdout.write(`[forward-console-diagnostics] ${text}\n`)
}

function replaceSourceLogMessage(source: string, nextMessage: string) {
  const updated = source.replace(INITIAL_LOG_MESSAGE, JSON.stringify(nextMessage))
    .replace('this.pushTimeline(action, nextCount)', `this.pushTimeline({ ...action, terminal: ${JSON.stringify(nextMessage)} }, nextCount)`)
  if (updated === source) {
    throw new Error(`Expected ${INDEX_TS} to contain the initial log message`)
  }
  return updated
}

async function waitForForwardedMessage(
  miniProgram: any,
  getOutput: () => string,
  matcher: RegExp,
  timeoutMs = 30_000,
) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const since = getOutput().length
    await emitLogClick(miniProgram)
    try {
      await waitForOutputAfter(getOutput, since, matcher, 2_000)
      return
    }
    catch {
      await delay(300)
    }
  }
  throw new Error(`Timed out waiting for forwarded HMR message; recent output=${getOutput()}`)
}

describe('forward-console-demo in real WeChat DevTools', { concurrent: false }, () => {
  let originalIndexTs = ''
  let originalIndexWxml = ''
  let devProcess: ReturnType<typeof startDevProcess> | undefined
  let forwardConsoleSession: Awaited<ReturnType<typeof startForwardConsole>> | undefined
  let miniProgram: Awaited<ReturnType<typeof launchAutomator>> | undefined

  async function cleanupTestState() {
    if (originalIndexTs) {
      await fs.writeFile(INDEX_TS, originalIndexTs, 'utf8').catch(() => {})
    }
    if (originalIndexWxml) {
      await fs.writeFile(INDEX_WXML, originalIndexWxml, 'utf8').catch(() => {})
    }
    await forwardConsoleSession?.close().catch(() => {})
    forwardConsoleSession = undefined
    miniProgram?.disconnect?.()
    miniProgram = undefined
    await devProcess?.stop().catch(() => {})
    devProcess = undefined
    await cleanupTrackedDevProcesses()
    await cleanupResidualIdeProcesses()
  }

  beforeAll(async () => {
    const [indexTs, indexWxml] = await Promise.all([
      fs.readFile(INDEX_TS, 'utf8'),
      fs.readFile(INDEX_WXML, 'utf8'),
    ])
    originalIndexTs = indexTs
    originalIndexWxml = indexWxml
    await cleanupResidualIdeProcesses()
    devProcess = startDevProcess('pnpm', ['exec', 'wv', 'dev'], {
      cwd: APP_ROOT,
      env: createDevProcessEnv(),
      reject: false,
      stdin: 'ignore',
    })
    await devProcess.waitFor(
      waitForFileContains(DIST_INDEX_JS, INITIAL_DESCRIPTION, 90_000),
      'forward-console demo initial dist generated',
    )
    miniProgram = await launchAutomator({
      projectPath: APP_ROOT,
      port: APP_AUTOMATOR_PORT,
      retryWarmupTimeout: true,
      timeout: 120_000,
      trustProject: true,
    })
  }, 240_000)

  afterEach(async () => {
    if (originalIndexTs) {
      await fs.writeFile(INDEX_TS, originalIndexTs, 'utf8').catch(() => {})
    }
    if (originalIndexWxml) {
      await fs.writeFile(INDEX_WXML, originalIndexWxml, 'utf8').catch(() => {})
    }
    await forwardConsoleSession?.close().catch(() => {})
    forwardConsoleSession = undefined
    await devProcess?.stop().catch(() => {})
    devProcess = undefined
    await cleanupTrackedDevProcesses()
  }, 60_000)

  afterAll(async () => {
    await cleanupTestState()
  }, 60_000)

  it('keeps forwarding console output after dev HMR updates the current page', async (ctx) => {
    const hmrMessage = `HMR forwardConsole ${Date.now()}`
    const dom = createDomAcceptance(ctx, 'apps/forward-console-demo', [
      {
        id: 'initial',
        route: INDEX_ROUTE,
        action: '检查日志演示首屏',
        nodes: [
          { selector: '.title', text: 'Forward Console Lab' },
          { selector: '.description', text: INITIAL_DESCRIPTION },
          { selector: '.status-pill text', text: '0 events' },
          { selector: '.action-button', count: 5 },
        ],
      },
      {
        id: 'clicked',
        route: INDEX_ROUTE,
        action: '点击 Log 并检查事件和终端行',
        nodes: [
          { selector: '.status-pill text', text: '1 events' },
          { selector: '.terminal-line', text: '[mini:log] forward demo click' },
          { selector: '.timeline-item', count: 2 },
        ],
      },
      {
        id: 'patched',
        route: INDEX_ROUTE,
        action: 'HMR 后点击 Log 并检查新函数产生的界面结果',
        nodes: [
          { selector: '.terminal-line', text: hmrMessage },
          { selector: '.terminal-level', text: 'log' },
          { selector: '(//view[@class="timeline-item"])[1]//view[@class="timeline-terminal"]', query: 'xpath', text: hmrMessage },
        ],
      },
    ])
    if (!miniProgram) {
      throw new Error('Shared automator session is not initialized')
    }
    const initialPage = await waitForPageDescription(miniProgram, INITIAL_DESCRIPTION)
    await dom.check('initial', miniProgram, initialPage)
    // 关闭 Runtime 事件域，模拟尚未打开 IDE Console 的状态，验证订阅会显式恢复事件域。
    await miniProgram.send('App.CDPCommand', { domain: 'Runtime', method: 'disable', params: {} })
    const forwardedMessages: string[] = []
    forwardConsoleSession = await startForwardConsole({
      miniProgram,
      projectPath: APP_ROOT,
      port: APP_AUTOMATOR_PORT,
      logLevels: ['log', 'info', 'warn', 'error'],
      onLog(event) {
        forwardedMessages.push(`[mini:${event.level.padEnd(5)}] ${event.message}`)
      },
    })

    let rawEventCount = 0
    const onRawConsole = () => {
      rawEventCount += 1
    }
    miniProgram.on('console', onRawConsole)
    try {
      await emitLogClick(miniProgram)
      await dom.check('clicked', miniProgram, await miniProgram.currentPage())
      await waitForOutputAfter(() => forwardedMessages.join('\n'), 0, LOG_CLICKED_RE)
    }
    catch (error) {
      await captureForwardConsoleFailure(miniProgram, rawEventCount, forwardedMessages.length).catch(() => {})
      throw error
    }
    finally {
      miniProgram.off('console', onRawConsole)
    }

    await fs.writeFile(INDEX_TS, replaceSourceLogMessage(originalIndexTs, hmrMessage), 'utf8')
    await devProcess.waitFor(
      waitForFileContains(HMR_UPDATE_JS, hmrMessage, 90_000),
      'forward-console demo stateful HMR delta update',
    )
    await waitForForwardedMessage(
      miniProgram,
      () => forwardedMessages.join('\n'),
      new RegExp(hmrMessage),
      90_000,
    )
    await dom.check('patched', miniProgram, await miniProgram.currentPage())
  }, 360_000)
})
