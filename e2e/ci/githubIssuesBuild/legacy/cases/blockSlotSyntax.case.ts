import type { Page as PageJson } from '@weapp-core/schematics'
import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { expect, it } from 'vitest'
import { runBuild } from '../build/standard'
import { DIST_ROOT } from '../constants'

export const group = 'standard'
export const order = 37

export function registerGithubIssuesBuildCase() {
  it('experiment: preserves block slot syntax in native github-issues fixtures', async () => {
    await runBuild()

    const pageWxmlPath = path.join(DIST_ROOT, 'pages/block-slot/index.wxml')
    const pageJsPath = path.join(DIST_ROOT, 'pages/block-slot/index.js')
    const pageJsonPath = path.join(DIST_ROOT, 'pages/block-slot/index.json')
    const componentWxmlPath = path.join(DIST_ROOT, 'components/block-slot-host/index.wxml')
    const componentJsPath = path.join(DIST_ROOT, 'components/block-slot-host/index.js')

    const pageWxml = await fs.readFile(pageWxmlPath, 'utf-8')
    const pageJs = await fs.readFile(pageJsPath, 'utf-8')
    const pageJson = await fs.readJson(pageJsonPath) as PageJson
    const componentWxml = await fs.readFile(componentWxmlPath, 'utf-8')
    const componentJs = await fs.readFile(componentJsPath, 'utf-8')

    expect(pageWxml).toContain('<block slot="header">')
    expect(pageWxml).toContain('header slot via block: {{headerLabel}}')
    expect(pageWxml).toContain('default slot via block: {{bodyLabel}}')
    expect(pageJs).toContain('toggleLabels')
    expect(pageJs).toContain('_runE2E')
    expect(pageJson.usingComponents).toMatchObject({
      'block-slot-host': '../../components/block-slot-host/index',
    })
    expect(componentWxml).toContain('<slot name="header"></slot>')
    expect(componentWxml).toContain('<slot></slot>')
    expect(componentJs).toContain('multipleSlots: true')
  })
}
