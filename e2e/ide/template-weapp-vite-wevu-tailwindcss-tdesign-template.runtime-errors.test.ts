import fs from 'node:fs/promises'
import path from 'pathe'
import { afterAll, describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'
import { attachRuntimeErrorCollector } from './runtimeErrors'
import {
  createTemplateWevuTdesignRegressionLaunchOptions,
  relaunchTemplateWevuTdesignRegressionPage,
} from './template-wevu-tdesign-regression.shared'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const TEMPLATE_ROOT = path.resolve(import.meta.dirname, '../../e2e-apps/template-wevu-tdesign-regression')
const DIST_ROOT = path.join(TEMPLATE_ROOT, 'dist')
const INDEX_PAGE_JS = path.join(DIST_ROOT, 'pages/index/index.js')
const INDEX_SCOPED_SLOT_WXML = path.join(DIST_ROOT, 'pages/index/index.__scoped-slot-items-1.wxml')
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
    label: 'ide:template-wevu-tdesign-regression-runtime-errors',
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
    sharedMiniProgram = await launchAutomator(createTemplateWevuTdesignRegressionLaunchOptions(TEMPLATE_ROOT))
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

describe.sequential('e2e app: template-wevu-tdesign-regression runtime errors', () => {
  afterAll(async () => {
    await closeSharedMiniProgram()
  })

  it('does not emit runtime console errors when opening layout pages', async (ctx) => {
    const miniProgram = await getSharedMiniProgram()
    const collector = attachRuntimeErrorCollector(miniProgram)
    const warningCollector = attachConsoleWarningCollector(miniProgram)

    try {
      for (const route of ROUTES) {
        const marker = collector.mark()
        const warningMarker = warningCollector.mark()
        const page = await relaunchTemplateWevuTdesignRegressionPage(ctx, miniProgram, route, 'runtime errors')
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

  it('does not emit runtime console errors when homepage layout toast is triggered', async (ctx) => {
    const miniProgram = await getSharedMiniProgram()
    const collector = attachRuntimeErrorCollector(miniProgram)
    const warningCollector = attachConsoleWarningCollector(miniProgram)

    try {
      const page = await relaunchTemplateWevuTdesignRegressionPage(ctx, miniProgram, '/pages/index/index', 'runtime errors')

      await page.waitFor(300)

      const marker = collector.mark()
      const warningMarker = warningCollector.mark()
      const initialRefreshSeed = await page.data('refreshSeed')
      const result = await page.callMethod('runLayoutToastE2E')

      expect(result).toMatchObject({
        refreshSeed: expect.any(Number),
      })
      expect(result.refreshSeed).not.toBe(initialRefreshSeed)

      expect(collector.getSince(marker)).toEqual([])
      expect(warningCollector.getSince(warningMarker)).toEqual([])
    }
    finally {
      warningCollector.dispose()
      collector.dispose()
    }
  })

  it('emits homepage KpiBoard scoped slot items without runtime errors', async (ctx) => {
    const miniProgram = await getSharedMiniProgram()
    const collector = attachRuntimeErrorCollector(miniProgram)
    const warningCollector = attachConsoleWarningCollector(miniProgram)

    try {
      const marker = collector.mark()
      const warningMarker = warningCollector.mark()
      await relaunchTemplateWevuTdesignRegressionPage(ctx, miniProgram, '/pages/index/index', 'runtime errors')

      const scopedSlotWxml = await fs.readFile(INDEX_SCOPED_SLOT_WXML, 'utf8')
      const pageJs = await fs.readFile(INDEX_PAGE_JS, 'utf8')

      expect(scopedSlotWxml).toContain('data-kpi-board-scope-label')
      expect(pageJs).toContain('label: "今日访问"')
      expect(collector.getSince(marker)).toEqual([])
      expect(warningCollector.getSince(warningMarker)).toEqual([])
    }
    finally {
      warningCollector.dispose()
      collector.dispose()
    }
  })
})
