import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  closeSharedMiniProgram,
  DIST_ROOT,
  expectPropsProbeCase,
  getSharedMiniProgram,
  PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT,
  prepareGithubIssuesBuild,
  readClassName,
  readPageWxml,
  relaunchPage,
  releaseSharedMiniProgram,
  tapElement,
} from './github-issues.runtime.shared'
import { attachRuntimeErrorCollector } from './runtimeErrors'

describe.sequential('e2e app: github-issues / props', () => {
  beforeAll(async () => {
    await prepareGithubIssuesBuild()
  }, PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT)

  afterAll(async () => {
    await closeSharedMiniProgram()
  })

  async function expectLaunchableRoute(ctx: any, route: string, readyText?: string) {
    const miniProgram = await getSharedMiniProgram(ctx)
    const page = await relaunchPage(miniProgram, route, readyText)
    expect(page).toBeTruthy()
    await releaseSharedMiniProgram(miniProgram)
  }

  it('issue #317: loads duplicated shared chunks with localized runtime inside item subpackage', async (ctx) => {
    const itemSharedPath = path.join(DIST_ROOT, 'subpackages/item/weapp-shared/common.js')
    expect(await fs.pathExists(itemSharedPath)).toBe(true)
    await expectLaunchableRoute(ctx, '/subpackages/item/index')
  })

  it('issue #317: loads duplicated shared chunks with localized runtime inside user subpackage', async (ctx) => {
    const userSharedPath = path.join(DIST_ROOT, 'subpackages/user/weapp-shared/common.js')
    expect(await fs.pathExists(userSharedPath)).toBe(true)
    await expectLaunchableRoute(ctx, '/subpackages/user/index')
  })

  it('issue #340: loads cross-subpackage source imports in item/login-required', async (ctx) => {
    const itemPageJsPath = path.join(DIST_ROOT, 'subpackages/item/login-required/index.js')
    const itemPageJs = await fs.readFile(itemPageJsPath, 'utf-8')
    expect(itemPageJs).toContain('item-login-required:issue-340:shared')
    await expectLaunchableRoute(ctx, '/subpackages/item/login-required/index')
  })

  it('issue #340: loads cross-subpackage source imports in user/register/form', async (ctx) => {
    const userPageJsPath = path.join(DIST_ROOT, 'subpackages/user/register/form.js')
    const userPageJs = await fs.readFile(userPageJsPath, 'utf-8')
    expect(userPageJs).toContain('user-register-form:issue-340:shared')
    await expectLaunchableRoute(ctx, '/subpackages/user/register/form')
  })

  it('issue #322: keeps static class and hidden v-show state on first render before errors object exists', async (ctx) => {
    const issuePageWxmlPath = path.join(DIST_ROOT, 'pages/issue-322/index.wxml')
    const issuePageJsPath = path.join(DIST_ROOT, 'pages/issue-322/index.js')
    const issuePageWxml = await fs.readFile(issuePageWxmlPath, 'utf-8')
    const issuePageJs = await fs.readFile(issuePageJsPath, 'utf-8')
    expect(issuePageWxml).toContain('issue-322 class/v-show first paint flicker')
    expect(issuePageJs).toContain('issue322-input')

    const miniProgram = await getSharedMiniProgram(ctx)
    const runtimeErrors = attachRuntimeErrorCollector(miniProgram)
    try {
      const marker = runtimeErrors.mark()
      const issuePage = await relaunchPage(miniProgram, '/pages/issue-322/index', 'state: none')
      if (!issuePage) {
        throw new Error('Failed to launch issue-322 page')
      }
      expect(runtimeErrors.getSince(marker)).toEqual([])
      await tapElement(issuePage, '.issue322-btn-set')
      await issuePage.waitFor(260)
      expect(runtimeErrors.getSince(marker)).toEqual([])
      expect(await readClassName(issuePage, '.issue322-input')).toContain('issue322-input-error')
    }
    finally {
      runtimeErrors.dispose()
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
    expect(await fs.readFile(probeJsPath, 'utf-8')).toContain('__wevuPropsDerivedKeys')
    expect(await fs.readFile(probeJsPath, 'utf-8')).toContain('"bool"')
    expect(await fs.readFile(strictProbeWxmlPath, 'utf-8')).toContain('{{__wv_bind_0}}')
    expect(await fs.readFile(strictProbeJsPath, 'utf-8')).toContain('__wevuPropsDerivedKeys')
    expect(await fs.readFile(strictProbeJsPath, 'utf-8')).toContain('"bool"')

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

  it('issue #597: keeps v-if and v-else named slot branches intact in DevTools runtime', async (ctx) => {
    const issuePageWxmlPath = path.join(DIST_ROOT, 'pages/issue-597/index.wxml')
    const issuePageJsPath = path.join(DIST_ROOT, 'pages/issue-597/index.js')
    const issuePageWxml = await fs.readFile(issuePageWxmlPath, 'utf-8')
    expect(issuePageWxml).toContain('<block wx:if="{{abc}}"><view slot="header"')
    expect(issuePageWxml).toContain('<block wx:else><text slot="header"')
    expect(issuePageWxml).not.toContain('</block><text slot="header"')
    expect(await fs.readFile(issuePageJsPath, 'utf-8')).toContain('_runE2E')

    const miniProgram = await getSharedMiniProgram(ctx)
    try {
      const issuePage = await relaunchPage(miniProgram, '/pages/issue-597/index', 'issue-597 conditional named slot')
      if (!issuePage) {
        throw new Error('Failed to launch issue-597 page')
      }
      const renderedWxml = await readPageWxml(issuePage)
      expect(renderedWxml).toContain('data-issue597-branch="if"')
      expect(renderedWxml).not.toContain('data-issue597-branch="else"')
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })

  it('issue #613: compares forwarded slot outlets with view and native block wrappers in DevTools runtime', async (ctx) => {
    const pageWxmlPath = path.join(DIST_ROOT, 'pages/issue-613/index.wxml')
    const viewForwarderWxmlPath = path.join(DIST_ROOT, 'components/issue-613/Issue613ViewForwarder/index.wxml')
    const viewForwarderJsonPath = path.join(DIST_ROOT, 'components/issue-613/Issue613ViewForwarder/index.json')
    const wrapperJsPath = path.join(DIST_ROOT, 'components/issue-613/Issue613ViewForwarder/index.__weapp_vite_slot_wrapper.js')
    const legacyForwarderWxmlPath = path.join(DIST_ROOT, 'components/issue-613/Issue613LegacyViewForwarder/index.wxml')
    const blockForwarderWxmlPath = path.join(DIST_ROOT, 'components/issue-613/block-forwarder/index.wxml')
    const pageJsPath = path.join(DIST_ROOT, 'pages/issue-613/index.js')

    const pageWxml = await fs.readFile(pageWxmlPath, 'utf-8')
    const viewForwarderWxml = await fs.readFile(viewForwarderWxmlPath, 'utf-8')
    const viewForwarderJson = await fs.readJSON(viewForwarderJsonPath) as { usingComponents?: Record<string, string> }
    const wrapperJs = await fs.readFile(wrapperJsPath, 'utf-8')
    const legacyForwarderWxml = await fs.readFile(legacyForwarderWxmlPath, 'utf-8')
    const blockForwarderWxml = await fs.readFile(blockForwarderWxmlPath, 'utf-8')
    expect(pageWxml).toContain('data-issue613-case="compiled-virtual-host"')
    expect(pageWxml).toContain('data-issue613-case="compiled-view"')
    expect(pageWxml).toContain('data-issue613-case="native-block"')
    expect(viewForwarderWxml).toContain('<weapp-slot-wrapper slot="header"><slot /></weapp-slot-wrapper>')
    expect(viewForwarderWxml).toContain('<weapp-slot-wrapper slot="footer"><slot name="footer" /></weapp-slot-wrapper>')
    expect(viewForwarderJson.usingComponents?.['weapp-slot-wrapper']).toBe('/components/issue-613/Issue613ViewForwarder/index.__weapp_vite_slot_wrapper')
    expect(wrapperJs).toContain('virtualHost:true')
    expect(legacyForwarderWxml).toContain('<view slot="header"><slot /></view>')
    expect(viewForwarderWxml).not.toContain('slot-wrapper=')
    expect(viewForwarderWxml).not.toContain('<slot slot="header"')
    expect(viewForwarderWxml).not.toContain('<scoped-slots-default')
    expect(blockForwarderWxml).toContain('<block slot="header">')
    expect(blockForwarderWxml).toContain('<slot></slot>')
    expect(await fs.readFile(pageJsPath, 'utf-8')).toContain('_runE2E')

    const miniProgram = await getSharedMiniProgram(ctx)
    try {
      const issuePage = await relaunchPage(miniProgram, '/pages/issue-613/index', 'issue-613 forwarded via compiled virtual host')
      if (!issuePage) {
        throw new Error('Failed to launch issue-613 page')
      }
      const renderedWxml = await readPageWxml(issuePage)
      expect(renderedWxml).toContain('data-issue613-host="vue-card-header"')
      expect(renderedWxml).toContain('data-issue613-forwarded="compiled-virtual-host"')
      expect(renderedWxml).toContain('issue-613 forwarded via compiled virtual host')
      expect(renderedWxml).toContain('data-issue613-forwarded="compiled-view"')
      expect(renderedWxml).toContain('issue-613 forwarded via compiled view')
      expect(renderedWxml).toContain('data-issue613-host="vue-card-footer"')
      expect(renderedWxml).toContain('data-issue613-forwarded="compiled-footer"')
      expect(renderedWxml).toContain('issue-613 forwarded via compiled footer')
      expect(renderedWxml).toContain('data-issue613-host="native-card-header"')
      expect(renderedWxml).not.toContain('data-issue613-forwarded="native-block"')
      expect(renderedWxml).not.toContain('issue-613 forwarded via native block')
      expect(renderedWxml).not.toContain('slot="header"')
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })

  it('issue #599: renders props named data in computed style bindings', async (ctx) => {
    const componentWxmlPath = path.join(DIST_ROOT, 'components/issue-599/DataPropProbe/index.wxml')
    const componentJsPath = path.join(DIST_ROOT, 'components/issue-599/DataPropProbe/index.js')
    expect(await fs.readFile(componentWxmlPath, 'utf-8')).toMatch(/style="\{\{__wv_style_\d+\}\}"/)
    const componentJs = await fs.readFile(componentJsPath, 'utf-8')
    expect(componentJs).toContain('__wevuPropsDerivedKeys')
    expect(componentJs).toContain('"data"')

    const miniProgram = await getSharedMiniProgram(ctx)
    try {
      const issuePage = await relaunchPage(miniProgram, '/pages/issue-599/index', 'issue-599 data prop computed')
      if (!issuePage) {
        throw new Error('Failed to launch issue-599 page')
      }
      const renderedWxml = await readPageWxml(issuePage)
      expect(renderedWxml).toContain('data-issue599-label="issue-599 data prop computed"')
      expect(renderedWxml).toContain('data-issue599-color="#1677ff"')
      expect(renderedWxml).not.toContain('undefinedrpx')
      expect(renderedWxml).toMatch(/font-size:\s*(?:32rpx|\d+(?:\.\d+)?px)/)
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })

  it('issue #600: renders renamed defineProps destructure aliases in template and computed bindings', async (ctx) => {
    const issuePageWxmlPath = path.join(DIST_ROOT, 'pages/issue-600/index.wxml')
    const issuePageJsPath = path.join(DIST_ROOT, 'pages/issue-600/index.js')
    const issuePageWxml = await fs.readFile(issuePageWxmlPath, 'utf-8')
    const issuePageJs = await fs.readFile(issuePageJsPath, 'utf-8')
    expect(issuePageWxml).toContain('data-issue600-value="{{y}}"')
    expect(issuePageWxml).toContain('data-issue600-summary="{{summary}}"')
    expect(issuePageWxml).toContain('data-issue600-setup-value="{{setupValue}}"')
    expect(issuePageWxml).toContain('guard-if')
    expect(issuePageWxml).toContain('guard-else')
    expect(issuePageJs).toContain('__wevuPropsAliases')
    expect(issuePageJs).toContain('y: "x"')
    expect(issuePageJs).toContain('__wevuPropsDerivedKeys')
    expect(issuePageJs).not.toContain('y: "y"')

    const miniProgram = await getSharedMiniProgram(ctx)
    try {
      const aliasPage = await relaunchPage(miniProgram, '/pages/issue-600/index?x=issue-600-alias', 'issue-600-alias')
      if (!aliasPage) {
        throw new Error('Failed to launch issue-600 alias page')
      }
      const aliasRenderedWxml = await readPageWxml(aliasPage)
      expect(aliasRenderedWxml).toContain('data-issue600-value="issue-600-alias"')
      expect(aliasRenderedWxml).toContain('data-issue600-summary="issue-600-alias|issue-600-setup|alias-ready|setup-ready"')
      expect(aliasRenderedWxml).toContain('issue-600-alias')
      expect(aliasRenderedWxml).toContain('issue-600-setup')
      expect(aliasRenderedWxml).toContain('guard-if')
      expect(aliasRenderedWxml).not.toContain('guard-else')
      expect(await aliasPage.callMethod('_runE2E')).toMatchObject({
        ok: true,
        setupValue: 'issue-600-setup',
        y: 'issue-600-alias',
        aliasTone: 'alias-ready',
        setupTone: 'setup-ready',
        summary: 'issue-600-alias|issue-600-setup|alias-ready|setup-ready',
      })

      const defaultPage = await relaunchPage(miniProgram, '/pages/issue-600/index', 'issue-600-default')
      if (!defaultPage) {
        throw new Error('Failed to launch issue-600 default page')
      }
      const defaultRenderedWxml = await readPageWxml(defaultPage)
      expect(defaultRenderedWxml).toContain('data-issue600-value="issue-600-default"')
      expect(defaultRenderedWxml).toContain('data-issue600-summary="issue-600-default|issue-600-setup|alias-fallback|setup-ready"')
      expect(defaultRenderedWxml).toContain('issue-600-default')
      expect(defaultRenderedWxml).toContain('issue-600-setup')
      expect(defaultRenderedWxml).toContain('guard-else')
      expect(defaultRenderedWxml).not.toContain('guard-if')
      expect(await defaultPage.callMethod('_runE2E')).toMatchObject({
        ok: true,
        setupValue: 'issue-600-setup',
        y: 'issue-600-default',
        aliasTone: 'alias-fallback',
        setupTone: 'setup-ready',
        summary: 'issue-600-default|issue-600-setup|alias-fallback|setup-ready',
      })
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })
})
