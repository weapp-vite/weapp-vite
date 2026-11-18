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
import { WEB_API_PLANS } from './githubIssuesDom/webApis'

async function readDistFile(relativePath: string) {
  return await fs.readFile(path.join(DIST_ROOT, relativePath), 'utf8')
}

function expectClassToken(wxml: string, className: string) {
  const marker = `class="${className}`
  const markerIndex = wxml.indexOf(marker)
  expect(markerIndex).toBeGreaterThanOrEqual(0)
  const suffix = wxml.slice(markerIndex + marker.length)
  expect(suffix.startsWith('"') || suffix.startsWith(' ')).toBe(true)
}

function countClassToken(wxml: string, className: string) {
  const marker = `class="${className}`
  let count = 0
  let offset = 0
  while (true) {
    const markerIndex = wxml.indexOf(marker, offset)
    if (markerIndex === -1) {
      return count
    }
    const suffix = wxml.slice(markerIndex + marker.length)
    if (suffix.startsWith('"') || suffix.startsWith(' ')) {
      count += 1
    }
    offset = markerIndex + marker.length
  }
}

describe('github-issues runtime web runtime globals', { concurrent: false }, () => {
  beforeAll(async () => {
    await prepareGithubIssuesBuild()
  }, PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT)

  afterAll(async () => {
    await closeSharedMiniProgram()
  })

  it('issue #1186: decodes malformed URL queries without losing live search params', async (ctx) => {
    const dom = createDomAcceptance(ctx, 'e2e-apps/github-issues', WEB_API_PLANS.issue1186)
    const miniProgram = await getSharedMiniProgram(ctx)
    const page = await relaunchPage(miniProgram, '/pages/issue-1186/index')
    assert(page, 'Expected issue-1186 page')
    await dom.check('initial', miniProgram, page)
    for (const extension of ['wxml', 'json', 'js']) {
      expect(await readDistFile(`pages/issue-1186/index.${extension}`)).not.toBe('')
    }
  })

  it('issue #448: compiles the next batch of web runtime globals for DevTools', async (ctx) => {
    const dom = createDomAcceptance(ctx, 'e2e-apps/github-issues', WEB_API_PLANS.issue448)
    const miniProgram = await getSharedMiniProgram(ctx)
    const page = await relaunchPage(miniProgram, '/pages/issue-448/index')
    assert(page, 'Expected issue-448 page')
    await dom.check('initial', miniProgram, page)
    const pageWxml = await readDistFile('pages/issue-448/index.wxml')
    const pageJs = await readDistFile('pages/issue-448/index.js')

    expectClassToken(pageWxml, 'issue448-page')
    expectClassToken(pageWxml, 'issue448-title')
    expect(countClassToken(pageWxml, 'issue448-line')).toBe(21)
    expect(pageJs).toContain('installWebRuntimeGlobals')
    expect(pageJs).toContain('"fetch"')
    expect(pageJs).toContain('"CustomEvent"')
    expect(pageJs).toContain('btoa("AB")')
    expect(pageJs).toContain('atob(encoded)')
    expect(pageJs).toContain('URL.parse("123", "fake://abc")')
    expect(pageJs).toContain('new URLSearchParams("b=2&a=1&a=0")')
    expect(pageJs).toContain('headers.getSetCookie().length')
    expect(pageJs).toContain('Response.json({ ok: true })')
    expect(pageJs).toContain('Response.error()')
    expect(pageJs).toContain('queueMicrotask')
    expect(pageJs).toContain('_runE2E')
  })

  it('issue #459: compiles directly imported web-apis polyfills for DevTools', async (ctx) => {
    const dom = createDomAcceptance(ctx, 'e2e-apps/github-issues', WEB_API_PLANS.issue459)
    const miniProgram = await getSharedMiniProgram(ctx)
    const page = await relaunchPage(miniProgram, '/pages/issue-459/index')
    assert(page, 'Expected issue-459 page')
    await dom.check('initial', miniProgram, page)
    const pageWxml = await readDistFile('pages/issue-459/index.wxml')
    const pageJs = await readDistFile('pages/issue-459/index.js')

    expectClassToken(pageWxml, 'issue459-page')
    expectClassToken(pageWxml, 'issue459-title')
    expect(countClassToken(pageWxml, 'issue459-line')).toBe(6)
    expect(pageJs).toContain('RequestPolyfill')
    expect(pageJs).toContain('URLPolyfill("/abc", "https://issue-459.invalid")')
    expect(pageJs).toContain('ResponsePolyfill("123")')
    expect(pageJs).toContain('TextDecoderPolyfill')
    expect(pageJs).toContain('TextEncoderPolyfill')
    expect(pageJs).toContain('Object.keys(response).join(",")')
    expect(pageJs).toContain('_runE2E')
  })

  it('issue #804: keeps web runtime platform exports available to custom components', async (ctx) => {
    const dom = createDomAcceptance(ctx, 'e2e-apps/github-issues', WEB_API_PLANS.issue804)
    const miniProgram = await getSharedMiniProgram(ctx)
    const page = await relaunchPage(miniProgram, '/pages/issue-804/index')
    assert(page, 'Expected issue-804 page')
    await dom.check('initial', miniProgram, page)
    const pageWxml = await readDistFile('pages/issue-804/index.wxml')
    const vendorRoot = path.join(DIST_ROOT, 'weapp-vendors')
    const vendorFiles = await fs.readdir(vendorRoot)
    const vendorJs = (await Promise.all(
      vendorFiles
        .filter(file => file.endsWith('.js'))
        .map(file => fs.readFile(path.join(vendorRoot, file), 'utf8')),
    )).join('\n')

    expect(pageWxml).toContain('id="issue804-page"')
    expect(pageWxml).toContain('<pressable')
    expect(vendorJs).toContain('resolveMiniProgramPlatform')
    expect(vendorJs).not.toContain('request-globals-wevu-web-apis-fetch.js')
  })
})
