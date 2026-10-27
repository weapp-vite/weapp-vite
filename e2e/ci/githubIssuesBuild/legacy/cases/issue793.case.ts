import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { expect, it } from 'vitest'
import { runIssue793Build } from '../build/issue793Build'
import { runBuild } from '../build/standard'
import { DIST_ROOT, ISSUE_793_DIST_ROOT } from '../constants'

export const group = 'issue793'
export const order = 4

export function registerGithubIssuesBuildCase() {
  it('issue #793: keeps derived app config aligned with the scoped routes', async () => {
    await runBuild()

    const standardAppJson = await fs.readJSON(path.join(DIST_ROOT, 'app.json')) as {
      preloadRule?: Record<string, unknown>
    }
    expect(standardAppJson.preloadRule).toBeUndefined()

    await runIssue793Build()

    const appJson = await fs.readJSON(path.join(ISSUE_793_DIST_ROOT, 'app.json')) as {
      entryPagePath?: string
      pages?: string[]
      preloadRule?: Record<string, unknown>
      subPackages?: Array<{ root?: string, pages?: string[] }>
      tabBar?: { list?: Array<{ pagePath?: string }> }
    }

    expect(appJson.entryPagePath).toBe('pages/issue-793/index')
    expect(appJson.pages).toHaveLength(2)
    expect(appJson.pages).toEqual(expect.arrayContaining([
      'pages/issue-793/index',
      'pages/issue-793-settings/index',
    ]))
    expect(appJson.preloadRule).toBeUndefined()
    expect(appJson.subPackages).toEqual([])
    expect(appJson.tabBar?.list?.map(item => item.pagePath)).toEqual([
      'pages/issue-793/index',
      'pages/issue-793-settings/index',
    ])
    expect(await fs.pathExists(path.join(ISSUE_793_DIST_ROOT, 'subs'))).toBe(false)

    await runIssue793Build('subpackage')

    const subpackageAppJson = await fs.readJSON(path.join(ISSUE_793_DIST_ROOT, 'app.json')) as {
      entryPagePath?: string
      pages?: string[]
      preloadRule?: Record<string, unknown>
      subPackages?: Array<{ root?: string, pages?: string[] }>
      tabBar?: unknown
    }

    expect(subpackageAppJson.entryPagePath).toBeUndefined()
    expect(subpackageAppJson.pages).toEqual([])
    expect(subpackageAppJson.preloadRule).toBeUndefined()
    expect(subpackageAppJson.subPackages).toEqual([
      { root: 'subs', pages: ['issue-793/index'] },
    ])
    expect(subpackageAppJson.tabBar).toBeUndefined()
    expect(await fs.pathExists(path.join(ISSUE_793_DIST_ROOT, 'pages'))).toBe(false)

    await runIssue793Build('main-with-subpackage')

    const mainWithSubpackageAppJson = await fs.readJSON(path.join(ISSUE_793_DIST_ROOT, 'app.json')) as {
      pages?: string[]
      preloadRule?: Record<string, { packages?: string[] }>
      subPackages?: Array<{ root?: string, pages?: string[] }>
      tabBar?: { list?: Array<{ pagePath?: string }> }
    }

    expect(mainWithSubpackageAppJson.pages).toEqual(expect.arrayContaining([
      'pages/issue-793/index',
      'pages/issue-793-settings/index',
    ]))
    expect(mainWithSubpackageAppJson.subPackages).toEqual([
      { root: 'subs', pages: ['issue-793/index'] },
    ])
    expect(mainWithSubpackageAppJson.preloadRule).toEqual({
      'pages/issue-793/index': {
        packages: ['subs'],
      },
      'subs/issue-793/index': {
        packages: ['__APP__'],
      },
    })
    expect(mainWithSubpackageAppJson.tabBar?.list?.map(item => item.pagePath)).toEqual([
      'pages/issue-793/index',
      'pages/issue-793-settings/index',
    ])
    expect(await fs.pathExists(path.join(ISSUE_793_DIST_ROOT, 'pages/issue-793/index.js'))).toBe(true)
    expect(await fs.pathExists(path.join(ISSUE_793_DIST_ROOT, 'subs/issue-793/index.js'))).toBe(true)
  })
}
