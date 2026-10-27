import type { Page as PageJson } from '@weapp-core/schematics'
import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { expect, it } from 'vitest'
import { runBuild } from '../build/standard'
import { DIST_ROOT } from '../constants'

export const group = 'standard'
export const order = 56

export function registerGithubIssuesBuildCase() {
  it('experiment: native slot self-closing and paired tags produce equivalent slot fixtures', async () => {
    await runBuild()

    const pageWxmlPath = path.join(DIST_ROOT, 'pages/slot-tag-form/index.wxml')
    const pageJsPath = path.join(DIST_ROOT, 'pages/slot-tag-form/index.js')
    const pageJsonPath = path.join(DIST_ROOT, 'pages/slot-tag-form/index.json')
    const selfHostWxmlPath = path.join(DIST_ROOT, 'components/slot-tag-self-host/index.wxml')
    const pairedHostWxmlPath = path.join(DIST_ROOT, 'components/slot-tag-paired-host/index.wxml')

    const pageWxml = await fs.readFile(pageWxmlPath, 'utf-8')
    const pageJs = await fs.readFile(pageJsPath, 'utf-8')
    const pageJson = await fs.readJson(pageJsonPath) as PageJson
    const selfHostWxml = await fs.readFile(selfHostWxmlPath, 'utf-8')
    const pairedHostWxml = await fs.readFile(pairedHostWxmlPath, 'utf-8')

    expect(selfHostWxml).toContain('<slot name="header" />')
    expect(selfHostWxml).toContain('<slot />')
    expect(pairedHostWxml).toContain('<slot name="header"></slot>')
    expect(pairedHostWxml).toContain('<slot></slot>')
    expect(pageWxml).toContain('self header: {{sharedHeaderLabel}}')
    expect(pageWxml).toContain('self body: {{sharedBodyLabel}}')
    expect(pageWxml).toContain('paired header: {{sharedHeaderLabel}}')
    expect(pageWxml).toContain('paired body: {{sharedBodyLabel}}')
    expect(pageJs).toContain('toggleLabels')
    expect(pageJs).toContain('_runE2E')
    expect(pageJson.usingComponents).toMatchObject({
      'slot-tag-paired-host': '../../components/slot-tag-paired-host/index',
      'slot-tag-self-host': '../../components/slot-tag-self-host/index',
    })
  })
}
