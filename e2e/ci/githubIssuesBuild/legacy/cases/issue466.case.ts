import type { Page as PageJson } from '@weapp-core/schematics'
import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { expect, it } from 'vitest'
import { runBuild } from '../build/standard'
import { DIST_ROOT } from '../constants'
import { stripGeneratedScopeAttrs } from '../helpers'

export const group = 'standard'
export const order = 58

export function registerGithubIssuesBuildCase() {
  it('issue #466: keeps all tdesign Dialog methods callable in github-issues app output', async () => {
    await runBuild()

    const pageJsPath = path.join(DIST_ROOT, 'subpackages/issue-466/index.js')
    const nativePageJsPath = path.join(DIST_ROOT, 'subpackages/issue-466/native/index.js')
    const pageWxmlPath = path.join(DIST_ROOT, 'subpackages/issue-466/index.wxml')
    const pageJsonPath = path.join(DIST_ROOT, 'subpackages/issue-466/index.json')
    const dialogIndexPath = path.join(DIST_ROOT, 'subpackages/issue-466/miniprogram_npm/tdesign-miniprogram/dialog/index.js')
    const pageJs = await fs.readFile(pageJsPath, 'utf-8')
    const nativePageJs = await fs.readFile(nativePageJsPath, 'utf-8')
    const pageWxml = stripGeneratedScopeAttrs(await fs.readFile(pageWxmlPath, 'utf-8'))
    const pageJson = await fs.readJson(pageJsonPath) as PageJson

    expect(await fs.pathExists(dialogIndexPath)).toBe(true)
    expect(pageWxml).toContain('issue-466 tdesign Dialog.confirm runtime')
    expect(pageWxml).toContain('alertType = {{alertType}}')
    expect(pageWxml).toContain('confirmType = {{confirmType}}')
    expect(pageWxml).toContain('actionType = {{actionType}}')
    expect(pageWxml).toContain('closeType = {{closeType}}')
    expect(pageWxml).toContain('defaultConfirmType = {{defaultConfirmType}}')
    expect(pageWxml).toContain('<t-dialog id="issue466-dialog" />')
    expect(pageJson.usingComponents).toMatchObject({
      't-dialog': 'tdesign-miniprogram/dialog/dialog',
    })
    expect(pageJs).toContain('_openAlertE2E')
    expect(pageJs).toContain('_openDialogE2E')
    expect(pageJs).toContain('_openConfirmE2E')
    expect(pageJs).toContain('_openActionE2E')
    expect(pageJs).toContain('_confirmDialogE2E')
    expect(pageJs).toContain('_cancelDialogE2E')
    expect(pageJs).toContain('_selectSecondActionE2E')
    expect(pageJs).toContain('_prepareCloseHostE2E')
    expect(pageJs).toContain('_closeDialogE2E')
    expect(pageJs).toContain('_runE2E')
    expect(pageJs).toContain('_resetE2E')
    expect(pageJs).toContain('#issue466-dialog')
    expect(pageJs).toContain('tdesign-miniprogram/dialog/index')
    expect(pageJs).toContain('issue-466 alert title')
    expect(pageJs).toContain('issue-466 confirm title')
    expect(pageJs).toContain('issue-466 action title')
    expect(pageJs).toContain('issue-466 close title')
    expect(pageJs).not.toContain('.default.default')
    expect(pageJs).not.toMatch(/__toESM\([^)]*,\s*1\)/)
    expect(nativePageJs).toContain('tdesign-miniprogram/dialog/index')
    expect(nativePageJs).toContain('issue-466 native confirm title')
    expect(nativePageJs).not.toContain('miniprogram_dist/dialog/index.js')
    expect(nativePageJs).not.toContain('.default.default')
    expect(nativePageJs).not.toMatch(/__toESM\([^)]*,\s*1\)/)
  })
}
