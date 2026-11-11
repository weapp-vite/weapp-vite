import type { MiniProgram } from '@weapp-vite/miniprogram-automator'
import { access, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
// eslint-disable-next-line antfu/no-import-dist -- 验收实际发布入口，避免源码别名绕过消费者构建。
import { buildTestArtifact, isTestArtifactCurrent } from '../../packages/weapp-vite/dist/test.mjs'
import { launchAutomator } from '../utils/automator'
import { createDomAcceptance } from '../utils/domAcceptance'
import { createIssueRegressionProject } from '../utils/issueRegressionProject'
import { cleanupTemporaryRuntimeProject } from '../utils/temporaryRuntimeProject'

const FIXTURE = 'e2e-apps/github-issues/fixtures/issue-1316'
const ROUTE = '/pages/index/index'

describe('issue #1316: test artifact resolver root watches', { concurrent: false }, () => {
  let project: string | undefined
  let host: MiniProgram | undefined

  beforeAll(async () => {
    project = await createIssueRegressionProject(1316)
    const options = { cwd: project, outDir: 'dist', skipNpm: true }
    const first = await buildTestArtifact(options)
    expect(await isTestArtifactCurrent(first)).toBe(true)
    const output = path.join(first.miniprogramRootPath, 'pages/index/index.js')
    expect(await readFile(output, 'utf8')).toContain('first')

    const source = path.join(project, 'src/pages/index/index.js')
    await writeFile(source, (await readFile(source, 'utf8')).replace('first', 'other'))
    expect(await isTestArtifactCurrent(first)).toBe(false)
    const rebuilt = await buildTestArtifact(options)
    expect(await isTestArtifactCurrent(rebuilt)).toBe(true)
    expect(await readFile(output, 'utf8')).toContain('other')
    for (const extension of ['js', 'json', 'wxml']) {
      await access(path.join(rebuilt.miniprogramRootPath, `pages/index/index.${extension}`))
    }
    host = await launchAutomator({
      projectPath: project,
      bridgeProjectMode: 'direct',
      warmupRoute: ROUTE,
      warmupRootSelectors: ['view'],
    })
  }, 180_000)

  afterAll(async () => {
    await cleanupTemporaryRuntimeProject({
      project,
      closeSession: () => host?.close(),
      stopDev: () => {},
    })
  }, 120_000)

  it('renders the rebuilt same-length source edit and preserves it after page reentry', async (context) => {
    const dom = createDomAcceptance(context, FIXTURE, [
      { id: 'rebuilt', route: ROUTE, action: '根目录监听构建完成后显示同长度源码修改的结果', nodes: [{ selector: 'view', text: 'other' }] },
      { id: 'reentered', route: ROUTE, action: '复用同一会话重新进入页面，仍显示最新产物', nodes: [{ selector: 'view', text: 'other' }] },
    ])
    const page = await host!.reLaunch(ROUTE)
    expect(await page.data('value')).toBe('other')
    await dom.check('rebuilt', host!, page)
    const reentered = await host!.reLaunch(ROUTE)
    expect(await reentered.data('value')).toBe('other')
    await dom.check('reentered', host!, reentered)
  })
})
