import type { MiniProgram } from '@weapp-vite/miniprogram-automator'
import type { RuntimeErrorCollector } from './runtimeErrors'
import { access, readFile } from 'node:fs/promises'
import path from 'node:path'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { cleanupClassicLeaseProject, leaveCrashedClassicLease, startClassicLeaseDev, stopClassicLeaseDev, stopFailedClassicLeaseDev } from '../utils/classicLeaseRecovery'
import { createDomAcceptance } from '../utils/domAcceptance'
import { createIssueRegressionProject } from '../utils/issueRegressionProject'
import { cleanupTemporaryRuntimeProject } from '../utils/temporaryRuntimeProject'
import { attachRuntimeErrorCollector } from './runtimeErrors'

const FIXTURE = 'e2e-apps/github-issues/fixtures/issue-1278'
const ROUTE = '/pages/index/index'

describe('issue #1278: classic configuration lease recovery', { concurrent: false }, () => {
  let project: string | undefined
  let host: MiniProgram | undefined
  let dev: ReturnType<typeof startClassicLeaseDev> | undefined
  let errors: RuntimeErrorCollector | undefined
  let devReady = false
  let setupError: unknown

  beforeAll(async () => {
    try {
      project = await createIssueRegressionProject(1278)
      const crashed = await leaveCrashedClassicLease(project)
      dev = startClassicLeaseDev(project)
      await dev.waitForInitialBuild()
      devReady = true
      const saved = JSON.parse(await readFile(path.join(project, '.weapp-vite/ide-classic-project.private.config.json'), 'utf8')) as { owner: string }
      expect(saved.owner).not.toBe(crashed.owner)
      const app = JSON.parse(await readFile(path.join(project, 'dist/app.json'), 'utf8')) as { pages: string[] }
      expect(app.pages).toEqual([ROUTE.slice(1)])
      for (const extension of ['js', 'json', 'wxml']) {
        await access(path.join(project, `dist/pages/index/index.${extension}`))
      }
      host = await launchAutomator({
        projectPath: project,
        trustProject: true,
        bridgeProjectMode: 'direct',
        warmupRoute: ROUTE,
        warmupRootSelectors: ['#issue1278-page'],
      })
      errors = attachRuntimeErrorCollector(host)
    }
    catch (error) {
      setupError = error
      throw error
    }
  }, 240_000)

  afterEach(() => {
    expect(errors?.getAll()).toEqual([])
  })

  afterAll(async () => {
    await cleanupClassicLeaseProject(project, () => cleanupTemporaryRuntimeProject({
      disposeTransport: () => errors?.dispose(),
      closeSession: () => host?.close(),
      stopDev: async () => {
        if (dev) {
          if (devReady) {
            await stopClassicLeaseDev(dev)
          }
          else {
            await stopFailedClassicLeaseDev(dev)
          }
        }
        if (project && devReady) {
          const restored = JSON.parse(await readFile(path.join(project, 'project.private.config.json'), 'utf8')) as { setting: { compileHotReLoad: boolean } }
          expect(restored.setting.compileHotReLoad).toBe(true)
          await expect(access(path.join(project, '.weapp-vite/ide-classic-project.private.config.json'))).rejects.toMatchObject({ code: 'ENOENT' })
        }
      },
    }), setupError)
  }, 120_000)

  it('renders and updates the recovered CLI output, then reopens with a fresh page state', async (context) => {
    const dom = createDomAcceptance(context, FIXTURE, [
      { id: 'recovered', route: ROUTE, action: '僵尸租约恢复后首次载入真实 CLI 产物', nodes: [{ selector: '#lease-status', text: 'issue1278-ready' }, { selector: '#lease-count', text: '0' }] },
      { id: 'updated', route: ROUTE, action: '恢复后的页面正常执行原生事件更新', nodes: [{ selector: '#lease-status', text: 'issue1278-ready' }, { selector: '#lease-count', text: '1' }] },
      { id: 'reopened', route: ROUTE, action: '复用同一宿主重新进入页面，初始状态独立恢复', nodes: [{ selector: '#lease-status', text: 'issue1278-ready' }, { selector: '#lease-count', text: '0' }] },
    ])
    const page = await host!.reLaunch(ROUTE)
    await dom.check('recovered', host!, page)
    const increment = await page.$('#lease-increment')
    expect(increment).toBeTruthy()
    await increment!.tap()
    await dom.check('updated', host!, page)
    await dom.check('reopened', host!, await host!.reLaunch(ROUTE))
    expect(dev!.getBuildErrors()).toEqual([])
  })
})
