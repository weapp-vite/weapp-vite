import { access, readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'
import { findMissingWevuVendorExports } from '../utils/wevu-vendor'

const ROOT = path.resolve(import.meta.dirname, '../..')
const APP_ROOT = path.join(ROOT, 'e2e-apps/github-issues')
const DIST = path.join(APP_ROOT, 'dist')
const PAGES = ['pages/issue-1035/index', 'pages/issue-1035-next/index']

describe('issue #1035 three-platform router fixture outputs', { concurrent: false }, () => {
  it.each([
    ['weapp', 'wxml'],
    ['alipay', 'axml'],
    ['tt', 'ttml'],
  ] as const)('builds a complete cold-start application for %s', async (platform, templateExtension) => {
    await runWeappViteBuildWithLogCapture({
      cliPath: path.join(ROOT, 'packages/weapp-vite/bin/weapp-vite.js'),
      projectRoot: APP_ROOT,
      platform,
      env: { WEAPP_VITE_E2E_TARGET_FILE: 'ide/github-issues.runtime.issue1035.test.ts' },
    })
    const app = JSON.parse(await readFile(path.join(DIST, 'app.json'), 'utf8')) as { pages: string[] }
    expect(app.pages).toEqual(PAGES)
    for (const page of PAGES) {
      for (const extension of ['js', 'json', templateExtension]) {
        await expect(access(path.join(DIST, `${page}.${extension}`))).resolves.toBeUndefined()
      }
    }
    const files = await readdir(DIST, { recursive: true })
    for (const file of files.filter(file => file.endsWith('.js'))) {
      const source = await readFile(path.join(DIST, file), 'utf8')
      for (const [, request] of source.matchAll(/\brequire\(\s*["'](\.[^"']+)["']\s*\)/g)) {
        const target = path.resolve(DIST, path.dirname(file), request!)
        await expect(access(path.extname(target) ? target : `${target}.js`)).resolves.toBeUndefined()
      }
    }
    if (platform === 'tt') {
      expect(await findMissingWevuVendorExports(DIST), 'TT vendor imports must resolve to exported members').toEqual([])
    }
  }, 120_000)
})
