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

const FIXTURE = 'e2e-apps/github-issues/fixtures/issue-1264'
const ROUTE = '/pages/index/index'

interface ApiObservation {
  available: string[]
  login: {
    order: string[]
    returnType: string
    success?: { hasCode: boolean, errMsg: string }
    complete?: { errMsg: string }
  }
  account: { miniProgram: { appId: string, envVersion: string, version: string } }
  binary: {
    roundTrips: Array<{
      input: number[]
      encoded: { type: string, value: string }
      decoded: { type: string, bytes: number[] }
    }>
  }
}

describe('issue #1264: simulator basic wx APIs', { concurrent: false }, () => {
  let project: string | undefined
  let host: MiniProgram | undefined
  let errors: RuntimeErrorCollector | undefined

  beforeAll(async () => {
    project = await createIssueRegressionProject(1264)
    await buildIssueRegressionProject(project, 'weapp')
    const app = JSON.parse(await readFile(path.join(project, 'dist/app.json'), 'utf8')) as { pages: string[] }
    expect(app.pages).toEqual([ROUTE.slice(1)])
    for (const extension of ['js', 'json', 'wxml']) {
      await access(path.join(project, `dist/pages/index/index.${extension}`))
    }
    host = await launchAutomator({
      projectPath: project,
      bridgeProjectMode: 'direct',
      warmupRoute: ROUTE,
      warmupRootSelectors: ['#issue1264-page'],
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

  it('renders login callbacks, account information and every byte after native API calls', async (context) => {
    const dom = createDomAcceptance(context, FIXTURE, [
      {
        id: 'initial',
        route: ROUTE,
        action: '首次进入原生页面，基础 API 尚未调用',
        nodes: [
          { selector: '#api-status', text: 'pending' },
          { selector: '#login-status', text: 'pending' },
          { selector: '#account-status', text: 'pending' },
          { selector: '#binary-status', text: 'pending' },
        ],
      },
      {
        id: 'called',
        route: ROUTE,
        action: '原生调用完成后呈现异步登录顺序、账号字段和全部字节回转',
        nodes: [
          { selector: '#api-status', text: 'available' },
          { selector: '#login-status', text: 'success' },
          { selector: '#login-order', text: 'before-call,after-call,success,complete' },
          { selector: '#account-status', text: 'valid' },
          { selector: '#binary-status', text: 'round-trip' },
          { selector: '#empty-status', text: 'empty-round-trip' },
        ],
      },
      {
        id: 'reopened',
        route: ROUTE,
        action: '重新进入后页面状态独立恢复，旧的调用结果不残留',
        nodes: [
          { selector: '#api-status', text: 'pending' },
          { selector: '#login-status', text: 'pending' },
          { selector: '#binary-status', text: 'pending' },
        ],
      },
    ])
    const page = await host!.reLaunch(ROUTE)
    await dom.check('initial', host!, page)
    // 原生 Page.callMethod 会把 Promise 序列化为 {}；AppService 按 callId 等待结果且只调用一次登录。
    const observation = await page.callMethodWithOptions('_runContract', { timeout: 20_000, routeOnly: true, fallback: false }) as ApiObservation
    expect(observation.available).toEqual(['function', 'function', 'function', 'function'])
    expect(observation.login).toMatchObject({
      order: ['before-call', 'after-call', 'success', 'complete'],
      returnType: 'undefined',
      success: { hasCode: true, errMsg: 'login:ok' },
      complete: { errMsg: 'login:ok' },
    })
    expect(observation.account.miniProgram.appId).toEqual(expect.any(String))
    expect(observation.account.miniProgram.appId.length).toBeGreaterThan(0)
    expect(['develop', 'trial', 'release']).toContain(observation.account.miniProgram.envVersion)
    expect(observation.account.miniProgram.version).toEqual(expect.any(String))
    expect(observation.binary.roundTrips.map(item => item.input.length)).toEqual([0, 1, 2, 3, 256])
    expect(observation.binary.roundTrips.slice(0, 4).map(item => item.encoded.value)).toEqual(['', 'AA==', 'AP8=', 'AH//'])
    for (const roundTrip of observation.binary.roundTrips) {
      expect(roundTrip.encoded.type).toBe('string')
      expect(roundTrip.decoded).toEqual({ type: 'ArrayBuffer', bytes: roundTrip.input })
    }
    await dom.check('called', host!, page)
    await dom.check('reopened', host!, await host!.reLaunch(ROUTE))
  })
})
