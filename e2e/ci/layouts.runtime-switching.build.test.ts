import fs from 'fs-extra'
import path from 'pathe'
import { beforeAll, describe, expect, it } from 'vitest'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'
import { runBuild as runWevuRuntimeBuild, CLI_PATH as WEVU_RUNTIME_CLI_PATH, DIST_ROOT as WEVU_RUNTIME_DIST_ROOT } from '../wevu-runtime.utils'

const TEMPLATE_ROOT = path.resolve(import.meta.dirname, '../../templates/weapp-vite-wevu-template')
const TEMPLATE_DIST_ROOT = path.join(TEMPLATE_ROOT, 'dist')

async function buildTemplate(projectRoot: string, label: string) {
  await runWeappViteBuildWithLogCapture({
    cliPath: WEVU_RUNTIME_CLI_PATH,
    projectRoot,
    platform: 'weapp',
    cwd: projectRoot,
    label,
  })
}

async function readDistFile(root: string, relativePath: string) {
  return await fs.readFile(path.join(root, relativePath), 'utf8')
}

describe.sequential('layout runtime switching build integration', () => {
  beforeAll(async () => {
    await buildTemplate(TEMPLATE_ROOT, 'ci:layouts-runtime-switching:template')
    await runWevuRuntimeBuild('weapp')
  }, 120_000)

  it('emits vue layout switching assets for the template playground page', async () => {
    const pageWxml = await readDistFile(TEMPLATE_DIST_ROOT, 'pages/layouts/index.wxml')
    const pageJson = await readDistFile(TEMPLATE_DIST_ROOT, 'pages/layouts/index.json')
    const pageJs = await readDistFile(TEMPLATE_DIST_ROOT, 'pages/layouts/index.js')
    const defaultLayoutJsExists = await fs.pathExists(path.join(TEMPLATE_DIST_ROOT, 'layouts/default.js'))
    const adminLayoutJsExists = await fs.pathExists(path.join(TEMPLATE_DIST_ROOT, 'layouts/admin.js'))

    expect(pageWxml).toContain('weapp-layout-default')
    expect(pageWxml).toContain('weapp-layout-admin')
    expect(pageWxml).toContain(`!__wv_page_layout_name || __wv_page_layout_name === 'default'`)
    expect(pageWxml).toContain(`__wv_page_layout_name === 'admin'`)
    expect(pageWxml).toContain('subtitle="{{(__wv_page_layout_props&&__wv_page_layout_props.subtitle)}}"')

    expect(pageJson).toContain('"weapp-layout-default": "/layouts/default"')
    expect(pageJson).toContain('"weapp-layout-admin": "/layouts/admin"')
    expect(pageJs).toContain('setPageLayout')
    expect(defaultLayoutJsExists).toBe(true)
    expect(adminLayoutJsExists).toBe(true)
  })

  it('emits native layout switching assets for the runtime e2e page', async () => {
    const pageWxml = await readDistFile(WEVU_RUNTIME_DIST_ROOT, 'pages/layouts/index.wxml')
    const pageJson = await readDistFile(WEVU_RUNTIME_DIST_ROOT, 'pages/layouts/index.json')
    const pageJs = await readDistFile(WEVU_RUNTIME_DIST_ROOT, 'pages/layouts/index.js')
    const defaultLayoutJsExists = await fs.pathExists(path.join(WEVU_RUNTIME_DIST_ROOT, 'layouts/default/index.js'))
    const adminLayoutJsExists = await fs.pathExists(path.join(WEVU_RUNTIME_DIST_ROOT, 'layouts/admin/index.js'))

    expect(pageWxml).toContain('weapp-layout-default')
    expect(pageWxml).toContain('weapp-layout-admin')
    expect(pageWxml).toContain(`!__wv_page_layout_name || __wv_page_layout_name === 'default'`)
    expect(pageWxml).toContain(`__wv_page_layout_name === 'admin'`)
    expect(pageWxml).toContain('title="{{(__wv_page_layout_props&&__wv_page_layout_props.title)}}"')

    expect(pageJson).toContain('"weapp-layout-default": "/layouts/default/index"')
    expect(pageJson).toContain('"weapp-layout-admin": "/layouts/admin/index"')
    expect(pageJs).toContain('__wevuSetPageLayout')
    expect(pageJs).toContain('__wv_page_layout_name')
    expect(pageJs).toContain('LAYOUTS-ADMIN-TITLE-BASE')
    expect(defaultLayoutJsExists).toBe(true)
    expect(adminLayoutJsExists).toBe(true)
  })
})
