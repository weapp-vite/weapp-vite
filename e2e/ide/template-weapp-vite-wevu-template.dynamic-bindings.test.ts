import fs from 'fs-extra'
import path from 'pathe'
import { describe, expect, it } from 'vitest'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const TEMPLATE_ROOT = path.resolve(import.meta.dirname, '../../templates/weapp-vite-wevu-template')
const DIST_ROOT = path.join(TEMPLATE_ROOT, 'dist')

async function runBuild() {
  await fs.remove(DIST_ROOT)
  await runWeappViteBuildWithLogCapture({
    cliPath: CLI_PATH,
    projectRoot: TEMPLATE_ROOT,
    platform: 'weapp',
    skipNpm: true,
    cwd: TEMPLATE_ROOT,
    label: 'ide:template-wevu-simplified-portal',
  })
}

describe.sequential('template e2e: weapp-vite-wevu-template simplified portal', () => {
  it('emits the simplified portal structure and auto-imported component usage', async () => {
    await runBuild()

    const indexWxmlPath = path.join(DIST_ROOT, 'pages/index/index.wxml')
    const indexJsPath = path.join(DIST_ROOT, 'pages/index/index.js')
    const appJsonPath = path.join(DIST_ROOT, 'app.json')

    expect(await fs.pathExists(indexWxmlPath)).toBe(true)
    expect(await fs.pathExists(indexJsPath)).toBe(true)
    expect(await fs.pathExists(appJsonPath)).toBe(true)

    const indexWxml = await fs.readFile(indexWxmlPath, 'utf8')
    const indexJs = await fs.readFile(indexJsPath, 'utf8')
    const appJson = await fs.readJson(appJsonPath)

    expect(appJson.pages).toEqual([
      'pages/index/index',
      'pages/layouts/index',
      'pages/overview/index',
    ])
    expect(appJson.subPackages).toEqual([
      {
        root: 'packageA',
        pages: ['pages/workspace/index'],
      },
      {
        root: 'packageB',
        pages: ['pages/settings/index'],
      },
    ])

    expect(indexWxml).toContain('企业业务模板')
    expect(indexWxml).toContain('当前路由：{{routeSummary}}')
    expect(indexWxml).toContain('<StatusPill')
    expect(indexWxml).toContain('<InfoPanel')

    expect(indexJs).toContain('/pages/overview/index')
    expect(indexJs).toContain('/packageA/pages/workspace/index')
    expect(indexJs).toContain('/packageB/pages/settings/index')
    expect(indexJs).toContain('进入概览')
    expect(indexJs).toContain('打开工作台')
    expect(indexJs).toContain('前往设置')
    expect(indexJs).toContain('nativeRouter.reLaunch')
  })
})
