import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { expect, it } from 'vitest'
import { runBuild } from '../build/standard'
import { DIST_ROOT } from '../constants'

export const group = 'standard'
export const order = 8

export function registerGithubIssuesBuildCase() {
  it('issue #806: emits PascalCase Vue components as kebab-case WXML tags and registrations', async () => {
    await runBuild()

    const pageWxml = await fs.readFile(path.join(DIST_ROOT, 'pages/issue-806/index.wxml'), 'utf8')
    const pageJson = await fs.readJSON(path.join(DIST_ROOT, 'pages/issue-806/index.json')) as {
      usingComponents?: Record<string, string>
    }

    expect(pageWxml).toContain('<pascal-card vue-slots="{{ {default:true} }}">issue-806</pascal-card>')
    expect(pageWxml).not.toContain('<PascalCard')
    expect(pageJson.usingComponents).toMatchObject({
      'pascal-card': '/components/issue-806/PascalCard/index',
    })
    expect(pageJson.usingComponents).not.toHaveProperty('PascalCard')
  })
}
