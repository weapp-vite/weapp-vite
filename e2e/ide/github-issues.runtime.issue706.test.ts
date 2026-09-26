import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createDomAcceptance } from '../utils/domAcceptance'
import { resolveRuntimeProviderName } from '../utils/runtimeProvider'
import {
  closeSharedMiniProgram,
  getSharedMiniProgram,
  PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT,
  prepareGithubIssuesBuild,
  relaunchPage,
  releaseSharedMiniProgram,
} from './github-issues.runtime.shared'

describe('e2e app: github-issues / issue #706', { concurrent: false }, () => {
  beforeAll(async () => {
    await prepareGithubIssuesBuild()
  }, PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT)

  afterAll(async () => {
    await closeSharedMiniProgram()
  })

  it('uses the app-service Page protocol when the DevTools page-frame channel is unavailable', async (ctx) => {
    const provider = resolveRuntimeProviderName()
    const dom = createDomAcceptance(ctx, 'e2e-apps/github-issues', ['ready', 'updated', 'method'].map(status => ({
      id: status,
      route: '/pages/issue-706/index',
      action: status === 'ready' ? '检查首屏 RPC 提示和状态' : `通过 ${status === 'updated' ? 'setData' : 'page method'} 更新并检查可见状态`,
      nodes: [
        { selector: '.hello', text: 'issue-706 automator page rpc ready', attributes: { 'data-issue706-status': 'ready' }, ...(provider === 'devtools' ? { visible: true } : {}) },
        { selector: '.issue706-status', text: status },
      ],
    })))
    const miniProgram = await getSharedMiniProgram(ctx)
    try {
      const issuePage = await relaunchPage(
        miniProgram,
        '/pages/issue-706/index',
        'issue-706 automator page rpc ready',
        30_000,
        {
          readiness: async (page: any) => {
            const runtime = await page.callMethodWithOptions('_runE2E', {
              timeout: 5_000,
            }).catch(() => undefined)
            return runtime?.ok === true
          },
        },
      )
      if (!issuePage) {
        throw new Error('Failed to launch issue-706 page')
      }

      await issuePage.waitForRendered({
        selector: '.hello',
        timeout: 10_000,
      })
      const activeMiniProgram = await getSharedMiniProgram(ctx)
      await dom.check('ready', activeMiniProgram, issuePage)

      const startedAt = Date.now()
      const helloElements = await issuePage.$$('.hello', { timeout: 5_000 })
      const hello = await issuePage.$('.hello', { timeout: 5_000 })
      // 布局与 Page 协议延迟由真实 IDE 验收，headless 只验收可复用的渲染和 RPC 语义。
      if (provider === 'devtools') {
        const helloOffset = await hello?.offset()
        const helloSize = await hello?.size()
        const helloDisplay = await hello?.style('display')
        expect(helloOffset).toEqual(expect.objectContaining({
          height: expect.any(Number),
          left: expect.any(Number),
          top: expect.any(Number),
          width: expect.any(Number),
        }))
        expect(helloSize).toEqual({ height: helloOffset?.height, width: helloOffset?.width })
        expect(helloDisplay).toEqual(expect.any(String))
      }
      const status = await issuePage.data('probeStatus', { timeout: 5_000 })
      await issuePage.setData({ probeStatus: 'updated' })
      const updatedStatus = await issuePage.data('probeStatus', { timeout: 5_000 })
      const acceptanceStartedAt = Date.now()
      await dom.check('updated', activeMiniProgram, issuePage)
      const acceptanceDuration = Date.now() - acceptanceStartedAt
      const runtime = await issuePage.callMethodWithOptions('_setProbeStatus', { timeout: 5_000 }, 'method')

      expect(helloElements.length).toBeGreaterThan(0)
      expect(hello).not.toBeNull()
      expect(status).toBe('ready')
      expect(updatedStatus).toBe('updated')
      expect(runtime).toMatchObject({ ok: false, status: 'method' })
      expect(Date.now() - startedAt - acceptanceDuration).toBeLessThan(2_000)
      await dom.check('method', activeMiniProgram, issuePage)
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })
})
