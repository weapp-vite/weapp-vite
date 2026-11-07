import type { MiniProgram } from '@weapp-vite/miniprogram-automator'
import type { RuntimeErrorCollector } from './runtimeErrors'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { createDomAcceptance } from '../utils/domAcceptance'
import { assertIssue1303Artifacts, createIssue1303Project, exerciseIssue1303Watch, ISSUE_1303_ENGINE, ISSUE_1303_ROUTE } from '../utils/issue1303Sqlite'
import { startIssueClassicDev } from '../utils/issueClassicDev'
import { cleanupTemporaryRuntimeProject } from '../utils/temporaryRuntimeProject'
import { attachRuntimeErrorCollector } from './runtimeErrors'

const FIXTURE = 'e2e-apps/github-issues/fixtures/issue-1303'

describe.each(['existing-subpackage', 'generated-subpackage'] as const)('issue #1303: SQLite classic runtime %s', (mode) => {
  let project: string | undefined
  let host: MiniProgram | undefined
  let dev: ReturnType<typeof startIssueClassicDev> | undefined
  let errors: RuntimeErrorCollector | undefined
  let watchFailed = false

  beforeAll(async () => {
    project = await createIssue1303Project(mode)
    dev = startIssueClassicDev(project)
    try {
      await exerciseIssue1303Watch(project, mode, dev)
      await dev.stop(5_000)
      await assertIssue1303Artifacts(project, mode)
    }
    catch (error) {
      watchFailed = true
      process.stdout.write(dev.getOutput())
      await writeFile(path.join(project, 'watch-failure.log'), dev.getOutput())
      process.stdout.write(`[issue-1303] retained failed project: ${path.relative(process.cwd(), project).split(path.sep).join('/')}\n`)
      throw error
    }
    host = await launchAutomator({
      projectPath: project,
      trustProject: true,
      bridgeProjectMode: 'direct',
      warmupRoute: ISSUE_1303_ROUTE,
      warmupRootSelectors: ['#issue1303-page'],
    })
    errors = attachRuntimeErrorCollector(host)
  }, 480_000)

  afterEach(() => {
    expect(errors?.getAll()).toEqual([])
  })

  afterAll(async () => {
    await cleanupTemporaryRuntimeProject({
      project: watchFailed ? undefined : project,
      disposeTransport: () => errors?.dispose(),
      closeSession: () => host?.close(),
      stopDev: () => dev?.stop(5_000),
    })
  }, 120_000)

  it('loads real SQLite WASM from the rebuilt subpackage, queries it and reopens without leaking page state', async (context) => {
    const dom = createDomAcceptance(context, FIXTURE, [
      { id: 'initial', route: ISSUE_1303_ROUTE, action: '120 秒稳定窗口及增量重建后的真实产物首屏', nodes: [{ selector: '#sqlite-status', text: 'ready' }, { selector: '#sqlite-count', text: '0' }] },
      { id: 'queried', route: ISSUE_1303_ROUTE, action: '公开 openSqlite API 异步加载分包 WASM 并执行参数化 SELECT', nodes: [{ selector: '#sqlite-status', text: 'queried' }, { selector: '#sqlite-value', text: '1304' }, { selector: '#sqlite-engine', text: ISSUE_1303_ENGINE }, { selector: '#sqlite-count', text: '1' }] },
      { id: 'clicked', route: ISSUE_1303_ROUTE, action: '原生点击重新打开连接、查询及关闭数据库', nodes: [{ selector: '#sqlite-status', text: 'queried' }, { selector: '#sqlite-value', text: '1304' }, { selector: '#sqlite-count', text: '2' }] },
      { id: 'reopened', route: ISSUE_1303_ROUTE, action: '复用宿主重新进入页面，数据库仍可用且页面计数重置', nodes: [{ selector: '#sqlite-status', text: 'queried' }, { selector: '#sqlite-value', text: '1304' }, { selector: '#sqlite-count', text: '1' }] },
    ])
    const page = await host!.currentPage()
    await dom.check('initial', host!, page)
    expect(await page.callMethodWithOptions('runQuery', { timeout: 45_000 })).toEqual({ value: 1304, engine: ISSUE_1303_ENGINE })
    await dom.check('queried', host!, page)
    const button = await page.$('#query-sqlite')
    expect(button).toBeTruthy()
    await button!.tap()
    await dom.check('clicked', host!, page)
    const reopened = await host!.reLaunch(ISSUE_1303_ROUTE)
    expect(await reopened.callMethodWithOptions('runQuery', { timeout: 45_000 })).toEqual({ value: 1304, engine: ISSUE_1303_ENGINE })
    await dom.check('reopened', host!, reopened)
  })
})
