import fs from 'node:fs/promises'
import path from 'pathe'
import { afterAll, describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'
import { attachRuntimeErrorCollector } from './runtimeErrors'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const TEMPLATE_ROOT = path.resolve(import.meta.dirname, '../../templates/weapp-vite-wevu-tailwindcss-tdesign-template')
const DIST_ROOT = path.join(TEMPLATE_ROOT, 'dist')
const ROUTES = [
  '/pages/index/index',
  '/pages/layouts/index',
]
const FEEDBACK_SELECTOR_WARNING = '未找到组件,请检查selector是否正确'

async function runBuild() {
  await fs.rm(DIST_ROOT, { recursive: true, force: true })
  await runWeappViteBuildWithLogCapture({
    cliPath: CLI_PATH,
    projectRoot: TEMPLATE_ROOT,
    platform: 'weapp',
    cwd: TEMPLATE_ROOT,
    label: 'ide:template-wevu-tdesign-runtime-errors',
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

describe.sequential('template e2e: weapp-vite-wevu-tailwindcss-tdesign-template runtime errors', () => {
  afterAll(async () => {
    await closeSharedMiniProgram()
  })

  it('does not emit runtime console errors when opening layout pages', async () => {
    const miniProgram = await getSharedMiniProgram()
    const collector = attachRuntimeErrorCollector(miniProgram)
    const warningCollector = attachConsoleWarningCollector(miniProgram)

    try {
      for (const route of ROUTES) {
        const marker = collector.mark()
        const warningMarker = warningCollector.mark()
        const page = await miniProgram.reLaunch(route)
        if (!page) {
          throw new Error(`Failed to launch route: ${route}`)
        }
        await page.waitFor(300)
        expect(collector.getSince(marker)).toEqual([])
        expect(warningCollector.getSince(warningMarker)).toEqual([])
      }
    }
    finally {
      warningCollector.dispose()
      collector.dispose()
    }
  })

  it('does not emit runtime console errors when homepage layout toast is triggered', async () => {
    const miniProgram = await getSharedMiniProgram()
    const collector = attachRuntimeErrorCollector(miniProgram)
    const warningCollector = attachConsoleWarningCollector(miniProgram)

    try {
      const page = await miniProgram.reLaunch('/pages/index/index')
      if (!page) {
        throw new Error('Failed to launch route: /pages/index/index')
      }

      await page.waitFor(300)

      const marker = collector.mark()
      const warningMarker = warningCollector.mark()
      await page.callMethod('refreshDashboard')
      await page.waitFor(300)

      expect(collector.getSince(marker)).toEqual([])
      expect(warningCollector.getSince(warningMarker)).toEqual([])
    }
    finally {
      warningCollector.dispose()
      collector.dispose()
    }
  })
})
