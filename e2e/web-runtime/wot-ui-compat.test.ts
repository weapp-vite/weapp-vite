/* eslint-disable e18e/ban-dependencies -- Wot UI Web E2E 需要 execa 与 Playwright。 */
import type { Subprocess } from 'execa'
import type { Browser, BrowserContext, Page } from 'playwright'
import { existsSync } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { setTimeout as sleep } from 'node:timers/promises'
import { execa } from 'execa'
import { chromium } from 'playwright'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { componentScenarios } from '../../e2e-apps/wot-ui-compat/src/scenarios'
import { comparePngWithBaseline } from '../../packages/weapp-ide-cli/src/cli/imageDiff'
import {
  assertNonBlankPng,
  collectRuntimeIssues,
  initializeWotUiPage,
  navigateToScenario,
  runWebScenario,
  WOT_UI_DESKTOP_VIEWPORT,
  WOT_UI_MOBILE_VIEWPORT,
} from '../wot-ui-compat/webHarness'

const ROOT = path.resolve(import.meta.dirname, '../..')
const APP_ROOT = path.join(ROOT, 'e2e-apps/wot-ui-compat')
const CLI_PATH = path.join(ROOT, 'packages/weapp-vite/bin/weapp-vite.js')
const BASELINE_ROOT = path.join(ROOT, 'e2e/web-runtime/baselines/wot-ui-compat/web')
const OUTPUT_ROOT = path.join(ROOT, '.tmp/wot-ui-compat/web')
const WEB_HOST = '127.0.0.1'
const WEB_PORT = Number(process.env.WOT_UI_WEB_E2E_PORT ?? 5182)
const WEB_URL = `http://${WEB_HOST}:${WEB_PORT}`
const UPDATE_BASELINES = process.env.WOT_UI_UPDATE_BASELINES === '1'
const REPORT_PROGRESS = process.env.WOT_UI_E2E_PROGRESS === '1'
const COMPONENT_FILTER = new Set(
  (process.env.WOT_UI_COMPONENT_FILTER ?? '')
    .split(',')
    .map(component => component.trim())
    .filter(Boolean),
)
const scenarios = COMPONENT_FILTER.size > 0
  ? componentScenarios.filter(scenario => COMPONENT_FILTER.has(scenario.component))
  : componentScenarios

function reportProgress(phase: 'behavior' | 'visual', viewport: string, index: number, component: string) {
  if (!REPORT_PROGRESS) {
    return
  }
  process.stdout.write(`[wot-ui-web] ${phase} ${viewport} ${index + 1}/${scenarios.length} ${component}\n`)
}

async function waitForServer(server: Subprocess, logs: { value: string }) {
  const deadline = Date.now() + 120_000
  while (Date.now() < deadline) {
    if (server.nodeChildProcess.exitCode !== null) {
      throw new Error(`[wot-ui-web] dev server 提前退出\n${logs.value}`)
    }
    try {
      if ((await fetch(WEB_URL)).ok) {
        return
      }
    }
    catch {}
    await sleep(250)
  }
  throw new Error(`[wot-ui-web] 等待 ${WEB_URL} 超时\n${logs.value}`)
}

async function stopServer(server?: Subprocess) {
  if (!server || server.nodeChildProcess.exitCode !== null) {
    return
  }
  server.kill('SIGTERM')
  await Promise.race([server.catch(() => {}), sleep(5_000)])
  if (server.nodeChildProcess.exitCode === null) {
    server.kill('SIGKILL')
  }
}

function collectFailures(
  viewport: string,
  result: Awaited<ReturnType<typeof runWebScenario>>,
) {
  const failures: string[] = []
  if (result.rootCount !== 1) {
    failures.push(`${viewport}/${result.component}: rootCount=${result.rootCount}`)
  }
  if (result.targetCount !== 1) {
    failures.push(`${viewport}/${result.component}: targetCount=${result.targetCount}`)
  }
  if (!result.subjectBox || result.subjectBox.width <= 0 || result.subjectBox.height <= 0) {
    failures.push(`${viewport}/${result.component}: 场景容器无可见边界`)
  }
  if (!result.actualState.startsWith(result.expectedState)) {
    failures.push(`${viewport}/${result.component}: expected=${result.expectedState}, actual=${result.actualState}`)
  }
  for (const issue of result.issues) {
    failures.push(`${viewport}/${result.component}: ${issue.type}: ${issue.message}${issue.url ? ` (${issue.url})` : ''}`)
  }
  return failures
}

describe.sequential('Wot UI 2.2.0 Web 全组件兼容', () => {
  let server: Subprocess | undefined
  let browser: Browser | undefined
  let mobileContext: BrowserContext | undefined
  let desktopContext: BrowserContext | undefined
  let mobilePage: Page
  let desktopPage: Page
  let mobileIssues: ReturnType<typeof collectRuntimeIssues>
  let desktopIssues: ReturnType<typeof collectRuntimeIssues>

  beforeAll(async () => {
    await fs.mkdir(OUTPUT_ROOT, { recursive: true })
    server = execa('node', [CLI_PATH, APP_ROOT, '--platform', 'web', '--host', WEB_HOST], {
      cwd: ROOT,
      env: {
        ...process.env,
        WEAPP_WEB_HOST: WEB_HOST,
        WEAPP_WEB_PORT: String(WEB_PORT),
        WEAPP_WEB_OPEN: 'false',
        WOT_UI_WEB_PORT: String(WEB_PORT),
      },
    })
    const logs = { value: '' }
    server.stdout?.on('data', chunk => logs.value += String(chunk))
    server.stderr?.on('data', chunk => logs.value += String(chunk))
    await waitForServer(server, logs)
    const channel = process.env.WEAPP_VITE_WEB_E2E_CHANNEL
      ?? (existsSync(chromium.executablePath()) ? undefined : 'chrome')
    browser = await chromium.launch(channel
      ? { headless: true, channel: channel as 'chrome' }
      : { headless: true })
    mobileContext = await browser.newContext({ viewport: WOT_UI_MOBILE_VIEWPORT })
    desktopContext = await browser.newContext({ viewport: WOT_UI_DESKTOP_VIEWPORT })
    mobilePage = await mobileContext.newPage()
    desktopPage = await desktopContext.newPage()
    mobileIssues = collectRuntimeIssues(mobilePage)
    desktopIssues = collectRuntimeIssues(desktopPage)
    await initializeWotUiPage(mobilePage, WEB_URL)
    await initializeWotUiPage(desktopPage, WEB_URL)
  }, 120_000)

  afterAll(async () => {
    await browser?.close()
    await stopServer(server)
  })

  it('逐页完成移动与桌面行为断言', { timeout: 900_000 }, async () => {
    const failures: string[] = []
    for (const [index, scenario] of scenarios.entries()) {
      reportProgress('behavior', 'mobile', index, scenario.component)
      failures.push(...collectFailures('mobile', await runWebScenario(mobilePage, scenario, mobileIssues)))
      reportProgress('behavior', 'desktop', index, scenario.component)
      failures.push(...collectFailures('desktop', await runWebScenario(desktopPage, scenario, desktopIssues)))
    }
    expect(failures, failures.join('\n')).toEqual([])
  })

  it('逐页比对移动与桌面视觉基线', { timeout: 900_000 }, async () => {
    const failures: string[] = []
    for (const [viewport, page] of [['mobile', mobilePage], ['desktop', desktopPage]] as const) {
      await initializeWotUiPage(page, WEB_URL)
      for (const [index, scenario] of scenarios.entries()) {
        reportProgress('visual', viewport, index, scenario.component)
        await navigateToScenario(page, scenario)
        const screenshot = await page.screenshot({ animations: 'disabled' })
        const baselinePath = path.join(BASELINE_ROOT, viewport, `${scenario.component}.png`)
        const currentPath = path.join(OUTPUT_ROOT, viewport, `${scenario.component}.current.png`)
        const diffPath = path.join(OUTPUT_ROOT, viewport, `${scenario.component}.diff.png`)
        await fs.mkdir(path.dirname(currentPath), { recursive: true })
        await fs.writeFile(currentPath, screenshot)
        try {
          assertNonBlankPng(screenshot, `${viewport}/${scenario.component}`)
          if (UPDATE_BASELINES) {
            await fs.mkdir(path.dirname(baselinePath), { recursive: true })
            await fs.writeFile(baselinePath, screenshot)
          }
          else {
            const result = await comparePngWithBaseline({
              baselinePath,
              currentPngBuffer: screenshot,
              diffOutputPath: diffPath,
              threshold: 0.18,
            })
            if (result.diffRatio > 0.03) {
              failures.push(`${viewport}/${scenario.component}: diffRatio=${result.diffRatio}`)
            }
          }
        }
        catch (error) {
          failures.push(`${viewport}/${scenario.component}: ${error instanceof Error ? error.message : String(error)}`)
        }
      }
    }
    expect(failures, failures.join('\n')).toEqual([])
  })
})
