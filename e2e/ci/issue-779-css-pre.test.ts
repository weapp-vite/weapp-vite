import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { describe, expect, it } from 'vitest'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const APP_ROOT = path.resolve(import.meta.dirname, '../../e2e-apps/github-issues')
const DIST_ROOT = path.join(APP_ROOT, 'dist-issue-779')

describe('issue #779 CSS pre transform', { concurrent: false }, () => {
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
    expect(pageWxss).not.toContain('@import "tailwindcss"')
    expect(pageWxss).not.toContain('.issue-779-disk-marker')
  })
})
