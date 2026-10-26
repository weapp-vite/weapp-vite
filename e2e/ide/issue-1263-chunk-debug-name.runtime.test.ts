import type { MiniProgram } from '@weapp-vite/miniprogram-automator'
import type { RuntimeErrorCollector } from './runtimeErrors'
import { access, readFile } from 'node:fs/promises'
import path from 'node:path'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { createDomAcceptance } from '../utils/domAcceptance'
import { buildIssueRegressionProject, createIssueRegressionProject } from '../utils/issueRegressionProject'
import { cleanupTemporaryRuntimeProject } from '../utils/temporaryRuntimeProject'
import { attachRuntimeErrorCollector } from './runtimeErrors'

const FIXTURE = 'e2e-apps/github-issues/fixtures/issue-1263'
const FIRST = '/pages/index/index'
const SECOND = '/pages/second/index'

describe('issue #1263: readable chunk groups', { concurrent: false }, () => {
  let project: string | undefined
  let host: MiniProgram | undefined
  let errors: RuntimeErrorCollector | undefined

  beforeAll(async () => {
    project = await createIssueRegressionProject(1263)
    const build = await buildIssueRegressionProject(project, 'weapp')
    expect(`${build.stdout}\n${build.stderr}`).not.toMatch(/codeSplitting\.groups\[\d+\]\.name is a function/)
    const app = JSON.parse(await readFile(path.join(project, 'dist/app.json'), 'utf8')) as { pages: string[] }
    expect(app.pages).toEqual([FIRST.slice(1), SECOND.slice(1)])
    for (const route of app.pages) {
      for (const extension of ['js', 'json', 'wxml']) {
        await access(path.join(project, 'dist', `${route}.${extension}`))
      }
    }
    host = await launchAutomator({
      projectPath: project,
      bridgeProjectMode: 'direct',
      warmupRoute: FIRST,
      warmupRootSelectors: ['#issue1263-page'],
    })
    errors = attachRuntimeErrorCollector(host)
  }, 180_000)

  afterEach(() => {
    expect(errors?.getAll()).toEqual([])
  })

  afterAll(async () => {
    await cleanupTemporaryRuntimeProject({
      project,
      disposeTransport: () => errors?.dispose(),
      closeSession: () => host?.close(),
      stopDev: () => {},
    })
  }, 120_000)

  it('executes the same emitted shared module from two native pages', async (context) => {
    const dom = createDomAcceptance(context, FIXTURE, [
      { id: 'first', route: FIRST, action: '首个页面载入共享模块', nodes: [{ selector: '#shared-label', text: 'issue1263-shared:first' }] },
      { id: 'first-called', route: FIRST, action: '首个页面显式调用共享函数', nodes: [{ selector: '#shared-label', text: 'issue1263-shared:first-called' }] },
      { id: 'second', route: SECOND, action: '复用宿主进入第二页，共享模块继续可用', nodes: [{ selector: '#shared-label', text: 'issue1263-shared:second' }] },
      { id: 'second-called', route: SECOND, action: '第二个页面显式调用共享函数', nodes: [{ selector: '#shared-label', text: 'issue1263-shared:second-called' }] },
    ])
    const first = await host!.reLaunch(FIRST)
    await dom.check('first', host!, first)
    expect(await first.callMethod('_runShared')).toBe('issue1263-shared:first-called')
    await dom.check('first-called', host!, first)
    const second = await host!.reLaunch(SECOND)
    await dom.check('second', host!, second)
    expect(await second.callMethod('_runShared')).toBe('issue1263-shared:second-called')
    await dom.check('second-called', host!, second)
  })
})
