import { afterAll, describe, expect, it } from 'vitest'
import { isDevtoolsHttpPortError, launchAutomator } from '../utils/automator'
import { APP_ROOT, ensureWevuRuntimeDemoBuilt } from './wevu-runtime-demo.shared'

const CASES = [
  {
    expectedPayload: '"transport":"fetch"',
    expectedRequestPath: '/fetch',
    expectedRequestTrace: [
      'timeout=3500',
      'enableHttp2=true',
    ],
    route: '/pages/request-globals/fetch',
    title: 'fetch',
  },
  {
    expectedPayload: '"client":"graphql-request"',
    expectedRequestPath: '/graphql',
    expectedRequestTrace: [
      'timeout=4800',
      'enableChunked=true',
    ],
    route: '/pages/request-globals/graphql-request',
    title: 'graphql-request',
  },
  {
    expectedPayload: '"transport":"axios"',
    expectedRequestPath: '/axios',
    expectedRequestTrace: [
      'timeout=4200',
      'enableHttp2=true',
    ],
    route: '/pages/request-globals/axios',
    title: 'axios',
  },
] as const

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function waitForTransportState(
  page: any,
  predicate: (snapshot: Record<string, any>) => boolean,
  timeoutMs = 15_000,
) {
  const startedAt = Date.now()
  let lastSnapshot: Record<string, any> = {}

  while (Date.now() - startedAt <= timeoutMs) {
    try {
      const snapshot = {
        pageStatus: await page.data('state.pageStatus'),
        payload: await page.data('state.payload'),
        requestLog: await page.data('state.requestLog'),
        runCount: await page.data('state.runCount'),
        status: await page.data('state.status'),
      }
      lastSnapshot = snapshot
      if (predicate(snapshot)) {
        return snapshot
      }
    }
    catch {
    }

    if (typeof page?.waitFor === 'function') {
      try {
        await page.waitFor(180)
        continue
      }
      catch {
      }
    }

    await sleep(180)
  }

  throw new Error(
    `Timed out after ${timeoutMs}ms waiting for request globals state.\n`
    + `Last data snapshot:\n${JSON.stringify(lastSnapshot, null, 2)}`,
  )
}

async function tapButtonAt(page: any, index: number) {
  const buttons = await page.$$('button')
  if (!Array.isArray(buttons) || !buttons[index]) {
    throw new Error(`Failed to find button at index ${index}`)
  }
  await buttons[index].tap()
}

async function invokeOrTap(page: any, methodName: string, tapIndex: number, ...args: any[]) {
  try {
    return await page.callMethod(methodName, ...args)
  }
  catch {
    await tapButtonAt(page, tapIndex)
    return null
  }
}

describe.sequential('wevu runtime demo request globals (weapp e2e)', () => {
  let miniProgram: any

  async function getMiniProgram(ctx: { skip: (message?: string) => void }) {
    if (miniProgram) {
      return miniProgram
    }
    try {
      await ensureWevuRuntimeDemoBuilt()
      miniProgram = await launchAutomator({
        projectPath: APP_ROOT,
      })
      return miniProgram
    }
    catch (error) {
      if (isDevtoolsHttpPortError(error)) {
        ctx.skip('WeChat DevTools 服务端口未开启，跳过 request globals IDE 自动化用例。')
      }
      throw error
    }
  }

  afterAll(async () => {
    if (!miniProgram) {
      return
    }
    await miniProgram.close()
  })

  it('exposes request globals from the app runtime and request-globals index page', async (ctx) => {
    const miniProgram = await getMiniProgram(ctx)
    const page = await miniProgram.reLaunch('/pages/request-globals/index')
    if (!page) {
      throw new Error('Failed to launch /pages/request-globals/index')
    }

    const appProbe = await miniProgram.evaluate(() => {
      return {
        fetchType: typeof fetch,
        urlAvailable: (() => {
          try {
            return new URL('https://request-globals.invalid').protocol === 'https:'
          }
          catch {
            return false
          }
        })(),
        webSocketAvailable: typeof WebSocket === 'function',
        xmlHttpRequestAvailable: typeof XMLHttpRequest === 'function',
      }
    })

    const entries = await page.data('entries')

    expect(appProbe, JSON.stringify(appProbe)).toEqual({
      fetchType: 'function',
      urlAvailable: true,
      webSocketAvailable: true,
      xmlHttpRequestAvailable: true,
    })
    expect(entries).toEqual([
      {
        desc: '使用 wevu/fetch + wevu/web-apis，验证全局 fetch 与宿主默认参数',
        route: '/pages/request-globals/fetch',
        title: 'fetch',
      },
      {
        desc: '使用 wevu/web-apis 安装 web runtime，验证 graphql-request 对 URL / fetch 的依赖链路',
        route: '/pages/request-globals/graphql-request',
        title: 'graphql-request',
      },
      {
        desc: '使用 wevu/web-apis 安装 web runtime，验证 axios 在小程序中的请求适配能力',
        route: '/pages/request-globals/axios',
        title: 'axios',
      },
    ])
  })

  it('supports fetch, graphql-request and axios in simulator runtime', async (ctx) => {
    const miniProgram = await getMiniProgram(ctx)

    for (const testCase of CASES) {
      const page = await miniProgram.reLaunch(testCase.route)
      if (!page) {
        throw new Error(`Failed to launch route ${testCase.route}`)
      }

      const initialState = await waitForTransportState(page, snapshot => (
        snapshot.pageStatus === '全部通过'
        && snapshot.runCount === 1
        && snapshot.status === 'success'
        && Array.isArray(snapshot.requestLog)
        && snapshot.requestLog.length === 1
      ))

      expect(initialState.payload).toContain(testCase.expectedPayload)
      expect(initialState.requestLog[0]).toContain(testCase.expectedRequestPath)
      for (const expectedTrace of testCase.expectedRequestTrace) {
        expect(initialState.requestLog[0]).toContain(expectedTrace)
      }

      await invokeOrTap(page, 'runChecks', 0)

      const rerunState = await waitForTransportState(page, snapshot => (
        snapshot.pageStatus === '全部通过'
        && snapshot.runCount === 2
        && snapshot.status === 'success'
        && Array.isArray(snapshot.requestLog)
        && snapshot.requestLog.length === 1
      ))

      expect(rerunState.payload).toContain(testCase.expectedPayload)
      expect(rerunState.requestLog[0]).toContain(testCase.expectedRequestPath)
      for (const expectedTrace of testCase.expectedRequestTrace) {
        expect(rerunState.requestLog[0]).toContain(expectedTrace)
      }
    }
  })
})
