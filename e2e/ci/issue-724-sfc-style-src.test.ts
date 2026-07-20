import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { describe, expect, it } from 'vitest'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const APP_ROOT = path.resolve(import.meta.dirname, '../../e2e-apps/issue-724-sfc-style-src')
const DIST_ROOT = path.join(APP_ROOT, 'dist')

describe.sequential('issue #724 user reproduction repository', () => {
  it('builds an SFC whose style src is a bare package specifier', async () => {
    await fs.remove(DIST_ROOT)

    await runWeappViteBuildWithLogCapture({
      cliPath: CLI_PATH,
      projectRoot: APP_ROOT,
      platform: 'weapp',
      cwd: APP_ROOT,
      label: 'ci:issue-724-sfc-style-src',
      skipNpm: true,
    })

    const pageBase = path.join(DIST_ROOT, 'pages/index/index')
    const pageJs = await fs.readFile(`${pageBase}.js`, 'utf8')
    const pageWxml = await fs.readFile(`${pageBase}.wxml`, 'utf8')
    const pageWxss = await fs.readFile(`${pageBase}.wxss`, 'utf8')

    expect(pageJs).not.toContain('</script>')
    expect(pageWxml).toContain('<slot />')
    expect(pageWxss).toContain('.van-space')
    expect(pageWxss).not.toMatch(/<(?:template|script|style)(?:\s|>)/)
  })
})
