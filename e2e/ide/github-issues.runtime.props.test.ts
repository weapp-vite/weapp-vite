import fs from 'fs-extra'
import path from 'pathe'
import { afterAll, describe, expect, it } from 'vitest'
import {
  closeSharedMiniProgram,
  DIST_ROOT,
  expectPropsProbeCase,
  getSharedMiniProgram,
  readClassName,
  readPageWxml,
  relaunchPage,
  releaseSharedMiniProgram,
  tapElement,
} from './github-issues.runtime.shared'

describe.sequential('e2e app: github-issues / props', () => {
  afterAll(async () => {
    await closeSharedMiniProgram()
  })

  it('issue #317: loads duplicated shared chunks with localized runtime inside subpackages', async (ctx) => {
    const itemSharedPath = path.join(DIST_ROOT, 'subpackages/item/weapp-shared/common.js')
    const userSharedPath = path.join(DIST_ROOT, 'subpackages/user/weapp-shared/common.js')
    expect(await fs.pathExists(itemSharedPath)).toBe(true)
    expect(await fs.pathExists(userSharedPath)).toBe(true)

    const miniProgram = await getSharedMiniProgram(ctx)
    try {
      const itemPage = await relaunchPage(miniProgram, '/subpackages/item/index')
      const userPage = await relaunchPage(miniProgram, '/subpackages/user/index')
      expect(itemPage).toBeTruthy()
      expect(userPage).toBeTruthy()
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })

  it('issue #340: loads cross-subpackage source imports in item/login-required and user/register/form', async (ctx) => {
    const itemPageJsPath = path.join(DIST_ROOT, 'subpackages/item/login-required/index.js')
    const userPageJsPath = path.join(DIST_ROOT, 'subpackages/user/register/form.js')
    const itemPageJs = await fs.readFile(itemPageJsPath, 'utf-8')
    const userPageJs = await fs.readFile(userPageJsPath, 'utf-8')
    expect(itemPageJs).toContain('item-login-required:issue-340:shared')
    expect(userPageJs).toContain('user-register-form:issue-340:shared')

    const miniProgram = await getSharedMiniProgram(ctx)
    try {
      const itemPage = await relaunchPage(miniProgram, '/subpackages/item/login-required/index')
      const userPage = await relaunchPage(miniProgram, '/subpackages/user/register/form')
      expect(itemPage).toBeTruthy()
      expect(userPage).toBeTruthy()
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })

  it('issue #322: keeps static class and hidden v-show state on first render before errors object exists', async (ctx) => {
    const issuePageWxmlPath = path.join(DIST_ROOT, 'pages/issue-322/index.wxml')
    const issuePageJsPath = path.join(DIST_ROOT, 'pages/issue-322/index.js')
    const issuePageWxml = await fs.readFile(issuePageWxmlPath, 'utf-8')
    const issuePageJs = await fs.readFile(issuePageJsPath, 'utf-8')
    expect(issuePageWxml).toContain('issue-322 class/v-show first paint flicker')
    expect(issuePageJs).toContain('issue322-input')

    const miniProgram = await getSharedMiniProgram(ctx)
    try {
      const issuePage = await relaunchPage(miniProgram, '/pages/issue-322/index', 'state: none')
      if (!issuePage) {
        throw new Error('Failed to launch issue-322 page')
      }
      await tapElement(issuePage, '.issue322-btn-set')
      await issuePage.waitFor(260)
      expect(await readClassName(issuePage, '.issue322-input')).toContain('issue322-input-error')
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })

  it('issue #300: renders destructured boolean props in runtime call-expression bindings', async (ctx) => {
    const issuePageWxmlPath = path.join(DIST_ROOT, 'pages/issue-300/index.wxml')
    const issuePageJsPath = path.join(DIST_ROOT, 'pages/issue-300/index.js')
    const probeWxmlPath = path.join(DIST_ROOT, 'components/issue-300/PropsDestructureProbe/index.wxml')
    const probeJsPath = path.join(DIST_ROOT, 'components/issue-300/PropsDestructureProbe/index.js')
    const strictProbeWxmlPath = path.join(DIST_ROOT, 'components/issue-300/StrictNoPropsVarProbe/index.wxml')
    const strictProbeJsPath = path.join(DIST_ROOT, 'components/issue-300/StrictNoPropsVarProbe/index.js')

    expect(await fs.readFile(issuePageWxmlPath, 'utf-8')).toContain('issue-300 props destructure boolean binding')
    expect(await fs.readFile(issuePageJsPath, 'utf-8')).toContain('_runE2E')
    expect(await fs.readFile(probeWxmlPath, 'utf-8')).toContain('{{__wv_bind_0}}')
    expect(await fs.readFile(probeJsPath, 'utf-8')).toContain('__wevuProps.bool')
    expect(await fs.readFile(strictProbeWxmlPath, 'utf-8')).toContain('{{__wv_bind_0}}')
    expect(await fs.readFile(strictProbeJsPath, 'utf-8')).toContain('__wevuProps.bool')

    const miniProgram = await getSharedMiniProgram(ctx)
    try {
      const issuePage = await relaunchPage(miniProgram, '/pages/issue-300/index', 'toggle bool: true')
      if (!issuePage) {
        throw new Error('Failed to launch issue-300 page')
      }
      const initialRenderedWxml = await readPageWxml(issuePage)
      expectPropsProbeCase(initialRenderedWxml, { caseId: 'primitive', boolText: 'true', strText: 'Hello' })
      await tapElement(issuePage, '.issue300-toggle-bool')
      const toggledBoolWxml = await readPageWxml(issuePage)
      expectPropsProbeCase(toggledBoolWxml, { caseId: 'primitive', boolText: 'false', strText: 'Hello' })
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })

  it('issue #328: keeps setup ref string props out of null/default fallback on first paint', async (ctx) => {
    const issuePageWxmlPath = path.join(DIST_ROOT, 'pages/issue-328/index.wxml')
    const issuePageJsPath = path.join(DIST_ROOT, 'pages/issue-328/index.js')
    expect(await fs.readFile(issuePageWxmlPath, 'utf-8')).toContain('issue-328 setup ref prop first paint')
    expect(await fs.readFile(issuePageJsPath, 'utf-8')).toContain('_runE2E')

    const miniProgram = await getSharedMiniProgram(ctx)
    try {
      const issuePage = await relaunchPage(miniProgram, '/pages/issue-328/index', 'toggle value: 111')
      if (!issuePage) {
        throw new Error('Failed to launch issue-328 page')
      }
      const initialRenderedWxml = await readPageWxml(issuePage)
      expect(initialRenderedWxml).toMatch(/data-current-value="111"/)
      await tapElement(issuePage, '.issue328-toggle')
      const toggledWxml = await readPageWxml(issuePage)
      expect(toggledWxml).toContain('toggle value: 222')
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })
})
