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
  releaseSharedMiniProgram,
} from './github-issues.runtime.shared'

describe('e2e app: github-issues / user subpackage', { concurrent: false }, () => {
  beforeAll(async () => {
    await prepareGithubIssuesBuild()
  }, PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT)

  afterAll(async () => {
    await closeSharedMiniProgram()
  }, 30_000)

  it('issue #317: loads duplicated shared chunks with localized runtime', async (ctx) => {
    const dom = createDomAcceptance(ctx, 'e2e-apps/github-issues', [{
      id: 'initial',
      route: '/subpackages/user/index',
      action: '检查 user 分包的共享 runtime 实例和 npm 模块结果',
      nodes: [
        { selector: '.issue317-message', text: 'USER:ready:instance' },
        { selector: '.issue317-npm-marker', text: 'Issue317 user npm ready' },
      ],
    }])
    const sharedPath = path.join(DIST_ROOT, 'subpackages/user/weapp-shared/common.js')
    expect(await fs.pathExists(sharedPath)).toBe(true)

    const miniProgram = await getSharedMiniProgram(ctx)
    try {
      const page = await relaunchPage(miniProgram, '/subpackages/user/index', undefined, 45_000, {
        readiness: 'route',
      })
      expect(page).toBeTruthy()
      await dom.check('initial', await getSharedMiniProgram(ctx), page)
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })

  it('issue #340: loads cross-subpackage source imports in user/register/form', async (ctx) => {
    const dom = createDomAcceptance(ctx, 'e2e-apps/github-issues', [{
      id: 'initial',
      route: '/subpackages/user/register/form',
      action: '检查 user 页面跨分包导入的实际执行结果',
      nodes: [
        { selector: '.issue340-message', text: 'user-register-form:issue-340:shared' },
      ],
    }])
    const pageJsPath = path.join(DIST_ROOT, 'subpackages/user/register/form.js')
    const pageJs = await fs.readFile(pageJsPath, 'utf-8')
    expect(pageJs).toContain('user-register-form:issue-340:shared')
    const miniProgram = await getSharedMiniProgram(ctx)
    const page = await relaunchPage(miniProgram, '/subpackages/user/register/form', undefined, 45_000, { readiness: 'route' })
    await dom.check('initial', await getSharedMiniProgram(ctx), page)
  })
})
