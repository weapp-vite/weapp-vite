import { ok as assert } from 'node:assert'
import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createDomAcceptance } from '../utils/domAcceptance'
import {
  closeSharedMiniProgram,
  DIST_ROOT,
  getSharedMiniProgram,
  PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT,
  prepareGithubIssuesBuild,
  relaunchPage,
} from './github-issues.runtime.shared'

const ISSUE_941_ROUTE = '/pages/issue-941/index'

describe('e2e app: github-issues / issue #941', { concurrent: false }, () => {
  beforeAll(async () => {
    await prepareGithubIssuesBuild()
    for (const relativePath of [
      'pages/issue-941/index.js',
      'pages/issue-941/index.json',
      'pages/issue-941/index.wxml',
    ]) {
      await expect(fs.pathExists(path.join(DIST_ROOT, relativePath))).resolves.toBe(true)
    }
  }, PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT)

  afterAll(async () => {
    await closeSharedMiniProgram()
  }, 30_000)

  it('keeps every wx direct-return API out of the Promise bridge', async (ctx) => {
    const dom = createDomAcceptance(ctx, 'e2e-apps/github-issues', [{
      id: 'initial',
      route: ISSUE_941_ROUTE,
      action: '检查尚未执行 adapter 的首屏',
      nodes: [
        { selector: '#issue941-title', text: 'issue-941 direct-return adapter' },
        { selector: '#issue941-cache-options', text: 'cache options: pending' },
        { selector: '.issue941-result', count: 0 },
        { selector: '.issue941-void', count: 0 },
      ],
    }, {
      id: 'executed',
      route: ISSUE_941_ROUTE,
      action: '运行 direct-return adapter 并检查每个实际执行结果',
      nodes: [
        ...[
          'checkIsPictureInPictureActive',
          'createBufferURL',
          'createCacheManager',
          'createGlobalPayment',
          'createInferenceSession',
          'createVideoDecoder',
          'getApiCategory',
          'getAppAuthorizeSetting',
          'getAppBaseInfo',
          'getDeviceInfo',
          'getPluginUpdateManager',
          'getSystemSetting',
          'getWindowInfo',
          'isVKSupport',
        ].map(name => ({ selector: `#issue941-${name}`, text: `${name}: identity preserved, promise no` })),
        ...[
          'postMessageToReferrerMiniProgram',
          'postMessageToReferrerPage',
          'reportEvent',
          'reportMonitor',
          'reportPerformance',
          'requestAppleSubscribeSign',
          'revokeBufferURL',
        ].map(name => ({ selector: `#issue941-${name}`, text: `${name}: undefined yes, promise no` })),
        { selector: '.issue941-result', count: 14 },
        { selector: '.issue941-void', count: 7 },
        { selector: '#issue941-cache-options', text: 'cache options: maxSize' },
      ],
    }])
    const miniProgram = await getSharedMiniProgram(ctx)
    const page = await relaunchPage(miniProgram, ISSUE_941_ROUTE, undefined, 45_000, {
      readiness: async (targetPage) => {
        await targetPage.waitForRendered({ selector: '#issue-941-page', timeout: 5_000 })
        return true
      },
    })
    assert(page, 'Expected issue-941 page')
    await dom.check('initial', await getSharedMiniProgram(ctx), page)

    const result = await page.callMethodWithOptions('_runE2E', { timeout: 8_000 })
    expect(result.resultMethods).toHaveLength(14)
    expect(result.resultMethods.every((item: any) => item.sameIdentity && !item.isPromise)).toBe(true)
    expect(result.voidMethods).toHaveLength(7)
    expect(result.voidMethods.every((item: any) => item.isUndefined && !item.isPromise)).toBe(true)
    expect(result.cacheManagerOptions).toEqual(['maxSize'])
    await dom.check('executed', await getSharedMiniProgram(ctx), page)
  })
})
