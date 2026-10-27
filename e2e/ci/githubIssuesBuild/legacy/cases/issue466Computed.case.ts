import type { Page as PageJson } from '@weapp-core/schematics'
import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { expect, it } from 'vitest'
import { runBuild } from '../build/standard'
import { DIST_ROOT } from '../constants'
import { expectModuleReference } from '../helpers'

export const group = 'standard'
export const order = 59

export function registerGithubIssuesBuildCase() {
  it('issue #466 computed: keeps build-npm cjs package output stable inside github-issues subpackage', async () => {
    await runBuild()

    const pageJsPath = path.join(DIST_ROOT, 'subpackages/issue-466-computed/index.js')
    const pageWxmlPath = path.join(DIST_ROOT, 'subpackages/issue-466-computed/index.wxml')
    const pageJsonPath = path.join(DIST_ROOT, 'subpackages/issue-466-computed/index.json')
    const componentJsPath = path.join(DIST_ROOT, 'subpackages/issue-466-computed/components/CjsProbe/index.js')
    const componentWxmlPath = path.join(DIST_ROOT, 'subpackages/issue-466-computed/components/CjsProbe/index.wxml')
    const computedPkgPath = path.join(DIST_ROOT, 'subpackages/issue-466-computed/miniprogram_npm/miniprogram-computed/index.js')
    const computedDialogComponentPath = path.join(DIST_ROOT, 'subpackages/issue-466-computed/miniprogram_npm/tdesign-miniprogram/dialog/dialog.js')
    const pageJs = await fs.readFile(pageJsPath, 'utf-8')
    const pageWxml = await fs.readFile(pageWxmlPath, 'utf-8')
    const pageJson = await fs.readJson(pageJsonPath) as PageJson
    const componentJs = await fs.readFile(componentJsPath, 'utf-8')
    const componentWxml = await fs.readFile(componentWxmlPath, 'utf-8')
    const computedPkg = await fs.readFile(computedPkgPath, 'utf-8')
    const computedFastDeepEqualPath = path.join(DIST_ROOT, 'subpackages/issue-466-computed/miniprogram_npm/fast-deep-equal/index.js')
    const computedRfdcPath = path.join(DIST_ROOT, 'subpackages/issue-466-computed/miniprogram_npm/rfdc/index.js')

    expect(await fs.pathExists(computedPkgPath)).toBe(true)
    expect(await fs.pathExists(computedFastDeepEqualPath)).toBe(true)
    expect(await fs.pathExists(computedRfdcPath)).toBe(true)
    expect(await fs.pathExists(computedDialogComponentPath)).toBe(true)
    expect(pageWxml).toContain('issue-466 computed cjs package')
    expect(pageWxml).toContain('alertType = {{alertType}}')
    expect(pageWxml).toContain('confirmType = {{confirmType}}')
    expect(pageWxml).toContain('actionType = {{actionType}}')
    expect(pageWxml).toContain('closeType = {{closeType}}')
    expect(pageWxml).toContain('<issue466-computed-probe')
    expect(pageWxml).toContain('<t-dialog id="issue466-computed-dialog" />')
    expect(pageJson.usingComponents).toMatchObject({
      'issue466-computed-probe': './components/CjsProbe/index',
      't-dialog': './miniprogram_npm/tdesign-miniprogram/dialog/dialog',
    })
    expect(pageJs).toContain('readProbeState')
    expect(pageJs).toContain('applyNextE2E')
    expect(pageJs).toContain('_openAlertE2E')
    expect(pageJs).toContain('_openConfirmE2E')
    expect(pageJs).toContain('_openActionE2E')
    expect(pageJs).toContain('_confirmDialogE2E')
    expect(pageJs).toContain('_cancelDialogE2E')
    expect(pageJs).toContain('_selectSecondActionE2E')
    expect(pageJs).toContain('_prepareCloseHostE2E')
    expect(pageJs).toContain('_closeDialogE2E')
    expect(pageJs).toContain('_runE2E')
    expect(pageJs).toContain('tdesign-miniprogram/dialog/index')
    expect(pageJs).toContain('issue-466-computed alert title')
    expect(pageJs).toContain('issue-466-computed confirm title')
    expect(pageJs).toContain('issue-466-computed action title')
    expect(pageJs).toContain('issue-466-computed close title')

    expect(componentWxml).toContain('sum = {{sum}}')
    expect(componentWxml).toContain('summary = {{summary}}')
    expect(componentJs).toContain('ComponentWithComputed')
    expectModuleReference(componentJs, 'miniprogram-computed')
    expect(componentJs).toContain('watchCount')
    expect(componentJs).toContain('lastWatch')
    expect(componentJs).toContain('summary(data)')
    expect(componentJs).toContain('sum(data)')

    expect(computedPkg).toContain('ComponentWithComputed')
    expect(computedPkg).toContain('BehaviorWithComputed')
    expect(computedPkg).toContain('require("rfdc")')
  })
}
