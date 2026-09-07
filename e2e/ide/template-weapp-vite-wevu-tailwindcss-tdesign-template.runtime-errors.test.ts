import fs from 'node:fs/promises'
import path from 'pathe'
import { afterAll, describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'
import { createDomAcceptance } from '../utils/domAcceptance'
import { attachRuntimeErrorCollector } from './runtimeErrors'
import { classText, dashboardNodes, layoutNodes, TDESIGN_FIXTURE, xpathClass } from './tdesignDom'
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

describe('e2e app: template-wevu-tdesign-regression runtime errors', { concurrent: false }, () => {
  afterAll(async () => {
    await closeSharedMiniProgram()
  })

  it('does not emit runtime console errors when opening layout pages', async (ctx) => {
    const acceptance = createDomAcceptance(ctx, TDESIGN_FIXTURE, [
      { id: 'dashboard', route: '/pages/index/index', action: '打开首页，检查 KPI 首屏', nodes: dashboardNodes() },
      { id: 'layouts', route: '/pages/layouts/index', action: '打开布局页，检查当前状态和三个布局选项', nodes: layoutNodes },
    ])
    const miniProgram = await getSharedMiniProgram()
    const collector = attachRuntimeErrorCollector(miniProgram)
    const warningCollector = attachConsoleWarningCollector(miniProgram)

    try {
      for (const route of ROUTES) {
        const marker = collector.mark()
        const warningMarker = warningCollector.mark()
        const page = await relaunchTemplateWevuTdesignRegressionPage(ctx, miniProgram, route, 'runtime errors')
        await page.waitFor(300)
        await acceptance.check(route === '/pages/index/index' ? 'dashboard' : 'layouts', miniProgram, page)
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
    const acceptance = createDomAcceptance(ctx, TDESIGN_FIXTURE, [
      { id: 'initial', route: '/pages/index/index', action: '检查刷新前的 KPI', nodes: dashboardNodes() },
      { id: 'refreshed', route: '/pages/index/index', action: '刷新后检查四张指标卡和真实 Toast', nodes: [classText('t-toast__text', '指标已刷新'), ...dashboardNodes(true)] },
      { id: 'toast-closed', route: '/pages/index/index', action: 'Toast 自动关闭后保留刷新结果', nodes: [...dashboardNodes(true), { selector: xpathClass('t-toast__text'), query: 'xpath', count: 0 }] },
    ])
    const miniProgram = await getSharedMiniProgram()
    const collector = attachRuntimeErrorCollector(miniProgram)
    const warningCollector = attachConsoleWarningCollector(miniProgram)

    try {
      const page = await relaunchTemplateWevuTdesignRegressionPage(ctx, miniProgram, '/pages/index/index', 'runtime errors')

      await page.waitFor(300)

      const marker = collector.mark()
      const warningMarker = warningCollector.mark()
      const initialRefreshSeed = await page.data('refreshSeed')
      await acceptance.check('initial', miniProgram, page)
      const result = await page.callMethod('runLayoutToastE2E')
      await acceptance.check('refreshed', miniProgram, page)
      await acceptance.check('toast-closed', miniProgram, page)

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
    const acceptance = createDomAcceptance(ctx, TDESIGN_FIXTURE, [
      { id: 'scoped-slot-items', route: '/pages/index/index', action: '检查作用域插槽实际渲染的四组标签与值', nodes: dashboardNodes() },
    ])
    const miniProgram = await getSharedMiniProgram()
    const collector = attachRuntimeErrorCollector(miniProgram)
    const warningCollector = attachConsoleWarningCollector(miniProgram)

    try {
      const marker = collector.mark()
      const warningMarker = warningCollector.mark()
      const page = await relaunchTemplateWevuTdesignRegressionPage(ctx, miniProgram, '/pages/index/index', 'runtime errors')
      await acceptance.check('scoped-slot-items', miniProgram, page)

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
