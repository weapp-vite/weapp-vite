import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { describe, expect, it } from 'vitest'
import { isIssue779CssContentRequest } from '../../e2e-apps/github-issues/config/issue779CssPre'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const APP_ROOT = path.resolve(import.meta.dirname, '../../e2e-apps/github-issues')
const DIST_ROOT = path.join(APP_ROOT, 'dist-issue-779')

describe('issue #779 CSS pre transform', { concurrent: false }, () => {
  const cssSource = '/src/pages/issue-779/index.css'
  const owner = '/src/pages/issue-779/index.vue'
  const encodedOwner = encodeURIComponent(owner)
  const cssRequest = `\0fixture-style:${encodedOwner}?type=style&index=0&lang.css`

  it.each([
    ['physical CSS', cssSource, true],
    ['owning virtual CSS', cssRequest, true],
    ['owning virtual CSS after HMR', `${cssRequest}&hmr=2`, true],
    ['Windows CSS path', String.raw`C:\src\pages\issue-779\index.css`, true],
    ['raw invalidation dependency', `${cssSource}?raw&weapp-vite-sidecar-owner=${encodedOwner}&weapp-vite-sidecar=style&lang.js`, false],
    ['raw CSS import', `${cssSource}?raw`, false],
    ['URL CSS import', `${cssSource}?url`, false],
    ['JavaScript language request', `${cssSource}?lang.js`, false],
    ['untransformed SFC', owner, false],
    ['script request', `${owner}?type=script&lang.css`, false],
    ['foreign source with matching owner', `/src/pages/other/index.css?weapp-vite-sidecar-owner=${encodedOwner}`, false],
    ['malformed encoded source', '/src/pages/issue-779/bad%file.css', false],
  ] as const)('classifies %s without confusing dependency JS with CSS', (_label, id, expected) => {
    expect(isIssue779CssContentRequest(id)).toBe(expected)
  })

  it('passes the in-memory pre-transformed SFC style into the emitted wxss sidecar', async () => {
    await fs.remove(DIST_ROOT)

    await runWeappViteBuildWithLogCapture({
      cliPath: CLI_PATH,
      projectRoot: APP_ROOT,
      platform: 'weapp',
      cwd: APP_ROOT,
      label: 'ci:issue-779-css-pre',
      skipNpm: true,
      env: {
        WEAPP_GITHUB_ISSUE_779_CSS_PRE: 'true',
      },
    })

    const pageWxss = await fs.readFile(path.join(DIST_ROOT, 'pages/issue-779/index.wxss'), 'utf8')
    expect(pageWxss).toContain('.issue-779-pre-marker')
    expect(pageWxss).toContain('box-sizing: border-box')
    expect(pageWxss).toMatch(/padding:\s*13px/)
    expect(pageWxss).not.toMatch(/@(?:apply|config|custom-variant|layer|plugin|reference|source|tailwind|theme|utility|variant)\b/)
    expect(pageWxss).not.toContain('@import "tailwindcss"')
    expect(pageWxss).not.toContain('.issue-779-disk-marker')
  })
})
