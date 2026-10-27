import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { expect, it } from 'vitest'
import { runBuild } from '../build/standard'
import { DIST_ROOT } from '../constants'
import { stripGeneratedScopeAttrs } from '../helpers'

export const group = 'standard'
export const order = 55

export function registerGithubIssuesBuildCase() {
  it('experiment: flex parent keeps projected multi-node slot groups visible via view wrappers', async () => {
    await runBuild()

    const pageWxmlPath = path.join(DIST_ROOT, 'pages/slot-flex-layout/index.wxml')
    const pageJsPath = path.join(DIST_ROOT, 'pages/slot-flex-layout/index.js')
    const componentWxmlPath = path.join(DIST_ROOT, 'components/slot-flex-host/index.wxml')

    const pageWxml = stripGeneratedScopeAttrs(await fs.readFile(pageWxmlPath, 'utf-8'))
    const pageJs = await fs.readFile(pageJsPath, 'utf-8')
    const componentWxml = await fs.readFile(componentWxmlPath, 'utf-8')

    expect(pageWxml).toContain('slot flex layout experiment')
    expect(pageWxml).toContain('<view slot="left" class="slot-flex-item slot-flex-item--single-left" data-case="single-left">')
    expect(pageWxml).toContain('<view slot="middle" class="slot-flex-item slot-flex-item--single-middle" data-case="single-middle">')
    expect(pageWxml).toContain('<view slot="right" class="slot-flex-item slot-flex-item--single-right" data-case="single-right">')
    expect(pageWxml).toContain('<weapp-slot-wrapper slot="middle"><view class="slot-flex-item slot-flex-item--middle-multi-center-a" data-case="middle-multi-center-a">')
    expect(pageWxml).toContain('<weapp-slot-wrapper slot="left"><view class="slot-flex-item slot-flex-item--all-multi-left-a" data-case="all-multi-left-a">')
    expect(pageWxml).toContain('<weapp-slot-wrapper slot="right"><view class="slot-flex-item slot-flex-item--all-multi-right-a" data-case="all-multi-right-a">')
    expect(pageWxml).not.toContain('<block slot="middle">')
    expect(pageWxml).not.toContain('<block slot="left">')
    expect(pageWxml).not.toContain('<block slot="right">')
    expect(pageJs).not.toContain('_runE2E')
    expect(componentWxml).toContain('<slot name="left" />')
    expect(componentWxml).toContain('<slot name="middle" />')
    expect(componentWxml).toContain('<slot name="right" />')
  })
}
