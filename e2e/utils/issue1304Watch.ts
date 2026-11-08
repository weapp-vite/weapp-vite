import type { startIssueClassicDev } from './issueClassicDev'
import { access, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { expect, vi } from 'vitest'
import { createHeadlessSession } from '../../mpcore/packages/simulator/src/runtime'
import { replaceFileByRename, waitForFileContains } from './hmr-helpers'
import { assertIssuePageArtifacts, waitForIssuePublication } from './issueClassicDev'

export const ISSUE_1304_ROUTE = '/pages/index/index'
export const ISSUE_1304_FINAL_VALUE = 'target:restored:shared:updated'
const TARGET = 'shared/lazy/runtime.js'
const PAGE = 'pages/index/index.js'

/** 每代使用全新的模块缓存执行真正 require.async，缺少目标或共享依赖都会失败。 */
export async function assertIssue1304ColdRuntime(project: string, expected: string) {
  const session = createHeadlessSession({ projectPath: project })
  try {
    session.reLaunch(ISSUE_1304_ROUTE)
    const result = await session.evaluateRuntime<Promise<string>>('() => getCurrentPages()[0].loadLazy()')
    expect(result).toBe(expected)
    expect(session.renderCurrentPage().wxml).toContain(expected)
    await assertIssuePageArtifacts(project)
    await access(path.join(project, 'dist', TARGET))
  }
  finally {
    session.close()
  }
}

export async function exerciseIssue1304Watch(project: string, dev: ReturnType<typeof startIssueClassicDev>) {
  const page = path.join(project, 'src/pages/index/index.ts')
  const target = path.join(project, 'src/shared/lazy/runtime.ts')
  const shared = path.join(project, 'src/shared/state.ts')
  const originalPage = await readFile(page, 'utf8')
  const originalTarget = await readFile(target, 'utf8')
  const dist = path.join(project, 'dist')
  await dev.waitForInitialBuild()
  await waitForIssuePublication(project, dev)
  await assertIssue1304ColdRuntime(project, 'target:initial:shared:initial')

  await replaceFileByRename(page, originalPage.replace('page:initial', 'page:updated'))
  await dev.waitFor(waitForFileContains(path.join(dist, PAGE), 'page:updated'), 'unrelated page rebuild')
  await waitForIssuePublication(project, dev)
  await assertIssue1304ColdRuntime(project, 'target:initial:shared:initial')

  await replaceFileByRename(target, originalTarget.replace('target:initial', 'target:updated'))
  await dev.waitFor(waitForFileContains(path.join(dist, TARGET), 'target:updated'), 'lazy target rebuild')
  await waitForIssuePublication(project, dev)
  await assertIssue1304ColdRuntime(project, 'target:updated:shared:initial')

  await replaceFileByRename(shared, 'export const sharedMarker = \'shared:updated\'\n')
  await dev.waitFor(vi.waitFor(async () => {
    const session = createHeadlessSession({ projectPath: project })
    try {
      session.reLaunch(ISSUE_1304_ROUTE)
      expect(await session.evaluateRuntime<Promise<string>>('() => getCurrentPages()[0].loadLazy()')).toBe('target:updated:shared:updated')
    }
    finally {
      session.close()
    }
  }, { timeout: 30_000 }), 'shared dependency rebuild')
  await waitForIssuePublication(project, dev)
  await assertIssue1304ColdRuntime(project, 'target:updated:shared:updated')

  const withoutReference = 'Page({ data: { value: \'reference:removed\', count: 0 } })\n'
  await replaceFileByRename(page, withoutReference)
  await dev.waitFor(waitForFileContains(path.join(dist, PAGE), 'reference:removed'), 'last lazy reference removal')
  await waitForIssuePublication(project, dev)
  expect(await readFile(path.join(dist, PAGE), 'utf8')).not.toContain('require.async')
  const withoutReferenceSession = createHeadlessSession({ projectPath: project })
  try {
    withoutReferenceSession.reLaunch(ISSUE_1304_ROUTE)
    expect(withoutReferenceSession.evaluateRuntime('() => typeof getCurrentPages()[0].loadLazy')).toBe('undefined')
    expect(withoutReferenceSession.evaluateRuntime('() => getCurrentPages()[0].data.value')).toBe('reference:removed')
  }
  finally {
    withoutReferenceSession.close()
  }
  await assertIssuePageArtifacts(project)

  // 普通增量发布保留旧清单；真实删除触发完整扫描后，成功写出必须退休不再引用的目标。
  const deletionOffset = dev.getOutput().length
  await rm(target)
  await dev.waitFor(vi.waitFor(() => {
    expect(dev.getOutput().slice(deletionOffset)).toContain('小程序已重新构建')
  }, { timeout: 30_000 }), 'lazy source deletion full publication')
  await dev.waitFor(vi.waitFor(async () => {
    await expect(access(path.join(dist, TARGET))).rejects.toMatchObject({ code: 'ENOENT' })
  }, { timeout: 30_000 }), 'obsolete lazy output retirement')
  await waitForIssuePublication(project, dev)
  await expect(access(path.join(dist, TARGET))).rejects.toMatchObject({ code: 'ENOENT' })
  await assertIssuePageArtifacts(project)

  await writeFile(target, originalTarget.replace('target:initial', 'target:restored'))
  await replaceFileByRename(page, originalPage.replace('page:initial', 'page:restored'))
  await dev.waitFor(waitForFileContains(path.join(dist, PAGE), 'page:restored'), 'restored lazy reference')
  await dev.waitFor(waitForFileContains(path.join(dist, TARGET), 'target:restored'), 'restored lazy target')
  await waitForIssuePublication(project, dev)
  await assertIssue1304ColdRuntime(project, ISSUE_1304_FINAL_VALUE)
}
