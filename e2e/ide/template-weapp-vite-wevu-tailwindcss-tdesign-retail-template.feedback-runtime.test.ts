import { rm } from 'node:fs/promises'
import path from 'pathe'
import { afterAll, describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'
import { attachRuntimeErrorCollector } from './runtimeErrors'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const TEMPLATE_ROOT = path.resolve(import.meta.dirname, '../../templates/weapp-vite-wevu-tailwindcss-tdesign-retail-template')
const DIST_ROOT = path.join(TEMPLATE_ROOT, 'dist')
const FEEDBACK_SELECTOR_WARNING = '未找到组件,请检查selector是否正确'
const LAUNCH_WARMUP_ROUTE = '/pages/category/index'
const LAUNCH_RETRYABLE_PATTERN = /Timeout in launch automator|Timeout in warmup reLaunch|startsWith|WeChat DevTools CLI exited before automator socket was ready/i

async function runBuild() {
  await rm(DIST_ROOT, { recursive: true, force: true })
  await runWeappViteBuildWithLogCapture({
    cliPath: CLI_PATH,
    projectRoot: TEMPLATE_ROOT,
    platform: 'weapp',
    cwd: TEMPLATE_ROOT,
    label: 'ide:retail-feedback-runtime',
  })
}

let sharedMiniProgram: any = null
let sharedBuildPrepared = false

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function launchRetailTemplateAutomator() {
  let lastError: unknown

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await launchAutomator({
        projectPath: TEMPLATE_ROOT,
        warmupRoute: LAUNCH_WARMUP_ROUTE,
      })
    }
    catch (error) {
      lastError = error
      const message = error instanceof Error ? error.message : String(error)
      if (attempt === 1 || !LAUNCH_RETRYABLE_PATTERN.test(message)) {
        throw error
      }
      await sleep(1_500)
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Failed to launch retail feedback automator')
}

async function getSharedMiniProgram() {
  if (!sharedBuildPrepared) {
    await runBuild()
    sharedBuildPrepared = true
  }
  if (!sharedMiniProgram) {
    sharedMiniProgram = await launchRetailTemplateAutomator()
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

function attachConsoleWarningCollector(miniProgram: any) {
  const warnings: string[] = []
  const onConsole = (entry: any) => {
    const text = typeof entry?.text === 'string'
      ? entry.text
      : Array.isArray(entry?.args)
        ? entry.args.map((item: any) => item?.value ?? item).join(' ')
        : ''
    const level = String(entry?.level ?? '').toLowerCase()
    if (level === 'warn' && text.includes(FEEDBACK_SELECTOR_WARNING)) {
      warnings.push(text)
    }
  }

  miniProgram.on('console', onConsole)

  return {
    mark() {
      return warnings.length
    },
    getSince(marker: number) {
      return warnings.slice(marker)
    },
    dispose() {
      miniProgram.removeListener('console', onConsole)
    },
  }
}

describe.sequential('template e2e: weapp-vite-wevu-tailwindcss-tdesign-retail-template feedback runtime', () => {
  afterAll(async () => {
    await closeSharedMiniProgram()
  })

  it('does not emit runtime warnings when layout toast is triggered from home page', async () => {
    const miniProgram = await getSharedMiniProgram()
    const collector = attachRuntimeErrorCollector(miniProgram)
    const warningCollector = attachConsoleWarningCollector(miniProgram)

    try {
      const page = await miniProgram.reLaunch('/pages/home/home')
      if (!page) {
        throw new Error('Failed to launch route: /pages/home/home')
      }

      await page.waitFor(400)

      const marker = collector.mark()
      const warningMarker = warningCollector.mark()
      await page.callMethod('goodListAddCartHandle')
      await page.waitFor(300)

      expect(collector.getSince(marker)).toEqual([])
      expect(warningCollector.getSince(warningMarker)).toEqual([])
    }
    finally {
      warningCollector.dispose()
      collector.dispose()
    }
  })

  it('does not emit runtime warnings when layout dialog is triggered on fill-tracking-no load', async () => {
    const miniProgram = await getSharedMiniProgram()
    const collector = attachRuntimeErrorCollector(miniProgram)
    const warningCollector = attachConsoleWarningCollector(miniProgram)

    try {
      const marker = collector.mark()
      const warningMarker = warningCollector.mark()
      const page = await miniProgram.reLaunch('/pages/order/fill-tracking-no/index')
      if (!page) {
        throw new Error('Failed to launch route: /pages/order/fill-tracking-no/index')
      }

      await page.waitFor(500)

      expect(collector.getSince(marker)).toEqual([])
      expect(warningCollector.getSince(warningMarker)).toEqual([])
    }
    finally {
      warningCollector.dispose()
      collector.dispose()
    }
  })
})
