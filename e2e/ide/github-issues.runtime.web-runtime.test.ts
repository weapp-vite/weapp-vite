import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { beforeAll, describe, expect, it } from 'vitest'
import {
  DIST_ROOT,
  PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT,
  prepareGithubIssuesBuild,
} from './github-issues.runtime.shared'

async function readDistFile(relativePath: string) {
  return await fs.readFile(path.join(DIST_ROOT, relativePath), 'utf8')
}

describe.sequential('github-issues runtime web runtime globals', () => {
  beforeAll(async () => {
    await prepareGithubIssuesBuild()
  }, PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT)

  it('issue #448: compiles the next batch of web runtime globals for DevTools', async () => {
    const pageWxml = await readDistFile('pages/issue-448/index.wxml')
    const pageJs = await readDistFile('pages/issue-448/index.js')

    expect(pageWxml).toContain('class="issue448-page"')
    expect(pageWxml).toContain('class="issue448-title"')
    expect(pageWxml.match(/class="issue448-line"/g)?.length).toBe(18)
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

  it('issue #459: compiles directly imported web-apis polyfills for DevTools', async () => {
    const pageWxml = await readDistFile('pages/issue-459/index.wxml')
    const pageJs = await readDistFile('pages/issue-459/index.js')

    expect(pageWxml).toContain('class="issue459-page"')
    expect(pageWxml).toContain('class="issue459-title"')
    expect(pageWxml.match(/class="issue459-line"/g)?.length).toBe(6)
    expect(pageJs).toContain('RequestPolyfill')
    expect(pageJs).toContain('URLPolyfill("/abc", "https://issue-459.invalid")')
    expect(pageJs).toContain('ResponsePolyfill("123")')
    expect(pageJs).toContain('TextDecoderPolyfill')
    expect(pageJs).toContain('TextEncoderPolyfill')
    expect(pageJs).toContain('Object.keys(response).join(",")')
    expect(pageJs).toContain('_runE2E')
  })
})
