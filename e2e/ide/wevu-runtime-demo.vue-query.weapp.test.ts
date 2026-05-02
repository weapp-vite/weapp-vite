import { afterAll, describe, expect, it } from 'vitest'
import { isDevtoolsHttpPortError, launchAutomator } from '../utils/automator'
import { APP_ROOT, ensureWevuRuntimeDemoBuilt } from './wevu-runtime-demo.shared'

const ROUTE = '/pages/vue-query/index'

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function waitForDataMatch(
  page: any,
  predicate: (snapshot: Record<string, any>) => boolean,
  timeoutMs = 15_000,
) {
  const startedAt = Date.now()
  let lastSnapshot: Record<string, any> = {}

  while (Date.now() - startedAt <= timeoutMs) {
    try {
      const snapshot = {
        selectedTab: await page.data('selectedTab'),
        refreshSeed: await page.data('refreshSeed'),
        statusText: await page.data('statusText'),
        generatedAtText: await page.data('generatedAtText'),
        queryKey: await page.data('queryKey'),
        query: await page.data('query'),
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
    `Timed out after ${timeoutMs}ms waiting for vue-query state.\n`
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

describe.sequential('wevu runtime demo vue-query (weapp e2e)', () => {
  let miniProgram: any

  async function getMiniProgram(ctx: { skip: (message?: string) => void }) {
    if (miniProgram) {
      return miniProgram
    }
    try {
      // 微信开发者工具 3.15.x 在 Vue App 根入口的 ESM appservice 装载阶段，
      // 会出现 `module 'app.js' is not defined`，IDE runtime 保留 CJS 真运行链路。
      await ensureWevuRuntimeDemoBuilt('cjs')
      miniProgram = await launchAutomator({
        projectPath: APP_ROOT,
      })
      return miniProgram
    }
    catch (error) {
      if (isDevtoolsHttpPortError(error)) {
        ctx.skip('WeChat DevTools 服务端口未开启，跳过 vue-query IDE 自动化用例。')
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

  it('resolves pending query and keeps query state reactive across tab switch and key rotation', async (ctx) => {
    const miniProgram = await getMiniProgram(ctx)
    const page = await miniProgram.reLaunch(ROUTE)
    if (!page) {
      throw new Error(`Failed to launch route ${ROUTE}`)
    }

    const initialState = await waitForDataMatch(page, snapshot => (
      snapshot.selectedTab === 'overview'
      && snapshot.statusText === '数据就绪'
      && snapshot.generatedAtText
      && snapshot.generatedAtText !== '--'
      && Array.isArray(snapshot.queryKey)
      && snapshot.queryKey[0] === 'demo-query'
      && snapshot.queryKey[1] === 'overview'
      && snapshot.query?.status === 'success'
      && snapshot.query?.data?.label === '概览数据'
    ))

    expect(initialState.query.data.label).toBe('概览数据')

    await invokeOrTap(page, 'switchTab', 1, 'detail')
    const switchedState = await waitForDataMatch(page, snapshot => (
      snapshot.selectedTab === 'detail'
      && snapshot.statusText === '数据就绪'
      && Array.isArray(snapshot.queryKey)
      && snapshot.queryKey[1] === 'detail'
      && snapshot.query?.status === 'success'
      && snapshot.query?.data?.label === '详情数据'
    ))

    expect(switchedState.query.data.label).toBe('详情数据')

    await invokeOrTap(page, 'resetCacheAndReload', 4)
    const refreshedState = await waitForDataMatch(page, snapshot => (
      snapshot.refreshSeed === 1
      && snapshot.statusText === '数据就绪'
      && Array.isArray(snapshot.queryKey)
      && snapshot.queryKey[2] === 1
      && snapshot.query?.status === 'success'
      && snapshot.query?.data?.selectedTab === 'detail'
    ))

    expect(refreshedState.queryKey[2]).toBe(1)
    expect(refreshedState.query.data.selectedTab).toBe('detail')
  })
})
