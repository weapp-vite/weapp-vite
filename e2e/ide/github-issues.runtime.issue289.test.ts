import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { beforeAll, describe, expect, it } from 'vitest'
import {
  DIST_ROOT,
  PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT,
  prepareGithubIssuesBuild,
} from './github-issues.runtime.shared'

async function readDistFile(relativePath: string) {
  return await fs.readFile(path.join(DIST_ROOT, relativePath), 'utf8')
}

describe.sequential('e2e app: github-issues / issue-289', () => {
  beforeAll(async () => {
    await prepareGithubIssuesBuild()
  }, PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT)

  it('issue #289: compiles object-literal class bindings and runtime probe', async () => {
    const wxml = await readDistFile('pages/issue-289/object-literal/index.wxml')
    const js = await readDistFile('pages/issue-289/object-literal/index.js')

    expect(wxml).toContain('issue289-object-toggle-list')
    expect(wxml).toContain('issue289-object-toggle-compact')
    expect(wxml).toContain('ObjectLiteralExample')
    expect(js).toContain('runE2E')
    expect(js).toContain('compactChanged')
    expect(js).toContain('showListRoundTripWorked')
  })

  it('issue #289: compiles map-class dynamic class bindings and runtime probe', async () => {
    const wxml = await readDistFile('pages/issue-289/map-class/index.wxml')
    const js = await readDistFile('pages/issue-289/map-class/index.js')

    expect(wxml).toContain('class="{{__wv_cls_0}}"')
    expect(wxml).toContain('class="{{__wv_cls_1}}"')
    expect(wxml).toContain('issue289-map-switch-expanded')
    expect(wxml).toContain('issue289-map-switch-list')
    expect(wxml).toContain('MapClassExample')
    expect(js).toContain('issue289-map-toggle-expanded')
    expect(js).toContain('issue289-map-toggle-list')
    expect(js).toContain('calloutExpandedChanged')
  })

  it('issue #289: compiles root-class bindings and runtime probe', async () => {
    const wxml = await readDistFile('pages/issue-289/root-class/index.wxml')
    const js = await readDistFile('pages/issue-289/root-class/index.js')

    expect(wxml).toContain('issue289-root-toggle-options')
    expect(wxml).toContain('issue289-root-cycle-option')
    expect(wxml).toContain('RootClassExample')
    expect(js).toContain('selectedIndexChanged')
    expect(js).toContain('showOptionsChanged')
  })

  it('issue #289: compiles computed-class dynamic class bindings and runtime probe', async () => {
    const wxml = await readDistFile('pages/issue-289/computed-class/index.wxml')
    const js = await readDistFile('pages/issue-289/computed-class/index.js')

    expect(wxml).toContain('class="{{__wv_cls_0}}"')
    expect(wxml).toContain('class="{{__wv_cls_1}}"')
    expect(wxml).toContain('issue289-computed-switch-source')
    expect(wxml).toContain('issue289-computed-switch-items')
    expect(wxml).toContain('ComputedClassExample')
    expect(js).toContain('issue289-computed-toggle-source')
    expect(js).toContain('issue289-computed-toggle-items')
    expect(js).toContain('sourceChanged')
    expect(js).toContain('showItemsChanged')
  })
})
