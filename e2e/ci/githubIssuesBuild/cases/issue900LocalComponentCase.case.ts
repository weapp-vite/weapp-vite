import type { GithubIssuesBuildCaseContext } from './types'
import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { expect, it } from 'vitest'

export function registerGithubIssuesBuildCase(context: GithubIssuesBuildCaseContext) {
  it('issue #900 regression: matches local component filenames across tag casing styles', async () => {
    await context.runStandardBuild()

    const pageBase = path.join(context.distRoot, 'pages/issue-900/index')
    const pageWxml = await fs.readFile(`${pageBase}.wxml`, 'utf8')
    const pageJson = await fs.readJSON(`${pageBase}.json`) as {
      usingComponents?: Record<string, string>
    }
    const expectedComponents = {
      'v-kebab-kebab-tag-probe': '/components/issue-900/v-kebab-kebab-tag-probe',
      'v-kebab-pascal-tag-probe': '/components/issue-900/v-kebab-pascal-tag-probe',
      'v-pascal-pascal-tag-probe': '/components/issue-900/VPascalPascalTagProbe',
      'v-pascal-kebab-tag-probe': '/components/issue-900/VPascalKebabTagProbe',
    }

    expect(pageJson.usingComponents).toMatchObject(expectedComponents)
    for (const componentName of Object.keys(expectedComponents)) {
      expect(pageWxml).toContain(`<${componentName}`)
    }

    const emittedMarkers = {
      'components/issue-900/v-kebab-kebab-tag-probe.wxml': 'kebab-file-kebab-tag',
      'components/issue-900/v-kebab-pascal-tag-probe.wxml': 'kebab-file-pascal-tag',
      'components/issue-900/VPascalPascalTagProbe.wxml': 'pascal-file-pascal-tag',
      'components/issue-900/VPascalKebabTagProbe.wxml': 'pascal-file-kebab-tag',
    }
    for (const [relativePath, marker] of Object.entries(emittedMarkers)) {
      expect(await fs.readFile(path.join(context.distRoot, relativePath), 'utf8')).toContain(marker)
    }
  })
}
