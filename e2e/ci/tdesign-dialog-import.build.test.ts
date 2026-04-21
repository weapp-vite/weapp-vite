import { readFile, rm } from 'node:fs/promises'
import path from 'pathe'
import { beforeAll, describe, expect, it } from 'vitest'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const APP_ROOT = path.resolve(import.meta.dirname, '../../e2e-apps/tdesign-dialog-import')
const DIST_ROOT = path.join(APP_ROOT, 'dist')
const DIST_NPM_ROOT = path.join(DIST_ROOT, 'miniprogram_npm')

async function buildApp() {
  await rm(DIST_ROOT, { recursive: true, force: true })
  await rm(path.join(APP_ROOT, 'miniprogram_npm'), { recursive: true, force: true })
  await runWeappViteBuildWithLogCapture({
    cliPath: CLI_PATH,
    projectRoot: APP_ROOT,
    platform: 'weapp',
    cwd: APP_ROOT,
    label: 'ci:tdesign-dialog-import',
  })
}

async function readDistFile(relativePath: string) {
  return await readFile(path.join(DIST_ROOT, relativePath), 'utf8')
}

async function readDistNpmFile(relativePath: string) {
  return await readFile(path.join(DIST_NPM_ROOT, relativePath), 'utf8')
}

describe.sequential('e2e app: tdesign-dialog-import (build)', () => {
  beforeAll(async () => {
    await buildApp()
  }, 120_000)

  it('keeps bare import and explicit /index import pages callable after build', async () => {
    const barePageJs = await readDistFile('pages/dialog-bare/index.js')
    const barePageJson = await readDistFile('pages/dialog-bare/index.json')
    const barePageWxml = await readDistFile('pages/dialog-bare/index.wxml')
    const indexPageJs = await readDistFile('pages/dialog-index/index.js')
    const indexPageJson = await readDistFile('pages/dialog-index/index.json')
    const indexPageWxml = await readDistFile('pages/dialog-index/index.wxml')
    const dialogIndexJs = await readDistNpmFile('tdesign-miniprogram/dialog/index.js')
    const toastIndexJs = await readDistNpmFile('tdesign-miniprogram/toast/index.js')

    expect(barePageWxml).toContain('tdesign Dialog bare import')
    expect(barePageWxml).toContain('<t-dialog id="t-dialog" />')
    expect(barePageWxml).toContain('<t-toast id="t-toast" />')
    expect(barePageJs).toContain('issue-dialog-bare confirm title')
    expect(barePageJs).toContain('../../miniprogram_npm/tdesign-miniprogram/dialog/index')
    expect(barePageJs).toContain('../../miniprogram_npm/tdesign-miniprogram/toast/index')
    expect(barePageJs).not.toContain('.default.default')
    expect(barePageJs).not.toMatch(/__toESM\([^)]*,\s*1\)/)
    expect(barePageJson).toContain('"t-dialog": "../../miniprogram_npm/tdesign-miniprogram/dialog/dialog"')
    expect(barePageJson).toContain('"t-toast": "../../miniprogram_npm/tdesign-miniprogram/toast/toast"')

    expect(indexPageWxml).toContain('tdesign Dialog /index import')
    expect(indexPageWxml).toContain('<t-dialog id="t-dialog" />')
    expect(indexPageWxml).toContain('<t-toast id="t-toast" />')
    expect(indexPageJs).toContain('issue-dialog-index confirm title')
    expect(indexPageJs).toContain('../../miniprogram_npm/tdesign-miniprogram/dialog/index')
    expect(indexPageJs).toContain('../../miniprogram_npm/tdesign-miniprogram/toast/index')
    expect(indexPageJs).not.toContain('.default.default')
    expect(indexPageJs).not.toMatch(/__toESM\([^)]*,\s*1\)/)
    expect(indexPageJson).toContain('"t-dialog": "../../miniprogram_npm/tdesign-miniprogram/dialog/dialog"')
    expect(indexPageJson).toContain('"t-toast": "../../miniprogram_npm/tdesign-miniprogram/toast/toast"')

    expect(dialogIndexJs).toContain('__esModule')
    expect(dialogIndexJs).toContain('exports["default"]')
    expect(dialogIndexJs).toContain('confirm(t)')

    expect(toastIndexJs).toContain('Toast as default')
    expect(toastIndexJs).toContain('showToast')
    expect(toastIndexJs).toContain('hideToast')
    expect(toastIndexJs).toContain('#t-toast')
  })
})
