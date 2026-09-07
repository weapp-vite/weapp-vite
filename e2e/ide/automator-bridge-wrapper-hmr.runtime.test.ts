import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { startDevProcess } from '../utils/dev-process'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { createDomAcceptance } from '../utils/domAcceptance'
import { replaceFileByRename, waitForFileContains } from '../utils/hmr-helpers'
import { createHmrRuntimeDiagnostics } from '../utils/hmrRuntimeDiagnostics'
import {
  cleanupResidualIdeProcesses,
} from '../utils/ide-devtools-cleanup'
import { APP_ROOT, CLI_PATH, DIST_ROOT, waitForFile } from '../wevu-runtime.utils'

const HMR_PAGE_WXML = path.join(APP_ROOT, 'src/pages/hmr/index.wxml')
const HMR_PAGE_WXML_DIST = path.join(DIST_ROOT, 'pages/hmr/index.wxml')
const TEMPLATE_TITLES = ['HMR', 'ONE', 'TWO', 'SIX', 'TEN']

function getSessionMetadata(miniProgram: any) {
  return Reflect.get(miniProgram as object, '__WEAPP_VITE_SESSION_METADATA') as { projectPath?: string } | undefined
}

describe('automator bridge wrapper snapshot hmr (ide)', { concurrent: false }, () => {
  let dev: ReturnType<typeof startDevProcess> | undefined
  let miniProgram: Awaited<ReturnType<typeof launchAutomator>> | undefined
  let originalWxml = ''

  beforeAll(async () => {
    vi.stubEnv('WEAPP_VITE_E2E_AUTOMATOR_BRIDGE_WRAPPER', '1')
    await cleanupResidualIdeProcesses()
    await fs.remove(DIST_ROOT)
    originalWxml = await fs.readFile(HMR_PAGE_WXML, 'utf8')

    dev = startDevProcess('node', ['--import', 'tsx', CLI_PATH, 'dev', APP_ROOT, '--platform', 'weapp', '--skipNpm'], {
      env: createDevProcessEnv(),
      stdio: 'inherit',
    })

    await dev.waitForInitialBuild()
    await dev.waitFor(
      Promise.all([
        waitForFile(path.join(DIST_ROOT, 'app.json'), 90_000),
        waitForFileContains(HMR_PAGE_WXML_DIST, '<view class="title">HMR</view>', 90_000),
      ]),
      'bridge wrapper hmr baseline dist generated',
    )

    miniProgram = await launchAutomator({
      projectPath: APP_ROOT,
      skipWarmup: true,
      warmupRoute: '/pages/hmr/index',
      warmupRootSelectors: ['.title', '#hmr-count'],
    })
  }, 120_000)

  afterAll(async () => {
    try {
      await miniProgram?.close?.()
    }
    finally {
      try {
        if (originalWxml) {
          await replaceFileByRename(HMR_PAGE_WXML, originalWxml)
        }
        await dev?.stop()
        await cleanupResidualIdeProcesses()
      }
      finally {
        vi.unstubAllEnvs()
      }
    }
  }, 60_000)

  it('renders four same-length template updates while retaining page and app identity', async (ctx) => {
    const dom = createDomAcceptance(ctx, 'e2e-apps/wevu-runtime-e2e', [
      { id: 'initial', route: '/pages/hmr/index', action: '首屏检查实际模板标题和初始交互状态', nodes: [{ selector: '.title', text: 'HMR' }, { selector: '#hmr-count', text: 'count: 0' }] },
      ...TEMPLATE_TITLES.map((title, index) => ({
        id: `retained:${index}`,
        route: '/pages/hmr/index',
        action: index === 0 ? '操作一次后检查渲染计数' : `第 ${index} 次等长度模板更新，检查真实标题及保留的交互计数`,
        nodes: [{ selector: '.title', text: title }, { selector: '#hmr-count', text: 'count: 1' }],
      })),
    ])
    const wrapperProjectPath = getSessionMetadata(miniProgram)?.projectPath
    expect(wrapperProjectPath).toContain(path.join('.tmp', 'e2e-ide-bridge-projects'))
    const configPath = path.join(wrapperProjectPath!, 'project.config.json')
    const initialConfig = await fs.readFile(configPath, 'utf8')
    const config = JSON.parse(initialConfig) as { miniprogramRoot: string, srcMiniprogramRoot: string }
    expect(config.miniprogramRoot).toBe('./')
    expect(config.srcMiniprogramRoot).toBe(config.miniprogramRoot)
    const initialMtime = (await fs.stat(configPath)).mtimeMs
    const wrapperHmrWxml = path.join(wrapperProjectPath!, config.miniprogramRoot, 'pages/hmr/index.wxml')
    await waitForFileContains(wrapperHmrWxml, '<view class="title">HMR</view>', 20_000)
    const page = await miniProgram!.reLaunch('/pages/hmr/index')
    await dom.check('initial', miniProgram!, page)

    await page.callMethod('increment')
    await dom.check('retained:0', miniProgram!, page)
    const diagnostics = createHmrRuntimeDiagnostics(miniProgram!, 'e2e-apps/wevu-runtime-e2e')
    const initial = await diagnostics.initialize()
    expect(initial.errors).toEqual([])
    expect(initial.pageId).toBeTypeOf('number')

    try {
      for (let index = 1; index < TEMPLATE_TITLES.length; index += 1) {
        const title = TEMPLATE_TITLES[index]!
        const updatedWxml = originalWxml.replace('<view class="title">HMR</view>', `<view class="title">${title}</view>`)
        expect(updatedWxml.length).toBe(originalWxml.length)
        await replaceFileByRename(HMR_PAGE_WXML, updatedWxml)
        await dev!.waitFor(
          Promise.all([
            waitForFileContains(HMR_PAGE_WXML_DIST, `<view class="title">${title}</view>`, 30_000),
            waitForFileContains(wrapperHmrWxml, `<view class="title">${title}</view>`, 30_000),
          ]),
          `bridge wrapper hmr update ${index} synced`,
        )
        await dom.check(`retained:${index}`, miniProgram!, (await miniProgram!.currentPage())!)
        const snapshot = await diagnostics.capture(`update:${index}`)
        expect(snapshot.errors).toEqual([])
        expect(snapshot.pageId).toBe(initial.pageId)
        expect(snapshot.runtime).toMatchObject({ pageMarkerRetained: true, appMarkerRetained: true })
        expect(await fs.readFile(configPath, 'utf8')).toBe(initialConfig)
        expect((await fs.stat(configPath)).mtimeMs).toBe(initialMtime)
      }
    }
    finally {
      await diagnostics.capture('finally')
    }
  })
})
