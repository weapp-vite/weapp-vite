/* eslint-disable e18e/ban-dependencies -- 组件库 Web E2E 需要 execa 与 Playwright。 */
import type { Subprocess } from 'execa'
import type { Browser, BrowserContext, Page } from 'playwright'
import type { ComponentScenarioLike } from './webHarness'
import { existsSync } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { setTimeout as sleep } from 'node:timers/promises'
import { execa } from 'execa'
import { chromium } from 'playwright'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { comparePngWithBaseline } from '../../packages/weapp-ide-cli/src/cli/imageDiff'
import {
  assertNonBlankPng,
  captureStableScreenshot,
  collectRuntimeIssues,
  COMPONENT_LIBRARY_DESKTOP_VIEWPORT,
  COMPONENT_LIBRARY_MOBILE_VIEWPORT,
  initializeComponentLibraryPage,
  navigateToScenario,
  runWebScenario,
} from './webHarness'

const ROOT = path.resolve(import.meta.dirname, '../..')
const CLI_PATH = path.join(ROOT, 'packages/weapp-vite/bin/weapp-vite.js')

export interface ComponentLibraryWebSuiteOptions {
  appRoot: string
  baselineRoot: string
  componentFilterEnv: string
  defaultPort: number
  expectedCount: number
  outputRoot: string
  portEnv: string
  progressEnv: string
  progressLabel: string
  scenarios: readonly ComponentScenarioLike[]
  serverPortEnv: string
  suiteName: string
  updateBaselinesEnv: string
}

function reportProgress(
  enabled: boolean,
  label: string,
  total: number,
  phase: 'behavior' | 'visual',
  viewport: string,
  index: number,
  component: string,
) {
  if (enabled) {
    process.stdout.write(`[${label}] ${phase} ${viewport} ${index + 1}/${total} ${component}\n`)
  }
}

async function waitForServer(server: Subprocess, logs: { value: string }, webUrl: string, label: string) {
  const deadline = Date.now() + 120_000
  while (Date.now() < deadline) {
    if (server.nodeChildProcess.exitCode !== null) {
      throw new Error(`[${label}] dev server 提前退出\n${logs.value}`)
    }
    try {
      if ((await fetch(webUrl)).ok) {
        return
      }
    }
    catch {}
    await sleep(250)
  }
  throw new Error(`[${label}] 等待 ${webUrl} 超时\n${logs.value}`)
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

export function defineComponentLibraryWebSuite(options: ComponentLibraryWebSuiteOptions) {
  const appRoot = path.join(ROOT, options.appRoot)
  const baselineRoot = path.join(ROOT, options.baselineRoot)
  const outputRoot = path.join(ROOT, options.outputRoot)
  const webHost = '127.0.0.1'
  const webPort = Number(process.env[options.portEnv] ?? options.defaultPort)
  const webUrl = `http://${webHost}:${webPort}`
  const updateBaselines = process.env[options.updateBaselinesEnv] === '1'
  const reportProgressEnabled = process.env[options.progressEnv] === '1'
  const componentFilter = new Set(
    (process.env[options.componentFilterEnv] ?? '')
      .split(',')
      .map(component => component.trim())
      .filter(Boolean),
  )
  const scenarios = componentFilter.size > 0
    ? options.scenarios.filter(scenario => componentFilter.has(scenario.component))
    : options.scenarios

  describe.sequential(options.suiteName, () => {
    let server: Subprocess | undefined
    let browser: Browser | undefined
    let mobilePage: Page
    let desktopPage: Page
    let mobileContext: BrowserContext | undefined
    let desktopContext: BrowserContext | undefined
    let mobileIssues: ReturnType<typeof collectRuntimeIssues>
    let desktopIssues: ReturnType<typeof collectRuntimeIssues>

    beforeAll(async () => {
      expect(options.scenarios).toHaveLength(options.expectedCount)
      await fs.mkdir(outputRoot, { recursive: true })
      server = execa('node', [CLI_PATH, appRoot, '--platform', 'web', '--host', webHost], {
        cwd: ROOT,
        env: {
          ...process.env,
          [options.serverPortEnv]: String(webPort),
          WEAPP_WEB_HOST: webHost,
          WEAPP_WEB_OPEN: 'false',
          WEAPP_WEB_PORT: String(webPort),
        },
      })
      const logs = { value: '' }
      server.stdout?.on('data', chunk => logs.value += String(chunk))
      server.stderr?.on('data', chunk => logs.value += String(chunk))
      await waitForServer(server, logs, webUrl, options.progressLabel)
      const channel = process.env.WEAPP_VITE_WEB_E2E_CHANNEL
        ?? (existsSync(chromium.executablePath()) ? undefined : 'chrome')
      browser = await chromium.launch(channel
        ? { headless: true, channel: channel as 'chrome' }
        : { headless: true })
      mobileContext = await browser.newContext({ viewport: COMPONENT_LIBRARY_MOBILE_VIEWPORT })
      desktopContext = await browser.newContext({ viewport: COMPONENT_LIBRARY_DESKTOP_VIEWPORT })
      mobilePage = await mobileContext.newPage()
      desktopPage = await desktopContext.newPage()
      mobileIssues = collectRuntimeIssues(mobilePage)
      desktopIssues = collectRuntimeIssues(desktopPage)
      await initializeComponentLibraryPage(mobilePage, webUrl, mobileIssues)
      await initializeComponentLibraryPage(desktopPage, webUrl, desktopIssues)
    }, 120_000)

    afterAll(async () => {
      await browser?.close()
      await stopServer(server)
    })

    it('逐页完成移动与桌面行为断言', { timeout: 1_200_000 }, async () => {
      const failures: string[] = []
      for (const [index, scenario] of scenarios.entries()) {
        reportProgress(reportProgressEnabled, options.progressLabel, scenarios.length, 'behavior', 'mobile', index, scenario.component)
        failures.push(...collectFailures('mobile', await runWebScenario(mobilePage, scenario, mobileIssues)))
        reportProgress(reportProgressEnabled, options.progressLabel, scenarios.length, 'behavior', 'desktop', index, scenario.component)
        failures.push(...collectFailures('desktop', await runWebScenario(desktopPage, scenario, desktopIssues)))
      }
      expect(scenarios.length).toBeGreaterThan(0)
      expect(failures, failures.join('\n')).toEqual([])
    })

    it('逐页比对移动与桌面视觉基线', { timeout: 1_200_000 }, async () => {
      const failures: string[] = []
      for (const [viewport, page] of [['mobile', mobilePage], ['desktop', desktopPage]] as const) {
        await initializeComponentLibraryPage(
          page,
          webUrl,
          viewport === 'mobile' ? mobileIssues : desktopIssues,
        )
        for (const [index, scenario] of scenarios.entries()) {
          reportProgress(reportProgressEnabled, options.progressLabel, scenarios.length, 'visual', viewport, index, scenario.component)
          await navigateToScenario(
            page,
            scenario,
            viewport === 'mobile' ? mobileIssues : desktopIssues,
          )
          const screenshot = await captureStableScreenshot(page, `${viewport}/${scenario.component}`)
          const baselinePath = path.join(baselineRoot, viewport, `${scenario.component}.png`)
          const currentPath = path.join(outputRoot, viewport, `${scenario.component}.current.png`)
          const diffPath = path.join(outputRoot, viewport, `${scenario.component}.diff.png`)
          await fs.mkdir(path.dirname(currentPath), { recursive: true })
          await fs.writeFile(currentPath, screenshot)
          try {
            assertNonBlankPng(screenshot, `${viewport}/${scenario.component}`)
            if (updateBaselines) {
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
}
